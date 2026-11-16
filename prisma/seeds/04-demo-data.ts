/**
 * Seed Demonstration & Operational Mock Data
 * -------------------------------------------------------------
 * Sets up dine-in tables, loyalty customers, recent POS sales,
 * live/closed table sessions, pre-orders, expenses, and supplier purchases.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function seedDemoData(client: PrismaClient = prisma) {
  console.log('📊 Seeding Demonstration & Mock Data...')

  // 1. Fetch Outlets
  const sekuwa = await client.outlet.findUnique({ where: { code: 'SEK' } })
  const cafe = await client.outlet.findUnique({ where: { code: 'CAF' } })

  if (!sekuwa || !cafe) {
    throw new Error('Outlets (SEK, CAF) not found. Please run "npm run seed:outlets" first.')
  }

  // 2. Fetch Users
  const adminUser = await client.user.findUnique({ where: { email: 'admin@dybala.com' } })
  const cafeManager = await client.user.findUnique({ where: { email: 'manager.cafe@dybala.com' } })
  const sekuwaManager = await client.user.findUnique({ where: { email: 'manager.sekuwa@dybala.com' } })
  const waiterRamesh = await client.user.findUnique({ where: { email: 'ramesh@dybala.com' } })

  if (!adminUser || !cafeManager || !sekuwaManager || !waiterRamesh) {
    throw new Error('Required users not found. Please run "npm run seed:users" first.')
  }

  // 3. Fetch Finished Products
  const momo = await client.product.findUnique({ where: { sku: 'FG-MOMO' } })
  const coffee = await client.product.findUnique({ where: { sku: 'FG-MILK-COFFEE' } })
  const tea = await client.product.findUnique({ where: { sku: 'FG-MILK-TEA' } })
  const burger = await client.product.findUnique({ where: { sku: 'FG-VEG-BURGER' } })
  const pastry = await client.product.findUnique({ where: { sku: 'FG-PASTRY' } })
  const pizza = await client.product.findUnique({ where: { sku: 'FG-VEG-PIZZA' } })
  const cakeItem = await client.product.findUnique({ where: { sku: 'FG-CAKE' } })

  if (!momo || !coffee || !tea || !burger || !pastry || !pizza || !cakeItem) {
    throw new Error('Finished catalog items not found. Please run "npm run seed:inventory" first.')
  }

  // 4. Tables for Outlets
  const sekuwaTables = [
    { name: 'Table 1', capacity: 4 },
    { name: 'Table 2', capacity: 4 },
    { name: 'Table 3', capacity: 6 },
    { name: 'Table 4 (Outdoor)', capacity: 4 },
    { name: 'VIP Cabin A', capacity: 8 },
  ]
  const createdSekuwaTables: any[] = []
  for (const t of sekuwaTables) {
    const table = await client.table.upsert({
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
    const table = await client.table.upsert({
      where: { outletId_name: { outletId: cafe.id, name: t.name } },
      update: { capacity: t.capacity },
      create: { outletId: cafe.id, name: t.name, capacity: t.capacity },
    })
    createdCafeTables.push(table)
  }
  console.log('   ✔ Dine-in tables configured for Sekuwa and Cafe')

  // 5. Customers & Loyalty Profiles
  const customerData = [
    { name: 'Aayush Maharjan', phone: '9841234567', email: 'aayush@gmail.com', type: 'vip', points: 340, creditLimit: 15000, creditUsed: 2200 },
    { name: 'Sunita Gurung', phone: '9801234567', email: 'sunita.g@outlook.com', type: 'regular', points: 80, creditLimit: 5000, creditUsed: 0 },
    { name: 'Prabin Karki', phone: '9812345678', email: 'prabin.k@gmail.com', type: 'vip', points: 520, creditLimit: 25000, creditUsed: 4500 },
    { name: 'Deepa Shakya', phone: '9851098765', email: 'deepa@shakya.com', type: 'regular', points: 15, creditLimit: 0, creditUsed: 0 },
    { name: 'Rajendra Gautam', phone: '9860112233', email: 'rajendra.g@gmail.com', type: 'vip', points: 210, creditLimit: 10000, creditUsed: 1200 },
  ]
  const customers: any[] = []
  for (const c of customerData) {
    const existing = await client.customer.findFirst({ where: { phone: c.phone } })
    if (existing) {
      const updated = await client.customer.update({ where: { id: existing.id }, data: c })
      customers.push(updated)
    } else {
      const created = await client.customer.create({ data: c })
      customers.push(created)
    }
  }
  console.log('   ✔ Customers & Loyalty profiles seeded')

  // 6. Recent POS Sales
  const existingSalesCount = await client.sale.count()
  if (existingSalesCount === 0) {
    // Sekuwa POS Sales
    for (let i = 0; i < 6; i++) {
      const saleDate = new Date(Date.now() - i * 4 * 60 * 60 * 1000)
      await client.sale.create({
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
      await client.sale.create({
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

  // 7. Table Sessions (Live Open & Closed Historical Sessions)
  const existingSessions = await client.tableSession.count()
  if (existingSessions === 0) {
    // Live OPEN Table Session on Sekuwa Table 1
    await client.tableSession.create({
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

    // Closed Historical Sessions with Revenue
    for (let i = 1; i <= 3; i++) {
      const closedAt = new Date(Date.now() - i * 6 * 60 * 60 * 1000)
      const openedAt = new Date(closedAt.getTime() - 75 * 60 * 1000)
      await client.tableSession.create({
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

  // 8. Orders / Pre-orders
  const existingOrders = await client.order.count()
  if (existingOrders === 0) {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(16, 0, 0, 0)

    await client.order.create({
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

    await client.order.create({
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

  // 9. Monthly Expenses
  const existingExpenses = await client.expense.count()
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
      await client.expense.create({
        data: {
          ...exp,
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
      })
    }
    console.log('   ✔ Operating Expenses seeded for both outlets')
  }

  // 10. Suppliers & Purchases
  const existingSuppliers = await client.supplier.count()
  if (existingSuppliers === 0) {
    const dairySupplier = await client.supplier.create({
      data: {
        name: 'Himalayan Fresh Dairy Suppliers',
        phone: '9841009988',
        email: 'supply@himalayandairy.com',
        address: 'Balkhu, Kathmandu',
      },
    })

    const rawMilk = await client.product.findFirst({ where: { sku: 'RM-MILK' } })
    const rawButter = await client.product.findFirst({ where: { sku: 'RM-BUTTER' } })

    await client.purchase.create({
      data: {
        outletId: sekuwa.id,
        supplierId: dairySupplier.id,
        total: 4200,
        paid: 4200,
        due: 0,
        note: 'Fresh milk & dairy cream delivery',
        items: {
          create: [
            { productId: rawMilk?.id ?? 1, name: 'Milk (Cow)', quantity: 30, price: 90, subtotal: 2700 },
            { productId: rawButter?.id ?? 1, name: 'Butter', quantity: 3, price: 500, subtotal: 1500 },
          ],
        },
      },
    })
    console.log('   ✔ Suppliers & Purchases recorded')
  }

  console.log('   ✔ Demonstration & Mock Data successfully generated.')
}

// Standalone execution support
if (require.main === module || process.argv[1]?.endsWith('04-demo-data.ts')) {
  seedDemoData()
    .catch((e) => {
      console.error('❌ Failed seeding demo data:', e)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
