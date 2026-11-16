/**
 * In-Process API Security, RBAC & Outlet Scope Matrix Test Suite
 * -------------------------------------------------------------
 * Tests route handlers directly in memory with ZERO database mutations.
 * Injects an in-memory mock Prisma Client so tests execute with 100%
 * isolation, zero network reliance, and zero risk of database pollution.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { setPrismaClient } from '../lib/prisma'

// 1. Inject in-memory Prisma mock BEFORE importing routes
const mockPrisma: any = {
  userOutlet: {
    findUnique: async ({ where }: any) => {
      // Ramesh (userId: 4) is assigned ONLY to Outlet 2
      if (where?.userId_outletId?.userId === 4 && where?.userId_outletId?.outletId === 2) {
        return { userId: 4, outletId: 2 }
      }
      return null
    },
    findFirst: async () => ({ outletId: 2 }),
  },
  outlet: {
    findFirst: async () => ({ id: 1, active: true }),
    findUnique: async () => ({ id: 1, active: true }),
    findMany: async () => [{ id: 1, active: true }, { id: 2, active: true }],
  },
  customer: {
    findUnique: async ({ where }: any) => (where?.id === 999999 ? null : { id: where?.id, name: 'Mock Customer' }),
    findMany: async () => [],
  },
  product: {
    findUnique: async ({ where }: any) => (where?.id === 999999 ? null : { id: where?.id, name: 'Mock Product', price: 100, costPrice: 50, recipeItems: [] }),
    findMany: async () => [],
  },
  outletProduct: {
    findUnique: async () => null,
    updateMany: async () => ({ count: 0 }),
  },
  table: {
    findUnique: async ({ where }: any) => (where?.id === 999999 ? null : { id: where?.id, outletId: 1, name: 'Table 1' }),
    findMany: async () => [],
  },
  order: {
    findUnique: async ({ where }: any) => (where?.id === 999999 ? null : { id: where?.id, outletId: 1, orderNumber: 'SEK-0001' }),
    findMany: async () => [],
    count: async () => 0,
  },
  category: {
    findMany: async () => [],
  },
  user: {
    findFirst: async () => ({ id: 1, active: true }),
    findUnique: async ({ where }: any) => (where?.id === 999999 ? null : { id: where?.id, role: 'STAFF', name: 'User', active: true }),
    findMany: async () => [],
  },
  sale: {
    findMany: async () => [],
    aggregate: async () => ({ _sum: { total: 0 }, _count: 0 }),
  },
  tableSession: {
    findMany: async () => [],
    aggregate: async () => ({ _sum: { grandTotal: 0 }, _count: 0 }),
  },
  purchase: {
    findMany: async () => [],
  },
  expense: {
    findMany: async () => [],
  },
  supplier: {
    findMany: async () => [],
    findUnique: async () => ({ id: 1, name: 'Supplier' }),
  },
  $transaction: async (fn: any) => {
    if (typeof fn === 'function') return await fn(mockPrisma)
    return []
  },
}

;(globalThis as any).prisma = mockPrisma
setPrismaClient(mockPrisma)

// 2. Now import auth & route handlers (they will bind to our in-memory mock)
import { signToken } from '../lib/auth'
import { DEFAULT_PERMISSIONS, Permissions } from '../lib/permissions'

import categoriesHandler from '../pages/api/categories/index'
import productsHandler from '../pages/api/products/index'
import productDetailHandler from '../pages/api/products/[id]'
import purchasesHandler from '../pages/api/purchases/index'
import salesHandler from '../pages/api/sales/index'
import expensesHandler from '../pages/api/expenses/index'
import dashboardHandler from '../pages/api/dashboard'
import reportsHandler from '../pages/api/reports'
import customersHandler from '../pages/api/customers/index'
import customerDetailHandler from '../pages/api/customers/[id]'
import tablesHandler from '../pages/api/tables/index'
import tableDetailHandler from '../pages/api/tables/[id]'
import ordersHandler from '../pages/api/orders/index'
import orderDetailHandler from '../pages/api/orders/[id]'
import usersHandler from '../pages/api/users/index'
import setupHandler from '../pages/api/setup'
import stockAdjustHandler from '../pages/api/products/stock-adjust'
import tableSessionsHandler from '../pages/api/table-sessions/index'
import tableSessionDetailHandler from '../pages/api/table-sessions/[id]'

// In-memory request / response mock helper
function createMockReqRes({
  method = 'GET',
  headers = {},
  query = {},
  body = null,
}: {
  method?: string
  headers?: Record<string, string>
  query?: Record<string, unknown>
  body?: any
}) {
  const req: any = {
    method,
    headers: { ...headers },
    query: { ...query },
    body,
    cookies: {},
  }

  const res: any = {
    statusCode: 200,
    headers: {},
    _json: null,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(data: any) {
      this._json = data
      return this
    },
    setHeader(key: string, val: string) {
      this.headers[key] = val
      return this
    },
    end() {
      return this
    },
  }

  return { req, res }
}

// Generate tokens for test personas
const zeroPermToken = signToken({
  userId: 4,
  email: 'ramesh@dybala.com',
  role: 'STAFF',
  name: 'Ramesh Adhikari',
  permissions: { ...DEFAULT_PERMISSIONS },
})

const viewOnlyPerms: Permissions = {
  ...DEFAULT_PERMISSIONS,
  inventory: { view: true, edit: false, delete: false },
  pos: { view: true, edit: false, delete: false },
  expenses: { view: true, edit: false, delete: false },
  customers: { view: true, edit: false, delete: false },
  orders: { view: true, edit: false, delete: false },
  tables: { view: true, edit: false, delete: false },
  dashboard: { view: true, edit: false, delete: false },
  reports: { view: true, edit: false, delete: false },
  users: { view: false, edit: false, delete: false },
}

const viewOnlyToken = signToken({
  userId: 4,
  email: 'ramesh@dybala.com',
  role: 'STAFF',
  name: 'Ramesh Adhikari',
  permissions: viewOnlyPerms,
})

const adminToken = signToken({
  userId: 1,
  email: 'admin@dybala.com',
  role: 'SUPER_ADMIN',
  name: 'Super Admin',
  permissions: { ...DEFAULT_PERMISSIONS },
})

test('Security Matrix: Unauthenticated calls receive 401 across protected handlers', async () => {
  const handlers = [
    { name: 'categories', handler: categoriesHandler },
    { name: 'products', handler: productsHandler },
    { name: 'purchases', handler: purchasesHandler },
    { name: 'sales', handler: salesHandler },
    { name: 'dashboard', handler: dashboardHandler },
    { name: 'reports', handler: reportsHandler },
    { name: 'customers', handler: customersHandler },
    { name: 'expenses', handler: expensesHandler },
    { name: 'orders', handler: ordersHandler },
    { name: 'tables', handler: tablesHandler },
    { name: 'users', handler: usersHandler },
  ]

  for (const { name, handler } of handlers) {
    const { req, res } = createMockReqRes({ method: 'GET' })
    await handler(req, res)
    assert.equal(res.statusCode, 401, `${name} must return 401 when unauthenticated`)
  }
})

test('Security Matrix: Zero-permission staff user is denied 403 on read routes', async () => {
  const zeroPermRoutes = [
    { name: 'categories', handler: categoriesHandler, query: {} },
    { name: 'products', handler: productsHandler, query: {} },
    { name: 'purchases', handler: purchasesHandler, query: {} },
    { name: 'sales', handler: salesHandler, query: {} },
    { name: 'customers', handler: customersHandler, query: {} },
    { name: 'expenses', handler: expensesHandler, query: {} },
    { name: 'dashboard', handler: dashboardHandler, query: {} },
    { name: 'reports', handler: reportsHandler, query: { type: 'sales' } },
    { name: 'users', handler: usersHandler, query: {} },
    { name: 'orders', handler: ordersHandler, query: {} },
    { name: 'tables', handler: tablesHandler, query: {} },
    { name: 'table-sessions', handler: tableSessionsHandler, query: {} },
  ]

  for (const { name, handler, query } of zeroPermRoutes) {
    const { req, res } = createMockReqRes({
      method: 'GET',
      headers: { authorization: `Bearer ${zeroPermToken}`, 'x-outlet-id': '2' },
      query,
    })
    await handler(req, res)
    assert.equal(res.statusCode, 403, `${name} must return 403 for zero-permission staff account`)
  }
})

test('Security Matrix: View-only user is denied 403 when attempting writes', async () => {
  const writeAttempts = [
    { name: 'create category', handler: categoriesHandler, method: 'POST', body: { name: 'X' } },
    { name: 'create product', handler: productsHandler, method: 'POST', body: { name: 'X' } },
    { name: 'update product', handler: productDetailHandler, method: 'PUT', query: { id: 1 }, body: { name: 'X' } },
    { name: 'delete product', handler: productDetailHandler, method: 'DELETE', query: { id: 1 } },
    { name: 'create sale', handler: salesHandler, method: 'POST', body: { items: [{ productId: 1, quantity: 1 }] } },
    { name: 'create expense', handler: expensesHandler, method: 'POST', body: { category: 'X', amount: 10 } },
    { name: 'create customer', handler: customersHandler, method: 'POST', body: { name: 'X' } },
    { name: 'create order', handler: ordersHandler, method: 'POST', body: { customerName: 'X', items: [{ name: 'X', price: 10 }] } },
    { name: 'create table', handler: tablesHandler, method: 'POST', body: { name: 'X' } },
    { name: 'create purchase', handler: purchasesHandler, method: 'POST', body: { supplierId: 1, total: 10 } },
  ]

  for (const { name, handler, method, query = {}, body = null } of writeAttempts) {
    const { req, res } = createMockReqRes({
      method,
      headers: { authorization: `Bearer ${viewOnlyToken}`, 'x-outlet-id': '2' },
      query,
      body,
    })
    await handler(req, res)
    assert.equal(res.statusCode, 403, `${name} must return 403 for view-only account`)
  }
})

test('Security Matrix: Cross-outlet requests fail-closed with 403 Forbidden', async () => {
  // Ramesh is assigned to Outlet 2 only. Requesting Outlet 1 must fail closed.
  const crossOutletRoutes = [
    { name: 'dashboard', handler: dashboardHandler, query: {} },
    { name: 'reports', handler: reportsHandler, query: { type: 'sales' } },
    { name: 'products', handler: productsHandler, query: {} },
    { name: 'sales', handler: salesHandler, query: {} },
    { name: 'orders', handler: ordersHandler, query: {} },
    { name: 'expenses', handler: expensesHandler, query: {} },
    { name: 'tables', handler: tablesHandler, query: {} },
    { name: 'table-sessions', handler: tableSessionsHandler, query: {} },
    { name: 'purchases', handler: purchasesHandler, query: {} },
  ]

  for (const { name, handler, query } of crossOutletRoutes) {
    const { req, res } = createMockReqRes({
      method: 'GET',
      headers: { authorization: `Bearer ${viewOnlyToken}`, 'x-outlet-id': '1' }, // Outlet 1 is unassigned!
      query,
    })
    await handler(req, res)
    assert.equal(res.statusCode, 403, `${name} must return 403 when requesting an unassigned outlet`)
    assert.match(
      res._json?.error || '',
      /Forbidden|not assigned/i,
      `${name} error message must indicate forbidden outlet access`
    )
  }
})

test('Security Matrix: Deactivated user accounts are denied 401 across all protected routes', async () => {
  // Sign a token for a user that is deactivated in the database
  const deactivatedToken = signToken({
    userId: 888,
    email: 'inactive@dybala.com',
    role: 'STAFF',
    name: 'Inactive Employee',
    permissions: { ...DEFAULT_PERMISSIONS },
  })

  // Mock inactive user lookup
  const origFindUnique = mockPrisma.user.findUnique
  mockPrisma.user.findUnique = async ({ where }: any) => {
    if (where?.id === 888) {
      return { id: 888, active: false, role: 'STAFF' }
    }
    return origFindUnique({ where })
  }

  try {
    const { req, res } = createMockReqRes({
      method: 'GET',
      headers: { authorization: `Bearer ${deactivatedToken}`, 'x-outlet-id': '2' },
    })
    await dashboardHandler(req, res)

    assert.equal(res.statusCode, 401, 'Deactivated user token must be denied with 401 Unauthorized')
    assert.match(res._json?.error || '', /inactive or revoked/i)
  } finally {
    mockPrisma.user.findUnique = origFindUnique
  }
})

test('Security Matrix: Nonexistent record updates/deletions return 404', async () => {
  // Customer 999999
  const { req: cReq, res: cRes } = createMockReqRes({
    method: 'PUT',
    headers: { authorization: `Bearer ${adminToken}` },
    query: { id: 999999 },
    body: { name: 'Ghost' },
  })
  await customerDetailHandler(cReq, cRes)
  assert.equal(cRes.statusCode, 404, 'PUT /api/customers/999999 must return 404')

  // Product 999999 (PUT & DELETE)
  const { req: pPutReq, res: pPutRes } = createMockReqRes({
    method: 'PUT',
    headers: { authorization: `Bearer ${adminToken}` },
    query: { id: 999999 },
    body: { name: 'Ghost' },
  })
  await productDetailHandler(pPutReq, pPutRes)
  assert.equal(pPutRes.statusCode, 404, 'PUT /api/products/999999 must return 404')

  const { req: pDelReq, res: pDelRes } = createMockReqRes({
    method: 'DELETE',
    headers: { authorization: `Bearer ${adminToken}` },
    query: { id: 999999 },
  })
  await productDetailHandler(pDelReq, pDelRes)
  assert.equal(pDelRes.statusCode, 404, 'DELETE /api/products/999999 must return 404')

  // Table 999999 (PUT & DELETE)
  const { req: tPutReq, res: tPutRes } = createMockReqRes({
    method: 'PUT',
    headers: { authorization: `Bearer ${adminToken}` },
    query: { id: 999999 },
    body: { capacity: 4 },
  })
  await tableDetailHandler(tPutReq, tPutRes)
  assert.equal(tPutRes.statusCode, 404, 'PUT /api/tables/999999 must return 404')

  // Order 999999 (GET)
  const { req: oGetReq, res: oGetRes } = createMockReqRes({
    method: 'GET',
    headers: { authorization: `Bearer ${adminToken}` },
    query: { id: 999999 },
  })
  await orderDetailHandler(oGetReq, oGetRes)
  assert.equal(oGetRes.statusCode, 404, 'GET /api/orders/999999 must return 404')
})

test('Security Matrix: Production setup guard returns 403 on unauthenticated POST', async () => {
  const originalEnv = process.env.NODE_ENV
  ;(process.env as any).NODE_ENV = 'production'
  delete process.env.ENABLE_SETUP_ENDPOINT

  try {
    const { req, res } = createMockReqRes({
      method: 'POST',
      body: {},
    })
    await setupHandler(req, res)
    assert.equal(res.statusCode, 403, 'POST /api/setup must return 403 in production')
    assert.match(res._json?.error || '', /disabled in production/i)
  } finally {
    ;(process.env as any).NODE_ENV = originalEnv
  }
})

test('Financial & Inventory Integrity: Rejects negative prices, negative stock, and invalid adjustments', async () => {
  // 1. Negative price in product creation
  const { req: pNegReq, res: pNegRes } = createMockReqRes({
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'x-outlet-id': '1' },
    body: { name: 'Bad Price Item', price: -50 },
  })
  await productsHandler(pNegReq, pNegRes)
  assert.equal(pNegRes.statusCode, 400)
  assert.match(pNegRes._json?.error || '', /price must be a non-negative number/i)

  // 2. Negative cost price in product creation
  const { req: cNegReq, res: cNegRes } = createMockReqRes({
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'x-outlet-id': '1' },
    body: { name: 'Bad Cost Item', price: 100, costPrice: -20 },
  })
  await productsHandler(cNegReq, cNegRes)
  assert.equal(cNegRes.statusCode, 400)
  assert.match(cNegRes._json?.error || '', /cost price must be a non-negative number/i)

  // 3. Negative stock in product creation
  const { req: sNegReq, res: sNegRes } = createMockReqRes({
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'x-outlet-id': '1' },
    body: { name: 'Bad Stock Item', price: 100, stock: -5 },
  })
  await productsHandler(sNegReq, sNegRes)
  assert.equal(sNegRes.statusCode, 400)
  assert.match(sNegRes._json?.error || '', /stock must be a non-negative number/i)

  // 4. Negative price in product update
  const { req: puNegReq, res: puNegRes } = createMockReqRes({
    method: 'PUT',
    headers: { authorization: `Bearer ${adminToken}`, 'x-outlet-id': '1' },
    query: { id: 1 },
    body: { price: -10 },
  })
  await productDetailHandler(puNegReq, puNegRes)
  assert.equal(puNegRes.statusCode, 400)
  assert.match(puNegRes._json?.error || '', /price must be a non-negative number/i)

  // 5. Stock adjust: Negative quantity
  const { req: saNegReq, res: saNegRes } = createMockReqRes({
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'x-outlet-id': '1' },
    body: { productId: 1, type: 'OUT', quantity: -5 },
  })
  await stockAdjustHandler(saNegReq, saNegRes)
  assert.equal(saNegRes.statusCode, 400)
  assert.match(saNegRes._json?.error || '', /quantity must be non-negative/i)

  // 6. Stock adjust: Zero quantity for OUT movement
  const { req: saZeroReq, res: saZeroRes } = createMockReqRes({
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'x-outlet-id': '1' },
    body: { productId: 1, type: 'OUT', quantity: 0 },
  })
  await stockAdjustHandler(saZeroReq, saZeroRes)
  assert.equal(saZeroRes.statusCode, 400)
  assert.match(saZeroRes._json?.error || '', /quantity must be greater than zero/i)

  // 7. Negative expense amount
  const { req: eNegReq, res: eNegRes } = createMockReqRes({
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'x-outlet-id': '1' },
    body: { category: 'Utilities', amount: -250 },
  })
  await expensesHandler(eNegReq, eNegRes)
  assert.equal(eNegRes.statusCode, 400)
  assert.match(eNegRes._json?.error || '', /amount must be a positive number/i)
})

test('Profit Calculations: Sales report accurately aggregates POS & table revenue, discounts, costs, and profit', async () => {
  // Mock sales data for report
  mockPrisma.sale.findMany = async () => [
    {
      id: 101,
      total: 500, // net total
      discount: 50,
      items: [
        { quantity: 2, product: { costPrice: 150 } }, // cost = 300
      ],
      user: { name: 'Admin' },
      customer: { name: 'Customer A' },
    },
    {
      id: 102,
      total: 300,
      discount: 0,
      items: [
        { quantity: 1, product: { costPrice: 100 } }, // cost = 100
      ],
      user: { name: 'Admin' },
      customer: { name: 'Customer B' },
    },
  ]

  mockPrisma.tableSession.findMany = async () => [
    {
      id: 201,
      grandTotal: 1000,
      discount: 100,
      table: { name: 'Table 1' },
      openedBy: { name: 'Staff' },
      orders: [
        {
          items: [
            { quantity: 4, product: { costPrice: 100 } }, // cost = 400
          ],
        },
      ],
    },
  ]

  const { req, res } = createMockReqRes({
    method: 'GET',
    headers: { authorization: `Bearer ${adminToken}`, 'x-outlet-id': '1' },
    query: { type: 'sales' },
  })

  await reportsHandler(req, res)

  assert.equal(res.statusCode, 200)
  const report = res._json

  assert.equal(report.posRevenue, 800, 'POS Revenue must equal sum of POS sale totals (500 + 300 = 800)')
  assert.equal(report.posDiscount, 50, 'POS Discount must equal 50')
  assert.equal(report.posCost, 400, 'POS Cost must equal (2*150 + 1*100 = 400)')

  assert.equal(report.tableRevenue, 1000, 'Table Revenue must equal 1000')
  assert.equal(report.tableDiscount, 100, 'Table Discount must equal 100')
  assert.equal(report.tableCost, 400, 'Table Cost must equal 400')

  assert.equal(report.totalRevenue, 1800, 'Total Revenue must equal 800 + 1000 = 1800')
  assert.equal(report.totalDiscount, 150, 'Total Discount must equal 50 + 100 = 150')
  assert.equal(report.totalCost, 800, 'Total Cost must equal 400 + 400 = 800')
  assert.equal(report.totalProfit, 1000, 'Gross Profit must equal Revenue (1800) - COGS (800) = 1000')
})
