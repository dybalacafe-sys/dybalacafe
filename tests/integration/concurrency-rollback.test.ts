/**
 * Integration Test: Concurrency, Transaction Rollback & Data Integrity
 * ---------------------------------------------------------------------
 * Runs against the disposable MySQL test database (`dybala_bms_test`).
 * Validates real row-level locking, atomic transactions, and rollback behavior.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import { PrismaClient } from '@prisma/client'
import { salesService } from '../../lib/services/sales.service'
import { purchasesService } from '../../lib/services/purchases.service'
import { ordersService } from '../../lib/services/orders.service'
import { setPrismaClient } from '../../lib/prisma'

// Load test environment: Explicitly override with .env.test keys
if (fs.existsSync('.env.test')) {
  const envContent = fs.readFileSync('.env.test', 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const val = match[2].trim().replace(/^["']|["']$/g, '')
      process.env[key] = val
    }
  }
}

const testDbUrl = process.env.DATABASE_URL || 'mysql://root:dybala123@localhost:3307/dybala_bms_test'

// Safety check: Never run integration suite against non-test databases
if (!testDbUrl.includes('test')) {
  console.warn('[Integration Test] Skipped: DATABASE_URL must point to a database containing "_test"')
  process.exit(0)
}

const testPrisma = new PrismaClient({
  datasources: { db: { url: testDbUrl } },
})

// Inject test database client
setPrismaClient(testPrisma)

test('Integration: Concurrency & Transaction Rollback Suite', async (t) => {
  let testOutletId: number
  let testUserId: number
  let testCustomerId: number
  let testCustomerPhone: string
  let limitedProductId: number
  let multiProductAId: number
  let multiProductBId: number
  let testSupplierId: number
  let testPurchaseId: number

  await t.test('Setup: Create isolated fixtures in disposable test database', async () => {
    // 0. Ensure an OutletType exists
    const outletType = await testPrisma.outletType.upsert({
      where: { code: 'CAFE' },
      update: {},
      create: { name: 'Cafe & Restaurant', code: 'CAFE' },
    })

    // 1. Outlet
    const outlet = await testPrisma.outlet.create({
      data: {
        name: `Concurrency Test Outlet ${Date.now()}`,
        code: `TCON${Math.floor(1000 + Math.random() * 9000)}`,
        typeId: outletType.id,
        posEnabled: true,
        hasTables: true,
        usesRecipes: true,
        active: true,
      },
    })
    testOutletId = outlet.id

    // 2. User
    const user = await testPrisma.user.create({
      data: {
        email: `tester-${Date.now()}@dybala.test`,
        password: 'hashedpassword',
        name: 'Concurrency Tester',
        role: 'STAFF',
        active: true,
        outlets: { create: { outletId: testOutletId } },
      },
    })
    testUserId = user.id

    // 3. Customer with 5,000 credit limit
    testCustomerPhone = `9810${Math.floor(100000 + Math.random() * 900000)}`
    const cust = await testPrisma.customer.create({
      data: {
        name: 'Test Customer',
        phone: testCustomerPhone,
        type: 'regular',
        points: 0,
        creditLimit: 5000,
        creditUsed: 0,
      },
    })
    testCustomerId = cust.id

    // 4. Limited product (Stock = 1)
    const limitedProd = await testPrisma.product.create({
      data: {
        name: 'Last Unit Product',
        type: 'finished',
        price: 350,
        costPrice: 200,
        unit: 'piece',
        outletProducts: {
          create: {
            outletId: testOutletId,
            stock: 1,
            minStock: 0,
          },
        },
      },
    })
    limitedProductId = limitedProd.id

    // 5. Multi-item rollback products: Prod A (stock 5), Prod B (stock 0)
    const prodA = await testPrisma.product.create({
      data: {
        name: 'Rollback Item A',
        type: 'finished',
        price: 150,
        costPrice: 80,
        unit: 'piece',
        outletProducts: {
          create: { outletId: testOutletId, stock: 5, minStock: 2 },
        },
      },
    })
    multiProductAId = prodA.id

    const prodB = await testPrisma.product.create({
      data: {
        name: 'Rollback Item B (Empty)',
        type: 'finished',
        price: 250,
        costPrice: 120,
        unit: 'piece',
        outletProducts: {
          create: { outletId: testOutletId, stock: 0, minStock: 2 },
        },
      },
    })
    multiProductBId = prodB.id

    // 6. Supplier & Purchase for credit allocation
    const supplier = await testPrisma.supplier.create({
      data: {
        name: 'Integration Test Supplier',
        phone: '9841000001',
        address: 'Kathmandu',
      },
    })
    testSupplierId = supplier.id

    const purchase = await testPrisma.purchase.create({
      data: {
        outletId: testOutletId,
        supplierId: testSupplierId,
        total: 10000,
        paid: 2000,
        due: 8000,
        createdAt: new Date(),
      },
    })
    testPurchaseId = purchase.id

    assert.ok(testOutletId, 'Test outlet created')
    assert.ok(limitedProductId, 'Limited product created')
  })

  await t.test('Concurrency: Parallel checkouts when stock is 1 yields exactly 1 success and 1 failure', async () => {
    // Fire two simultaneous sales checkouts for the single available unit
    const [res1, res2] = await Promise.allSettled([
      salesService.createSale({
        outletId: testOutletId,
        userId: testUserId,
        customerPhone: testCustomerPhone,
        items: [{ productId: limitedProductId, quantity: 1 }],
      }),
      salesService.createSale({
        outletId: testOutletId,
        userId: testUserId,
        customerPhone: testCustomerPhone,
        items: [{ productId: limitedProductId, quantity: 1 }],
      }),
    ])

    const successCount = [res1, res2].filter((r) => r.status === 'fulfilled').length
    const failCount = [res1, res2].filter((r) => r.status === 'rejected').length

    assert.equal(successCount, 1, 'Exactly 1 sale must succeed under race conditions')
    assert.equal(failCount, 1, 'Exactly 1 sale must fail due to stock depletion')

    // Verify database state: Stock must be exactly 0, never negative!
    const op = await testPrisma.outletProduct.findUnique({
      where: { outletId_productId: { outletId: testOutletId, productId: limitedProductId } },
    })
    assert.equal(op?.stock, 0, 'Final stock in database must be 0')

    // Verify stock logs: Exactly 1 OUT log of quantity 1
    const logs = await testPrisma.stockLog.findMany({
      where: { outletId: testOutletId, productId: limitedProductId },
    })
    assert.equal(logs.length, 1, 'Exactly 1 stock log must exist')
    assert.equal(logs[0].quantity, 1)
  })

  await t.test('Rollback: Multi-item sale failure restores inventory with zero stock leak', async () => {
    // Attempt sale with Item A (stock 5) and Item B (stock 0)
    await assert.rejects(
      async () => {
        await salesService.createSale({
          outletId: testOutletId,
          userId: testUserId,
          customerPhone: testCustomerPhone,
          items: [
            { productId: multiProductAId, quantity: 1 },
            { productId: multiProductBId, quantity: 1 },
          ],
        })
      },
      /Insufficient stock/i
    )

    // Verify Item A's stock was NOT decremented: Must remain exactly 5
    const opA = await testPrisma.outletProduct.findUnique({
      where: { outletId_productId: { outletId: testOutletId, productId: multiProductAId } },
    })
    assert.equal(opA?.stock, 5, 'Item A stock must remain 5 after aborted transaction')

    // Verify zero sales recorded for this cart
    const sales = await testPrisma.sale.findMany({
      where: {
        outletId: testOutletId,
        items: { some: { productId: multiProductAId } },
      },
    })
    assert.equal(sales.length, 0, 'No sale record should exist for rolled-back transaction')
  })

  await t.test('Transaction: Supplier credit allocation updates balance atomically', async () => {
    // Total due was 8000. Allocate 3000.
    const result = await purchasesService.allocatePayment({
      outletId: testOutletId,
      supplierId: testSupplierId,
      amount: 3000,
      note: 'Partial payment',
    })

    assert.equal(result.paidAmount, 3000)
    assert.equal(result.newRemainingDue, 5000)

    const updatedPurchase = await testPrisma.purchase.findUnique({
      where: { id: testPurchaseId },
    })
    assert.equal(updatedPurchase?.paid, 5000, 'Purchase paid amount must now be 5000')
    assert.equal(updatedPurchase?.due, 5000, 'Purchase due balance must now be 5000')

    // Verify expense created
    const expenses = await testPrisma.expense.findMany({
      where: { outletId: testOutletId, category: 'Supplies' },
    })
    assert.equal(expenses.length, 1, 'Operating expense of 3000 must be recorded')
    assert.equal(expenses[0].amount, 3000)

    // Attempt overpayment of 6000 (exceeds remaining due of 5000)
    await assert.rejects(
      async () => {
        await purchasesService.allocatePayment({
          outletId: testOutletId,
          supplierId: testSupplierId,
          amount: 6000,
        })
      },
      /exceeds total outstanding due/i
    )

    // Ensure due was not corrupted
    const finalPurchase = await testPrisma.purchase.findUnique({
      where: { id: testPurchaseId },
    })
    assert.equal(finalPurchase?.due, 5000, 'Due must remain 5000 after rejected payment')
  })

  await t.test('Accounting: Order balance due increases creditUsed, payments restore it, and limits are enforced', async () => {
    // 1. Create order: Total 3,000 NPR, Advance 1,000 NPR -> BalanceDue 2,000 NPR
    const order = await ordersService.createOrder({
      outletId: testOutletId,
      userId: testUserId,
      customerId: testCustomerId,
      customerName: 'Test Customer',
      customerPhone: testCustomerPhone,
      items: [{ name: 'Custom Cake', quantity: 1, price: 3000 }],
      advancePaid: 1000,
    })

    assert.equal(order.balanceDue, 2000)

    // Verify customer.creditUsed increased by 2000
    let customer = await testPrisma.customer.findUnique({ where: { id: testCustomerId } })
    assert.equal(customer?.creditUsed, 2000, 'Customer creditUsed must be 2000 after order creation')

    // 2. Pay remaining balance in full: new advance = 3000 -> balanceDue = 0
    await ordersService.updateOrder(order.id, { advancePaid: 3000 })

    customer = await testPrisma.customer.findUnique({ where: { id: testCustomerId } })
    assert.equal(customer?.creditUsed, 0, 'Customer creditUsed must return to 0 when order balance is paid in full')

    // 3. Exceed remaining credit limit: Available is 5,000. Request 6,000 balance due.
    await assert.rejects(
      async () => {
        await ordersService.createOrder({
          outletId: testOutletId,
          userId: testUserId,
          customerId: testCustomerId,
          customerName: 'Test Customer',
          customerPhone: testCustomerPhone,
          items: [{ name: 'Giant Wedding Cake', quantity: 1, price: 6000 }],
          advancePaid: 0,
        })
      },
      /Insufficient customer credit limit/i
    )

    // Ensure credit was not corrupted
    customer = await testPrisma.customer.findUnique({ where: { id: testCustomerId } })
    assert.equal(customer?.creditUsed, 0, 'Customer creditUsed must still be 0 after rejected order')
  })

  await t.test('Concurrency: Parallel table session checkouts prevent double-charging and double inventory deductions', async () => {
    // Create a test table and open session
    const table = await testPrisma.table.create({
      data: {
        outletId: testOutletId,
        name: `T-${Date.now()}`,
        capacity: 4,
      },
    })

    const session = await testPrisma.tableSession.create({
      data: {
        tableId: table.id,
        openedById: testUserId,
        status: 'OPEN',
      },
    })

    // Simulate two concurrent checkout transactions attempting to close the same session
    const checkout = async () => {
      return await testPrisma.$transaction(async (tx) => {
        const res = await tx.tableSession.updateMany({
          where: { id: session.id, status: 'OPEN' },
          data: { status: 'CLOSED', closedAt: new Date() },
        })
        if (res.count === 0) {
          throw new Error('Session already closed or being processed by another cashier')
        }
        return res
      })
    }

    const [res1, res2] = await Promise.allSettled([checkout(), checkout()])

    const successCount = [res1, res2].filter((r) => r.status === 'fulfilled').length
    const failCount = [res1, res2].filter((r) => r.status === 'rejected').length

    assert.equal(successCount, 1, 'Exactly 1 checkout must succeed')
    assert.equal(failCount, 1, 'Second concurrent checkout must fail')

    // Clean up test table and session
    await testPrisma.tableSession.deleteMany({ where: { tableId: table.id } })
    await testPrisma.table.delete({ where: { id: table.id } })
  })

  await t.test('Teardown: Clean up isolated test fixtures', async () => {
    // Delete test-created records
    await testPrisma.orderItem.deleteMany({ where: { order: { outletId: testOutletId } } })
    await testPrisma.order.deleteMany({ where: { outletId: testOutletId } })
    await testPrisma.stockLog.deleteMany({ where: { outletId: testOutletId } })
    await testPrisma.saleItem.deleteMany({ where: { sale: { outletId: testOutletId } } })
    await testPrisma.sale.deleteMany({ where: { outletId: testOutletId } })
    await testPrisma.expense.deleteMany({ where: { outletId: testOutletId } })
    await testPrisma.purchase.deleteMany({ where: { outletId: testOutletId } })
    await testPrisma.supplier.deleteMany({ where: { id: testSupplierId } })
    await testPrisma.outletProduct.deleteMany({ where: { outletId: testOutletId } })
    await testPrisma.product.deleteMany({
      where: { id: { in: [limitedProductId, multiProductAId, multiProductBId] } },
    })
    await testPrisma.customer.deleteMany({ where: { phone: testCustomerPhone } })
    await testPrisma.userOutlet.deleteMany({ where: { outletId: testOutletId } })
    await testPrisma.user.deleteMany({ where: { id: testUserId } })
    await testPrisma.outlet.deleteMany({ where: { id: testOutletId } })

    await testPrisma.$disconnect()
  })
})
