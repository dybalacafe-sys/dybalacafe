# Dybala BMS — Business Management System

A complete Business Management System for **Dybala Fast Food & Bakery Cafe**, built with:

- **Frontend**: Next.js 14 (Page Router) + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes (SSR + CSR)
- **Database**: MySQL via Prisma ORM
- **Auth**: JWT tokens + bcrypt password hashing

---

## 🚀 Quick Setup

### Prerequisites
- Node.js 18+
- MySQL 8.0+

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Database
Copy the example env file and update it:
```bash
cp .env.example .env
```

Edit `.env`:
```
DATABASE_URL="mysql://root:yourpassword@localhost:3306/dybala_bms"
JWT_SECRET="your-super-secret-key-here"
```

### 3. Create the Database
In MySQL:
```sql
CREATE DATABASE dybala_bms;
```

### 4. Run Migrations
```bash
npx prisma migrate dev --name init
```

### 5. Start the App
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 6. Initialize the System
On the login page, click **"Initialize System"** to seed the database with:
- Admin user: `admin@dybala.com` / `admin123`
- Default categories (Beverages, Food, Bakery, Cakes, Raw Materials)
- Sample products (Momo, Coffee, Tea, Cakes, etc.)

---

## 📱 Features

### ✅ Phase 1 — Core System (Go-Live Ready)
| Feature | Description |
|---|---|
| 🔐 Authentication | JWT-based login, role-based access (Super Admin, Admin, Staff) |
| 📊 Dashboard | Today's sales, pending orders, low-stock alerts, quick actions |
| 🛒 POS | Quick sale entry, cart management, multiple payment methods, stock auto-deduction |
| 📦 Inventory | Add/edit products, track stock, low-stock alerts, manual adjustments |
| 📋 Orders | Create cake/product orders, track status, advance/balance payments, delivery dates |
| 📈 Reports | Sales report, stock report, orders report, top products chart |

### 🔄 Phase 2 — Background Enhancements
| Feature | Description |
|---|---|
| 👥 Customers | Customer profiles, order history, VIP segmentation |
| 💸 Expenses | Track expenses by category, monthly summaries |
| 👤 User Management | Create/edit staff accounts, role assignment |

---

## 📁 Project Structure
```
bms/
├── pages/
│   ├── api/
│   │   ├── auth/         # Login, me
│   │   ├── products/     # CRUD + stock adjust
│   │   ├── orders/       # CRUD
│   │   ├── sales/        # POS sales
│   │   ├── customers/    # Customer management
│   │   ├── expenses/     # Expense tracking
│   │   ├── categories/   # Product categories
│   │   ├── users/        # User management
│   │   ├── reports.ts    # All report types
│   │   └── dashboard.ts  # Dashboard stats
│   ├── dashboard.tsx     # Main dashboard
│   ├── pos.tsx           # Point of Sale
│   ├── inventory.tsx     # Inventory management
│   ├── orders/           # Orders list + new order form
│   ├── reports.tsx       # Reports & analytics
│   ├── customers.tsx     # Customer database
│   ├── expenses.tsx      # Expense tracking
│   ├── users.tsx         # User management
│   └── login.tsx         # Login page
├── components/
│   └── Layout.tsx        # Main sidebar layout
├── lib/
│   ├── prisma.ts         # Prisma client singleton
│   ├── auth.ts           # JWT + bcrypt utilities
│   ├── AuthContext.tsx   # React auth context
│   └── utils.ts          # Helper functions
├── prisma/
│   └── schema.prisma     # Database schema
├── styles/
│   └── globals.css       # Tailwind + custom classes
└── .env.example          # Environment template
```

---

## 🔒 User Roles
| Role | Access |
|---|---|
| **SUPER_ADMIN** | Full access - manage users, delete products, all reports |
| **ADMIN** | Add/edit products, manage orders, view reports |
| **STAFF** | POS sales, create orders, view inventory |

---

## 🗄️ Production Deployment

### Build
```bash
npm run build
npm start
```

### Recommended Server Setup (Ubuntu 22.04)
1. Install Node.js 18+, MySQL 8
2. Clone/upload project
3. Configure `.env` with production values
4. Run `npx prisma migrate deploy`
5. Use PM2 for process management: `pm2 start npm --name bms -- start`
6. Use Nginx as reverse proxy on port 80/443
7. Get SSL certificate via Let's Encrypt

---

## 📞 Support
Built by Dristi Core Pvt. Ltd.  
Email: info@dristicore.com | Phone: +977 9844153288

