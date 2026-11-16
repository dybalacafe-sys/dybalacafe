# Dybala BMS - Backend Operations & Architecture Guide

## 1. System Overview
- **Framework:** Next.js 16 (Pages Router + Turbopack)
- **Language / Runtime:** TypeScript 5, Node.js 20+
- **Database:** MySQL 8.0 via Prisma ORM
- **Authentication:** Stateless signed JWT with active database verification (`/api/auth/me`)
- **Multi-Tenancy:** Multi-outlet architecture scoped by `UserOutlet` assignments

---

## 2. Environment Variables

| Variable | Required | Default in Dev | Purpose |
|---|---|---|---|
| `DATABASE_URL` | **Yes** | `mysql://root:dybala123@localhost:3307/dybala_bms` | Prisma MySQL connection string |
| `JWT_SECRET` | **Yes in Prod** | Dev fallback only | Secret used to sign and verify session tokens |
| `INITIAL_ADMIN_PASSWORD` | Optional | `None` (Mandatory for setup route) | Password for initial Super Admin setup |
| `ENABLE_SETUP_ENDPOINT` | Optional | `false` in production | Allows `/api/setup` endpoint in production |
| `SETUP_SECRET` | Optional | `None` | Optional header check for `/api/setup` |
| `PORT` | Optional | `3000` | Application HTTP listening port |

---

## 3. Health & Monitoring

The system exposes an automated health probe at:
`GET /api/health`

### Response Payload:
```json
{
  "status": "healthy",
  "timestamp": "2026-11-16T09:00:00.000Z",
  "uptimeSeconds": 1420,
  "database": {
    "status": "connected",
    "latency": "2ms"
  },
  "system": {
    "nodeVersion": "v20.18.0",
    "memoryRssMb": 88,
    "memoryHeapUsedMb": 54
  }
}
```
*Returns HTTP `200` if healthy, HTTP `503 Service Unavailable` if MySQL is unreachable.*

---

## 4. Docker Operations

### Starting the Stack:
```bash
docker compose up -d
```

### Viewing Logs:
```bash
docker compose logs -f app
```

### Running Database Migrations:
```bash
docker compose exec app npx prisma migrate deploy
```

### Seeding Initial Demonstration / Multi-Outlet Data:
```bash
docker compose exec app npm run seed
```

---

## 5. Backup & Restore Procedures

