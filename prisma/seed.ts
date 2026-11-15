/**
 * Production Inventory & Multi-Outlet Seeder — Dybala Fast Food & Bakery Cafe
 * -----------------------------------------------------------------------------
 * Seeds realistic mock/random demonstration data across ALL modules & outlets:
 *  - Outlets (Dybala Cafe & Dybala Sekuwa) + Terminals (POS-1, POS-2)
 *  - Staff & Managers (Super Admin, Admins, Waiters)
 *  - Categories & Products with recipes, prices, and healthy stock levels
 *  - Tables for both Cafe and Sekuwa
 *  - Customers with loyalty points & credit limits
 *  - Active & Closed Table Sessions with order rounds
 *  - POS Sales history across recent dates
 *  - Orders / Pre-orders with advance payments
 *  - Expenses across multiple categories
 *  - Suppliers & Purchase logs
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ---- Categories -------------------------------------------------------
const CATEGORIES: { name: string; type: string }[] = [
  { name: 'Beverages', type: 'product' },
  { name: 'Food', type: 'product' },
  { name: 'Bakery', type: 'product' },
  { name: 'Cakes', type: 'product' },
  { name: 'Raw Materials', type: 'raw_material' },
  { name: 'Packaging', type: 'raw_material' },
  { name: 'Utilities', type: 'raw_material' },
]

// ---- Raw materials ----------------------------------------------------
const RAW_MATERIALS: {
  sku: string
  name: string
  category: string
  unit: string
  costPrice: number
  minStock: number
  defaultStock: number
}[] = [
  { sku: 'RM-COFFEE', name: 'Coffee', category: 'Raw Materials', unit: 'g', costPrice: 5.4, minStock: 200, defaultStock: 2500 },
  { sku: 'RM-SUGAR', name: 'Sugar', category: 'Raw Materials', unit: 'g', costPrice: 0.13, minStock: 1000, defaultStock: 15000 },
  { sku: 'RM-MILK', name: 'Milk', category: 'Raw Materials', unit: 'ml', costPrice: 0.08, minStock: 2000, defaultStock: 12000 },
  { sku: 'RM-TEA', name: 'Tea Leaves (Chiya Rang)', category: 'Raw Materials', unit: 'g', costPrice: 0.8, minStock: 200, defaultStock: 1800 },
  { sku: 'RM-LEMON', name: 'Lemon', category: 'Raw Materials', unit: 'piece', costPrice: 10, minStock: 15, defaultStock: 60 },
  { sku: 'RM-CABBAGE', name: 'Cabbage', category: 'Raw Materials', unit: 'kg', costPrice: 40, minStock: 5, defaultStock: 35 },
  { sku: 'RM-ONION', name: 'Onion', category: 'Raw Materials', unit: 'kg', costPrice: 80, minStock: 5, defaultStock: 25 },
  { sku: 'RM-GINGER', name: 'Ginger', category: 'Raw Materials', unit: 'g', costPrice: 0.3, minStock: 200, defaultStock: 1200 },
  { sku: 'RM-BUTTER', name: 'Butter', category: 'Raw Materials', unit: 'g', costPrice: 1, minStock: 300, defaultStock: 2500 },
  { sku: 'RM-MAIDA', name: 'Maida (Flour)', category: 'Raw Materials', unit: 'kg', costPrice: 60, minStock: 10, defaultStock: 50 },
  { sku: 'RM-BUN', name: 'Burger Bun', category: 'Raw Materials', unit: 'piece', costPrice: 13, minStock: 15, defaultStock: 45 },
  { sku: 'RM-PATTY', name: 'Veg Patty', category: 'Raw Materials', unit: 'piece', costPrice: 25, minStock: 15, defaultStock: 40 },
  { sku: 'RM-VEG', name: 'Veg Filling', category: 'Raw Materials', unit: 'g', costPrice: 0.5, minStock: 500, defaultStock: 4000 },
  { sku: 'RM-SAUCE', name: 'Sauce', category: 'Raw Materials', unit: 'ml', costPrice: 1, minStock: 300, defaultStock: 3000 },
  { sku: 'RM-PIZZA-BASE', name: 'Pizza Base', category: 'Raw Materials', unit: 'piece', costPrice: 100, minStock: 8, defaultStock: 30 },
  { sku: 'RM-CREAM', name: 'Cream', category: 'Raw Materials', unit: 'g', costPrice: 0.28, minStock: 500, defaultStock: 5000 },
  { sku: 'RM-CAKE-BASE', name: 'Cake Base', category: 'Raw Materials', unit: 'piece', costPrice: 10, minStock: 10, defaultStock: 35 },
  { sku: 'RM-PREMIX', name: 'Cake Premix (Sponge)', category: 'Raw Materials', unit: 'portion', costPrice: 80, minStock: 10, defaultStock: 40 },
  { sku: 'RM-OIL', name: 'Cooking Oil', category: 'Raw Materials', unit: 'portion', costPrice: 10, minStock: 10, defaultStock: 40 },
  { sku: 'RM-SUGAR-SYRUP', name: 'Sugar Syrup', category: 'Raw Materials', unit: 'portion', costPrice: 10, minStock: 10, defaultStock: 50 },
  { sku: 'RM-CAKE-BOX', name: 'Cake Box', category: 'Packaging', unit: 'piece', costPrice: 20, minStock: 15, defaultStock: 50 },
  { sku: 'RM-PIZZA-PACK', name: 'Pizza Pack', category: 'Packaging', unit: 'piece', costPrice: 20, minStock: 15, defaultStock: 40 },
  { sku: 'RM-PASTRY-BOX', name: 'Pastry Box', category: 'Packaging', unit: 'piece', costPrice: 5, minStock: 20, defaultStock: 80 },
  { sku: 'RM-GAS', name: 'Gas (& Electricity)', category: 'Utilities', unit: 'use', costPrice: 1, minStock: 0, defaultStock: 250 },
  { sku: 'RM-MISC-PREP', name: 'Misc Prep Ingredients', category: 'Utilities', unit: 'use', costPrice: 40, minStock: 0, defaultStock: 50 },
]

// ---- Finished goods + recipes ----------------------------------------
type RecipeLine = { sku: string; qty: number; unit: string }
const FINISHED: {
  sku: string
  name: string
  category: string
  unit: string
  price: number
  defaultStock: number
  recipe: RecipeLine[]
}[] = [
  {
    sku: 'FG-BLACK-COFFEE', name: 'Black Coffee', category: 'Beverages', unit: 'cup', price: 90, defaultStock: 60,
    recipe: [
      { sku: 'RM-COFFEE', qty: 5, unit: 'g' },
      { sku: 'RM-SUGAR', qty: 10, unit: 'g' },
      { sku: 'RM-GAS', qty: 5, unit: 'use' },
    ],
  },
  {
    sku: 'FG-MILK-COFFEE', name: 'Milk Coffee', category: 'Beverages', unit: 'cup', price: 140, defaultStock: 55,
    recipe: [
      { sku: 'RM-MILK', qty: 150, unit: 'ml' },
      { sku: 'RM-COFFEE', qty: 5, unit: 'g' },
      { sku: 'RM-SUGAR', qty: 10, unit: 'g' },
    ],
  },
  {
    sku: 'FG-MILK-TEA', name: 'Milk Tea', category: 'Beverages', unit: 'cup', price: 60, defaultStock: 80,
    recipe: [
      { sku: 'RM-MILK', qty: 100, unit: 'ml' },
      { sku: 'RM-TEA', qty: 5, unit: 'g' },
      { sku: 'RM-SUGAR', qty: 10, unit: 'g' },
    ],
  },
  {
    sku: 'FG-BLACK-TEA', name: 'Black Tea', category: 'Beverages', unit: 'cup', price: 50, defaultStock: 75,
    recipe: [
      { sku: 'RM-TEA', qty: 3, unit: 'g' },
      { sku: 'RM-SUGAR', qty: 10, unit: 'g' },
      { sku: 'RM-LEMON', qty: 0.5, unit: 'piece' },
    ],
  },
  {
    sku: 'FG-MOMO', name: 'Momo (Veg, 1 plate)', category: 'Food', unit: 'plate', price: 180, defaultStock: 35,
    recipe: [
      { sku: 'RM-CABBAGE', qty: 0.3, unit: 'kg' },
      { sku: 'RM-ONION', qty: 0.1, unit: 'kg' },
      { sku: 'RM-GINGER', qty: 5, unit: 'g' },
      { sku: 'RM-BUTTER', qty: 5, unit: 'g' },
      { sku: 'RM-MAIDA', qty: 0.1, unit: 'kg' },
      { sku: 'RM-MISC-PREP', qty: 0.1, unit: 'use' },
      { sku: 'RM-GAS', qty: 2, unit: 'use' },
    ],
  },
  {
    sku: 'FG-VEG-BURGER', name: 'Veg Burger', category: 'Food', unit: 'piece', price: 175, defaultStock: 25,
    recipe: [
      { sku: 'RM-BUN', qty: 1, unit: 'piece' },
      { sku: 'RM-PATTY', qty: 1, unit: 'piece' },
      { sku: 'RM-VEG', qty: 20, unit: 'g' },
      { sku: 'RM-BUTTER', qty: 5, unit: 'g' },
      { sku: 'RM-SAUCE', qty: 10, unit: 'ml' },
      { sku: 'RM-GAS', qty: 10, unit: 'use' },
    ],
  },
  {
    sku: 'FG-VEG-PIZZA', name: 'Veg Pizza', category: 'Food', unit: 'piece', price: 380, defaultStock: 18,
    recipe: [
      { sku: 'RM-PIZZA-BASE', qty: 1, unit: 'piece' },
      { sku: 'RM-VEG', qty: 40, unit: 'g' },
      { sku: 'RM-GAS', qty: 10, unit: 'use' },
      { sku: 'RM-PIZZA-PACK', qty: 1, unit: 'piece' },
    ],
  },
  {
    sku: 'FG-CAKE', name: 'Cake (1 Pound)', category: 'Cakes', unit: 'piece', price: 850, defaultStock: 6, // Low stock demo!
    recipe: [
      { sku: 'RM-PREMIX', qty: 1, unit: 'portion' },
      { sku: 'RM-OIL', qty: 1, unit: 'portion' },
      { sku: 'RM-GAS', qty: 10, unit: 'use' },
      { sku: 'RM-SUGAR-SYRUP', qty: 1, unit: 'portion' },
      { sku: 'RM-CREAM', qty: 250, unit: 'g' },
      { sku: 'RM-CAKE-BASE', qty: 1, unit: 'piece' },
      { sku: 'RM-CAKE-BOX', qty: 1, unit: 'piece' },
    ],
  },
  {
    sku: 'FG-PASTRY', name: 'Pastry', category: 'Bakery', unit: 'piece', price: 120, defaultStock: 24,
    recipe: [
      { sku: 'RM-PREMIX', qty: 1, unit: 'portion' },
      { sku: 'RM-OIL', qty: 1, unit: 'portion' },
      { sku: 'RM-GAS', qty: 10, unit: 'use' },
      { sku: 'RM-SUGAR-SYRUP', qty: 1, unit: 'portion' },
      { sku: 'RM-CREAM', qty: 50, unit: 'g' },
      { sku: 'RM-CAKE-BASE', qty: 1, unit: 'piece' },
      { sku: 'RM-PASTRY-BOX', qty: 1, unit: 'piece' },
    ],
  },
]

async function main() {
  console.log('🌱 Starting comprehensive multi-outlet data seeding...')

  // 1) Outlets & Terminals
  const cafeType = await prisma.outletType.upsert({
    where: { code: 'CAFE' },
    update: {},
    create: { name: 'Cafe & Bakery', code: 'CAFE' },
  })
  const sekuwaType = await prisma.outletType.upsert({
    where: { code: 'SEKUWA' },
    update: {},
    create: { name: 'Restaurant & Sekuwa Corner', code: 'SEKUWA' },
  })

  const cafe = await prisma.outlet.upsert({
    where: { code: 'CAF' },
    update: { posEnabled: true, hasTables: true },
    create: {
      name: 'Dybala Cafe & Bakery',
      code: 'CAF',
      typeId: cafeType.id,
      posEnabled: true,
      hasTables: true,
      usesRecipes: true,
    },
  })

  const sekuwa = await prisma.outlet.upsert({
    where: { code: 'SEK' },
    update: { posEnabled: true, hasTables: true },
    create: {
      name: 'Dybala Sekuwa Corner',
      code: 'SEK',
      typeId: sekuwaType.id,
      posEnabled: true,
      hasTables: true,
      usesRecipes: true,
    },
  })

  const outlets = [cafe, sekuwa]

  const terminals: any[] = []
  for (const name of ['POS-1 (Main Counter)', 'POS-2 (Bar Counter)']) {
    const t = await prisma.terminal.upsert({
      where: { outletId_name: { outletId: sekuwa.id, name } },
      update: {},
      create: { outletId: sekuwa.id, name },
    })
    terminals.push(t)
  }
  for (const name of ['Cafe POS Main']) {
    const t = await prisma.terminal.upsert({
      where: { outletId_name: { outletId: cafe.id, name } },
      update: {},
      create: { outletId: cafe.id, name },
    })
    terminals.push(t)
  }
  console.log('   ✔ Outlets & Terminals configured')

  // 2) Staff & User Accounts
  const hashedPassword = await bcrypt.hash('admin123', 10)
  const staffPassword = await bcrypt.hash('staff123', 10)

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@dybala.com' },
    update: { role: 'SUPER_ADMIN', active: true },
    create: {
      name: 'Super Admin',
      email: 'admin@dybala.com',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      active: true,
    },
  })

  const cafeManager = await prisma.user.upsert({
    where: { email: 'manager.cafe@dybala.com' },
    update: { role: 'ADMIN', active: true },
    create: {
      name: 'Pooja Shrestha (Cafe Mgr)',
      email: 'manager.cafe@dybala.com',
      password: staffPassword,
      role: 'ADMIN',
      active: true,
    },
  })

  const sekuwaManager = await prisma.user.upsert({
    where: { email: 'manager.sekuwa@dybala.com' },
    update: { role: 'ADMIN', active: true },
    create: {
      name: 'Bikash Thapa (Sekuwa Mgr)',
      email: 'manager.sekuwa@dybala.com',
      password: staffPassword,
      role: 'ADMIN',
      active: true,
    },
  })

  const waiterRamesh = await prisma.user.upsert({
    where: { email: 'ramesh@dybala.com' },
    update: { role: 'STAFF', active: true },
    create: {
      name: 'Ramesh Adhikari (Server)',
      email: 'ramesh@dybala.com',
      password: staffPassword,
      role: 'STAFF',
      active: true,
    },
  })

  // User-Outlet links
  for (const o of outlets) {
    await prisma.userOutlet.upsert({
      where: { userId_outletId: { userId: adminUser.id, outletId: o.id } },
      update: {},
      create: { userId: adminUser.id, outletId: o.id },
    })
  }
  await prisma.userOutlet.upsert({
    where: { userId_outletId: { userId: cafeManager.id, outletId: cafe.id } },
    update: {},
    create: { userId: cafeManager.id, outletId: cafe.id },
  })
  await prisma.userOutlet.upsert({
    where: { userId_outletId: { userId: sekuwaManager.id, outletId: sekuwa.id } },
    update: {},
    create: { userId: sekuwaManager.id, outletId: sekuwa.id },
  })
  await prisma.userOutlet.upsert({
    where: { userId_outletId: { userId: waiterRamesh.id, outletId: sekuwa.id } },
    update: {},
    create: { userId: waiterRamesh.id, outletId: sekuwa.id },
  })
  console.log('   ✔ Users & Staff provisioned')

  // 3) Categories
  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { name: c.name },
      update: { type: c.type },
      create: c,
    })
  }
  const categories = await prisma.category.findMany()
  const catId = (name: string) => categories.find((c) => c.name === name)?.id

  // 4) Raw Materials
  const rawCost: Record<string, number> = {}
  for (const rm of RAW_MATERIALS) {
    rawCost[rm.sku] = rm.costPrice
    const product = await prisma.product.upsert({
      where: { sku: rm.sku },
      update: {
        name: rm.name,
        categoryId: catId(rm.category),
        type: 'raw_material',
        unit: rm.unit,
        costPrice: rm.costPrice,
        price: rm.costPrice,
        active: true,
      },
      create: {
        sku: rm.sku,
        name: rm.name,
        categoryId: catId(rm.category),
        type: 'raw_material',
        unit: rm.unit,
        costPrice: rm.costPrice,
        price: rm.costPrice,
        active: true,
      },
    })

    // Upsert OutletProduct with realistic initial stock
    for (const outlet of outlets) {
      await prisma.outletProduct.upsert({
        where: { outletId_productId: { outletId: outlet.id, productId: product.id } },
        update: { stock: rm.defaultStock, minStock: rm.minStock },
        create: {
          outletId: outlet.id,
          productId: product.id,
          stock: rm.defaultStock,
          minStock: rm.minStock,
        },
      })
    }
  }

  // 5) Finished Goods + Recipes
  const seededProducts: any[] = []
  for (const fg of FINISHED) {
    const costPrice = Number(
      fg.recipe.reduce((sum, line) => sum + line.qty * (rawCost[line.sku] ?? 0), 0).toFixed(2),
    )

    const product = await prisma.product.upsert({
      where: { sku: fg.sku },
      update: {
        name: fg.name,
        categoryId: catId(fg.category),
        type: 'finished',
        unit: fg.unit,
        costPrice,
        price: fg.price,
        active: true,
      },
      create: {
        sku: fg.sku,
        name: fg.name,
        categoryId: catId(fg.category),
        type: 'finished',
        unit: fg.unit,
        costPrice,
        price: fg.price,
        active: true,
      },
    })
    seededProducts.push(product)

    // Rebuild recipe items
    await prisma.recipeItem.deleteMany({ where: { productId: product.id } })
    for (const line of fg.recipe) {
      const ingredient = await prisma.product.findUnique({ where: { sku: line.sku } })
      if (ingredient) {
        await prisma.recipeItem.create({
          data: {
            productId: product.id,
            ingredientId: ingredient.id,
            quantity: line.qty,
            unit: line.unit,
          },
        })
      }
    }

    // Set stock for each outlet (Sekuwa has full stock, Cafe has slightly varied stock)
    for (const outlet of outlets) {
      const outletStock = outlet.id === cafe.id ? Math.floor(fg.defaultStock * 0.8) : fg.defaultStock
      await prisma.outletProduct.upsert({
        where: { outletId_productId: { outletId: outlet.id, productId: product.id } },
        update: { stock: outletStock, price: fg.price },
        create: {
          outletId: outlet.id,
          productId: product.id,
          stock: outletStock,
          minStock: 5,
          price: fg.price,
        },
      })
    }
  }
  console.log('   ✔ 25 Raw Materials & 9 Finished Items with stock and recipes')

  // 6) Tables for both outlets
  const sekuwaTables = [
    { name: 'Table 1', capacity: 4 },
    { name: 'Table 2', capacity: 4 },
    { name: 'Table 3', capacity: 6 },
    { name: 'Table 4 (Outdoor)', capacity: 4 },
    { name: 'VIP Cabin A', capacity: 8 },
  ]
  const createdSekuwaTables: any[] = []
  for (const t of sekuwaTables) {
    const table = await prisma.table.upsert({
      where: { outletId_name: { outletId: sekuwa.id, name: t.name } },
      update: { capacity: t.capacity },
      create: { outletId: sekuwa.id, name: t.name, capacity: t.capacity },
    })
    createdSekuwaTables.push(table)
  }

  const cafeTables = [
    { name: 'Cafe T1', capacity: 2 },
    { name: 'Cafe T2', capacity: 4 },
    { name: 'Bakery Lounge', capacity: 6 },
  ]
  const createdCafeTables: any[] = []
  for (const t of cafeTables) {
    const table = await prisma.table.upsert({
      where: { outletId_name: { outletId: cafe.id, name: t.name } },
      update: { capacity: t.capacity },
      create: { outletId: cafe.id, name: t.name, capacity: t.capacity },
    })
    createdCafeTables.push(table)
  }
  console.log('   ✔ Tables created for Sekuwa and Cafe')

  // 7) Customers
  const customerData = [
    { name: 'Aayush Maharjan', phone: '9841234567', email: 'aayush@gmail.com', type: 'vip', points: 340, creditLimit: 15000, creditUsed: 2200 },
    { name: 'Sunita Gurung', phone: '9801234567', email: 'sunita.g@outlook.com', type: 'regular', points: 80, creditLimit: 5000, creditUsed: 0 },
    { name: 'Prabin Karki', phone: '9812345678', email: 'prabin.k@gmail.com', type: 'vip', points: 520, creditLimit: 25000, creditUsed: 4500 },
    { name: 'Deepa Shakya', phone: '9851098765', email: 'deepa@shakya.com', type: 'regular', points: 15, creditLimit: 0, creditUsed: 0 },
    { name: 'Rajendra Gautam', phone: '9860112233', email: 'rajendra.g@gmail.com', type: 'vip', points: 210, creditLimit: 10000, creditUsed: 1200 },
  ]
  const customers: any[] = []
  for (const c of customerData) {
    const cust = await prisma.customer.upsert({
      where: { id: customers.length + 1 },
      update: c,
      create: c,
    })
    customers.push(cust)
  }
  console.log('   ✔ Customers & Loyalty profiles seeded')

  // 8) Seed Recent POS Sales across outlets
  const momo = seededProducts.find((p) => p.sku === 'FG-MOMO')!
  const coffee = seededProducts.find((p) => p.sku === 'FG-MILK-COFFEE')!
  const tea = seededProducts.find((p) => p.sku === 'FG-MILK-TEA')!
  const burger = seededProducts.find((p) => p.sku === 'FG-VEG-BURGER')!
  const pastry = seededProducts.find((p) => p.sku === 'FG-PASTRY')!
  const pizza = seededProducts.find((p) => p.sku === 'FG-VEG-PIZZA')!

  const existingSalesCount = await prisma.sale.count()
  if (existingSalesCount === 0) {
    // Sekuwa POS Sales
    for (let i = 0; i < 6; i++) {
      const saleDate = new Date(Date.now() - i * 4 * 60 * 60 * 1000)
      await prisma.sale.create({
        data: {
          outletId: sekuwa.id,
          userId: adminUser.id,
          customerId: customers[i % customers.length].id,
          total: 540,
          discount: 40,
          paymentMethod: i % 2 === 0 ? 'cash' : 'fonepay',
          pointsEarned: 5,
          createdAt: saleDate,
          items: {
            create: [
              { productId: momo.id, quantity: 2, price: momo.price, subtotal: momo.price * 2 },
              { productId: coffee.id, quantity: 2, price: coffee.price, subtotal: coffee.price * 2 },
            ],
          },
        },
      })
    }

    // Cafe POS Sales
    for (let i = 0; i < 6; i++) {
      const saleDate = new Date(Date.now() - i * 3 * 60 * 60 * 1000)
      await prisma.sale.create({
        data: {
          outletId: cafe.id,
          userId: cafeManager.id,
          customerId: customers[(i + 1) % customers.length].id,
          total: 350,
          discount: 0,
          paymentMethod: 'card',
          pointsEarned: 3,
          createdAt: saleDate,
          items: {
            create: [
              { productId: pastry.id, quantity: 2, price: pastry.price, subtotal: pastry.price * 2 },
              { productId: tea.id, quantity: 2, price: tea.price, subtotal: tea.price * 2 },
            ],
          },
        },
      })
    }
    console.log('   ✔ 12 POS Sales records created')
  }

  // 9) Table Sessions (Closed & Live Active Sessions)
  const existingSessions = await prisma.tableSession.count()
  if (existingSessions === 0) {
    // A) Live OPEN Table Session on Sekuwa Table 1
    const openSession = await prisma.tableSession.create({
      data: {
        tableId: createdSekuwaTables[0].id,
        customerId: customers[0].id,
        customerName: customers[0].name,
        openedById: waiterRamesh.id,
        status: 'OPEN',
        totalAmount: 935,
        grandTotal: 935,
        openedAt: new Date(Date.now() - 45 * 60 * 1000), // 45 mins ago
        orders: {
          create: [
            {
              roundNumber: 1,
              note: 'Spicy momo please',
              createdAt: new Date(Date.now() - 40 * 60 * 1000),
              items: {
                create: [
                  { productId: momo.id, name: momo.name, quantity: 2, price: momo.price, subtotal: momo.price * 2 },
                  { productId: coffee.id, name: coffee.name, quantity: 1, price: coffee.price, subtotal: coffee.price },
                ],
              },
            },
            {
              roundNumber: 2,
              note: 'Extra sauce on burger',
              createdAt: new Date(Date.now() - 15 * 60 * 1000),
              items: {
                create: [
                  { productId: burger.id, name: burger.name, quantity: 2, price: burger.price, subtotal: burger.price * 2 },
                  { productId: tea.id, name: tea.name, quantity: 1, price: tea.price, subtotal: tea.price },
                ],
              },
            },
          ],
        },
      },
    })

    // B) Closed Historical Sessions with Revenue
    for (let i = 1; i <= 3; i++) {
      const closedAt = new Date(Date.now() - i * 6 * 60 * 60 * 1000)
      const openedAt = new Date(closedAt.getTime() - 75 * 60 * 1000)
      await prisma.tableSession.create({
        data: {
          tableId: createdSekuwaTables[i].id,
          customerId: customers[i].id,
          customerName: customers[i].name,
          openedById: waiterRamesh.id,
          closedById: sekuwaManager.id,
          status: 'CLOSED',
          totalAmount: 1100,
          discount: 100,
          grandTotal: 1000,
          paidAmount: 1000,
          paymentMethod: 'cash',
          openedAt,
          closedAt,
          orders: {
            create: [
              {
                roundNumber: 1,
                items: {
                  create: [
                    { productId: pizza.id, name: pizza.name, quantity: 2, price: pizza.price, subtotal: pizza.price * 2 },
                    { productId: coffee.id, name: coffee.name, quantity: 2, price: coffee.price, subtotal: coffee.price * 2 },
                  ],
                },
              },
            ],
          },
        },
      })
    }
    console.log('   ✔ Live Open & Closed Table Sessions seeded')
  }

  // 10) Orders / Pre-orders
  const existingOrders = await prisma.order.count()
  if (existingOrders === 0) {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(16, 0, 0, 0)

    const cakeItem = seededProducts.find((p) => p.sku === 'FG-CAKE')!

    await prisma.order.create({
      data: {
        orderNumber: 'CAF-0001',
        outletId: cafe.id,
        customerId: customers[2].id,
        customerName: customers[2].name,
        customerPhone: customers[2].phone,
        userId: adminUser.id,
        status: 'PENDING',
        paymentStatus: 'PARTIAL',
        totalAmount: 1700,
        advancePaid: 1000,
        balanceDue: 700,
        deliveryDate: tomorrow,
        note: 'Happy 25th Birthday Aayush write on cake with blue icing',
        items: {
          create: [
            { productId: cakeItem.id, name: 'Custom Chocolate Birthday Cake (2 Lb)', quantity: 2, price: 850, subtotal: 1700 },
          ],
        },
      },
    })

    await prisma.order.create({
      data: {
        orderNumber: 'SEK-0001',
        outletId: sekuwa.id,
        customerId: customers[0].id,
        customerName: customers[0].name,
        customerPhone: customers[0].phone,
        userId: sekuwaManager.id,
        status: 'IN_PROGRESS',
        paymentStatus: 'PAID',
        totalAmount: 2160,
        advancePaid: 2160,
        balanceDue: 0,
        deliveryDate: new Date(Date.now() + 4 * 60 * 60 * 1000),
        note: 'Office Friday Party Momo Pack (12 plates)',
        items: {
          create: [
            { productId: momo.id, name: momo.name, quantity: 12, price: momo.price, subtotal: momo.price * 12 },
          ],
        },
      },
    })
    console.log('   ✔ Pre-Orders (Pending & In Progress) created')
  }

  // 11) Monthly Expenses
  const existingExpenses = await prisma.expense.count()
  if (existingExpenses === 0) {
    const expensesList = [
      { outletId: sekuwa.id, category: 'Rent', amount: 35000, description: 'Main outlet building rent for current month' },
      { outletId: sekuwa.id, category: 'Utilities', amount: 6200, description: 'Electricity and water bill' },
      { outletId: sekuwa.id, category: 'Supplies', amount: 3800, description: 'Kalimati fresh vegetable market morning purchase' },
      { outletId: cafe.id, category: 'Rent', amount: 25000, description: 'Cafe & Bakery space rent' },
      { outletId: cafe.id, category: 'Utilities', amount: 4800, description: 'Electricity & Oven LPG refill' },
      { outletId: cafe.id, category: 'Supplies', amount: 7500, description: 'Dairy butter and premium baking chocolate supplies' },
    ]
    for (const exp of expensesList) {
      await prisma.expense.create({
        data: {
          ...exp,
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
      })
    }
    console.log('   ✔ Operating Expenses seeded for both outlets')
  }

  // 12) Suppliers & Purchases
  const existingSuppliers = await prisma.supplier.count()
  if (existingSuppliers === 0) {
    const dairySupplier = await prisma.supplier.create({
      data: {
        name: 'Himalayan Fresh Dairy Suppliers',
        phone: '9841009988',
        email: 'supply@himalayandairy.com',
        address: 'Balkhu, Kathmandu',
      },
    })

    await prisma.purchase.create({
      data: {
        outletId: sekuwa.id,
        supplierId: dairySupplier.id,
        total: 4200,
        paid: 4200,
        due: 0,
        note: 'Fresh milk & dairy cream delivery',
        items: {
          create: [
            { productId: RAW_MATERIALS[2].sku ? 3 : 1, name: 'Milk (Cow)', quantity: 30, price: 90, subtotal: 2700 },
            { productId: RAW_MATERIALS[8].sku ? 9 : 1, name: 'Butter', quantity: 3, price: 500, subtotal: 1500 },
          ],
        },
      },
    })
    console.log('   ✔ Suppliers & Purchases recorded')
  }

  console.log('✅ All realistic multi-outlet data generated successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
