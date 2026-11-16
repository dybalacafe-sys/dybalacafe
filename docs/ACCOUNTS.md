# Dybala BMS — User Accounts & Credentials Reference

This document serves as the authoritative reference for provisioned user accounts, default credentials, role permissions, and seed operations.

---

## 1. Seeded User Accounts & Roles

All accounts are provisioned via the dedicated seeder script [`prisma/seeds/02-users.ts`](file:///mnt/Disk2/Sameer/production_house_fullstack-main/prisma/seeds/02-users.ts). Passwords are automatically hashed with bcrypt (salt rounds = 10).

| Role | Full Name | Email Address | Default Password | Assigned Outlet(s) | Description |
|---|---|---|---|---|---|
| **SUPER_ADMIN** | Super Admin | `admin@dybala.com` | `admin123` | All active outlets | Full unrestricted system access across all outlets, settings, finances, and users. |
| **ADMIN** | Pooja Shrestha (Cafe Mgr) | `manager.cafe@dybala.com` | `staff123` | Dybala Cafe & Bakery (`CAF`) | Branch management, menu pricing, expenses, orders, and branch reports. |
| **ADMIN** | Bikash Thapa (Sekuwa Mgr) | `manager.sekuwa@dybala.com` | `staff123` | Dybala Sekuwa Corner (`SEK`) | Branch management, table sessions, stock tracking, and branch reports. |
| **STAFF** | Ramesh Adhikari (Server) | `ramesh@dybala.com` | `staff123` | Dybala Sekuwa Corner (`SEK`) | Table order entry, round notes, and dine-in session management. |
| **STAFF** | Sita Sharma (Cashier) | `sita@dybala.com` | `staff123` | Dybala Cafe & Bakery (`CAF`) | POS checkout, discount application, cash/card/fonepay payments, and receipt printing. |

---

## 2. Seeding User Accounts

### Independent Seeding
To provision or reset user accounts without touching menu inventory or transaction history:
```bash
npm run seed:users
```

### Custom Password Overrides
In staging or production, avoid using default passwords by setting environment variables during execution:
```bash
ADMIN_PASSWORD="StrongProductionPassword!2026" \
STAFF_PASSWORD="StrongStaffPassword!2026" \
npm run seed:users
```

---

## 3. Modular Seeding Pipeline Overview

The complete database seeding architecture is decoupled into four dedicated modules:

| Step | Script | Source File | Description |
|:---:|---|---|---|
| **1** | `npm run seed:outlets` | [`prisma/seeds/01-outlets.ts`](file:///mnt/Disk2/Sameer/production_house_fullstack-main/prisma/seeds/01-outlets.ts) | Outlets (`CAF`, `SEK`) & POS Terminals |
| **2** | `npm run seed:users` | [`prisma/seeds/02-users.ts`](file:///mnt/Disk2/Sameer/production_house_fullstack-main/prisma/seeds/02-users.ts) | User Accounts & Outlet Assignments |
| **3** | `npm run seed:inventory` | [`prisma/seeds/03-inventory.ts`](file:///mnt/Disk2/Sameer/production_house_fullstack-main/prisma/seeds/03-inventory.ts) | Categories, Raw Materials, Finished Products, Recipes & Stock |
| **4** | `npm run seed:demo` | [`prisma/seeds/04-demo-data.ts`](file:///mnt/Disk2/Sameer/production_house_fullstack-main/prisma/seeds/04-demo-data.ts) | Tables, Customers, POS Sales, Table Sessions, Orders, Expenses & Purchases |
| **All** | `npm run seed` | [`prisma/seed.ts`](file:///mnt/Disk2/Sameer/production_house_fullstack-main/prisma/seed.ts) | Master Orchestrator (executes steps 1–4 sequentially) |

---

## 4. Security & Permissions Matrix

Each user account's API and UI access is evaluated via:
1. **JWT Verification**: Token issued on login containing `userId`, `email`, `role`, and `name`.
2. **Active User State Check**: Verified against the database in `/api/auth/me`.
3. **Outlet Scoping**: `UserOutlet` mapping enforces that managers and staff only access data belonging to their assigned outlet.
4. **Module Permission Gates**: Fine-grained view/edit/delete access for sales, expenses, inventory, and reports.