### Database Backup (MySQL Dump):
```bash
# Dump dybala_bms database to a compressed SQL file
docker exec dybala_mysql mysqldump -u root -pdybala123 dybala_bms | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Database Restore:
```bash
# Decompress and restore from SQL backup
gunzip < backup_20261116_120000.sql.gz | docker exec -i dybala_mysql mysql -u root -pdybala123 dybala_bms
```

---

## 6. Service Layer Architecture

Business logic is cleanly isolated in `lib/services/`:
- **`lib/services/sales.service.ts`**: Handles shopping cart validation, batch product lookups (N+1 free), atomic conditional inventory decrements, and loyalty point calculations.
- **`lib/services/purchases.service.ts`**: Manages vendor purchasing records, input boundary checks, and atomic credit balance payment allocations.
- **`lib/services/orders.service.ts`**: Manages pre-orders, status workflows, collision-safe order numbering, and customer credit limits.

---

## 7. Modular Database Seeders

The database seeding pipeline is broken into independent domain modules in `prisma/seeds/`:

| Script | Module File | Description | Default Credentials / Output |
|---|---|---|---|
| `npm run seed:outlets` | `prisma/seeds/01-outlets.ts` | Outlet Types, Outlets (Sekuwa, Cafe), & POS Terminals | Outlets: `CAF`, `SEK` |
| `npm run seed:users` | `prisma/seeds/02-users.ts` | User Accounts, BCrypt Hashes & Outlet Access | `admin@dybala.com` (`admin123`), `manager.cafe@dybala.com` (`staff123`), `ramesh@dybala.com`, `sita@dybala.com` |
| `npm run seed:inventory` | `prisma/seeds/03-inventory.ts` | Categories, 25 Raw Materials, 9 Finished Items with Recipes & Stock | Menu items, ingredient proportions, and branch stock |
| `npm run seed:demo` | `prisma/seeds/04-demo-data.ts` | Dine-in tables, loyalty customers, POS sales, active/closed sessions, pre-orders, expenses & vendor purchases | Realistic transaction activity |
| `npm run seed` | `prisma/seed.ts` | **Master Seeder**: Executes all 4 modules sequentially in transactional order | Complete database bootstrap |

### Password Customization during Seeding:
You can specify custom credentials using environment variables:
```bash
ADMIN_PASSWORD="StrongAdminPassword!2026" STAFF_PASSWORD="StrongStaffPassword!2026" npm run seed:users
```

For complete user account details, role permissions, and outlet mappings, see [docs/ACCOUNTS.md](file:///mnt/Disk2/Sameer/production_house_fullstack-main/docs/ACCOUNTS.md).

---

## 8. Testing Architecture & Verification Suites

The testing strategy is layered into three distinct suites to guarantee safety, speed, and real database verification without ever corrupting production data:

### Suite 1: In-Memory Fast Security & RBAC Suite
- **Command:** `npm test`
- **Execution Time:** ~0.8s
- **Database Writes:** **Zero** (100% Hermetic)
- **What it verifies:**
  - 401 unauthenticated challenge across all protected API routes.
  - 403 authorization denial for zero-permission staff on read routes.
  - 403 authorization denial for view-only users attempting writes.
  - Fail-closed 403 on cross-outlet requests (preventing outlet data leaks).
  - 404 responses for nonexistent customer, product, table, and order modifications.
  - 403 production guard on unauthenticated `POST /api/setup`.
  - Financial integrity: Rejection of negative product prices, negative cost prices, negative stocks, and invalid stock adjustments.
  - Gross profit mathematical verification across POS and table session sales.
  - JWT claim round-trips and input validation utilities.

### Suite 2: Disposable Database Concurrency & Rollback Suite
- **Command:** `npm run test:integration`
- **Database:** Dedicated disposable database (`dybala_bms_test`) on `localhost:3307`
- **Safety Guard:** Automatically skips or aborts if `DATABASE_URL` does not explicitly contain `_test`.
- **What it verifies:**
  - **Race Conditions:** Parallel checkouts when `stock: 1` yields exactly 1 success (201) and 1 failure (400), with final stock remaining 0 (never negative).
  - **Transaction Rollbacks:** Multi-item cart failures immediately roll back previous item deductions with zero orphaned stock leaks.
  - **Vendor Credit Payments:** Partial allocations update paid/due amounts atomically and record operating expenses. Overpayments are rejected.

### Suite 3: Live Read-Only Smoke Suite
- **Command:** `npm run test:api`
- **Target:** Running Docker application (`http://localhost:3000`)
- **Database Writes:** **Zero** (Safe for running environments)
- **What it verifies:**
  - 49 live HTTP requests across all Next.js API routes.
  - Production `/api/setup` endpoint lockdown.
  - Live RBAC token enforcement and outlet isolation against active MySQL containers.

---

## 9. Security & Concurrency Audit Hardening

| Vulnerability / Finding | Severity | Resolution Implemented | Impact |
|---|---|---|---|
| **Table Session Cross-Outlet Leak** | **P1 (Critical)** | Added `getOutletIdFromRequest` and scoped both list and count queries to `{ table: { outletId: currentOutletId } }` in [pages/api/table-sessions/index.ts](file:///mnt/Disk2/Sameer/production_house_fullstack-main/pages/api/table-sessions/index.ts). | Prevents unauthorized cross-branch viewing of dine-in sessions, order items, and customer phone numbers. |
| **Deactivated User JWT Access** | **P1 (Critical)** | Added active status database check (`prisma.user.findUnique({ select: { active: true } })`) inside `withAuth` middleware in [lib/auth.ts](file:///mnt/Disk2/Sameer/production_house_fullstack-main/lib/auth.ts). | Deactivating a user immediately invalidates all their issued tokens across all protected endpoints. |
| **Concurrent Double Checkout** | **P1 (Critical)** | Made table session closure conditional on `status: 'OPEN'` via `tx.tableSession.updateMany` inside transaction in [pages/api/table-sessions/[id].ts](file:///mnt/Disk2/Sameer/production_house_fullstack-main/pages/api/table-sessions/[id].ts). | Eliminates race condition where two simultaneous checkouts could double-deduct inventory and double-credit customer points. |
| **Order Credit Balance Asymmetry** | **P1 (Critical)** | Added customer credit limit checks and `creditUsed` increment on order creation, balance updates on payment, and credit decrements on cancellation in [lib/services/orders.service.ts](file:///mnt/Disk2/Sameer/production_house_fullstack-main/lib/services/orders.service.ts). | Prevents customer credit from becoming negative or exceeding limits when ordering on credit. |
| **Open Table Check-Then-Create Race** | **P2 (Edge Case)** | Wrapped open session check and creation inside `prisma.$transaction` in [pages/api/table-sessions/index.ts](file:///mnt/Disk2/Sameer/production_house_fullstack-main/pages/api/table-sessions/index.ts). | Serializes table session opening and avoids duplicate active sessions. |



