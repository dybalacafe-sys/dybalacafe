/**
 * Live Docker Smoke Test Suite (Strictly Non-Destructive & Read-Only)
 * ------------------------------------------------------------------
 * Verifies live container wiring, HTTP routing, and security guards
 * at http://localhost:3000 WITHOUT performing any database writes or
 * mutating seeded records.
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'

interface TestResult {
  route: string
  method: string
  status: number
  expectedStatus: number | number[]
  pass: boolean
  latencyMs: number
  notes: string
}

const results: TestResult[] = []

async function runTest(
  name: string,
  method: string,
  path: string,
  headers: Record<string, string>,
  body: any | null,
  expectedStatus: number | number[],
  customValidator?: (data: any, status: number) => { pass: boolean; note?: string }
): Promise<{ status: number; data: any; pass: boolean }> {
  const start = performance.now()
  let status = 0
  let data: any = null
  let pass = false
  let note = ''

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })

    status = res.status
    const text = await res.text()
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }

    const expectedArr = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus]
    const statusMatch = expectedArr.includes(status)

    if (!statusMatch) {
      pass = false
      note = `Status mismatch: expected ${expectedArr.join('/')}, got ${status}`
    } else if (customValidator) {
      const validation = customValidator(data, status)
      pass = validation.pass
      note = validation.note || (pass ? 'OK' : 'Validation failed')
    } else {
      pass = true
      note = 'OK'
    }
  } catch (err: any) {
    status = 0
    note = `Network Error: ${err.message}`
  }

  const latencyMs = Math.round(performance.now() - start)
  results.push({
    route: path,
    method,
    status,
    expectedStatus,
    pass,
    latencyMs,
    notes: note,
  })

  return { status, data, pass }
}

async function main() {
  console.log(`\n=================================================================`)
  console.log(`  Dybala BMS: Read-Only Live Docker Smoke Test Suite              `)
  console.log(`  Target: ${BASE_URL} (100% Non-Destructive)                      `)
  console.log(`=================================================================\n`)

  // 1. Health Probe
  console.log('1. Health Probe...')
  await runTest('Health Check', 'GET', '/api/health', {}, null, 200)

  // 2. Authentication & Setup Production Guard
  console.log('2. Authentication & Setup Guards...')
  await runTest('Login (Invalid Credentials)', 'POST', '/api/auth/login', {}, { email: 'invalid@dybala.com', password: 'wrong' }, 401)

  const adminLogin = await runTest(
    'Login (Super Admin)',
    'POST',
    '/api/auth/login',
    {},
    { email: 'admin@dybala.com', password: 'admin123' },
    200
  )
  const adminToken = adminLogin.data?.token || ''
  const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'x-outlet-id': '1' }

  await runTest('Auth Me (Unauthenticated)', 'GET', '/api/auth/me', {}, null, 401)
  await runTest('Auth Me (Authenticated)', 'GET', '/api/auth/me', adminHeaders, null, 200)

  // Setup production protection guards:
  await runTest('Setup GET (Method not allowed)', 'GET', '/api/setup', {}, null, 405)
  await runTest(
    'Setup POST Unauthenticated (Production Guard 403)',
    'POST',
    '/api/setup',
    {},
    { dummy: true },
    403,
    (data) => ({
      pass: data?.error?.includes('disabled in production'),
      note: data?.error || 'Setup properly blocked with 403',
    })
  )

  // 3. Outlets & POS Terminals
  console.log('3. Outlets & Terminals...')
  const outletsRes = await runTest('Outlets List', 'GET', '/api/outlets', adminHeaders, null, 200)
  const outletId = outletsRes.data?.[0]?.id || 1

  // 4. Catalog & Categories (Read-Only)
  console.log('4. Categories & Products...')
  await runTest('Categories List', 'GET', '/api/categories', adminHeaders, null, 200)
  const prodsRes = await runTest('Products List', 'GET', '/api/products', adminHeaders, null, 200)
  const firstProdId = prodsRes.data?.[0]?.id || 1
  await runTest('Product by ID (GET)', 'GET', `/api/products/${firstProdId}`, adminHeaders, null, 200)

  // Nonexistent product guards (404)
  await runTest('Update Nonexistent Product (PUT 404)', 'PUT', '/api/products/999999', adminHeaders, { name: 'Ghost' }, 404)
  await runTest('Delete Nonexistent Product (DELETE 404)', 'DELETE', '/api/products/999999', adminHeaders, null, 404)
  await runTest('Production Catalog (GET)', 'GET', '/api/production', adminHeaders, null, 200)

  // 5. Customers & Credit Ledger (Read-Only)
  console.log('5. Customers & Credit Ledger...')
  const custRes = await runTest('Customers List (GET)', 'GET', '/api/customers', adminHeaders, null, 200)
  const firstCust = custRes.data?.[0]
  if (firstCust) {
    await runTest('Customer by ID (GET)', 'GET', `/api/customers/${firstCust.id}`, adminHeaders, null, 200)
    if (firstCust.phone) {
      await runTest('Customer Lookup by Phone (GET)', 'GET', `/api/customers/lookup?phone=${firstCust.phone}`, adminHeaders, null, 200)
    }
    await runTest('Customer Ledger (GET)', 'GET', `/api/customers/${firstCust.id}/ledger`, adminHeaders, null, 200)
  }
  await runTest('Update Nonexistent Customer (PUT 404)', 'PUT', '/api/customers/999999', adminHeaders, { name: 'Ghost' }, 404)

  // 6. Dine-in Tables & Sessions (Read-Only)
  console.log('6. Tables & Table Sessions...')
  await runTest('Tables List (GET)', 'GET', '/api/tables', adminHeaders, null, 200)
  await runTest('Table Sessions List (GET)', 'GET', '/api/table-sessions', adminHeaders, null, 200)
  await runTest('Update Nonexistent Table (PUT 404)', 'PUT', '/api/tables/999999', adminHeaders, { capacity: 4 }, 404)
  await runTest('Delete Nonexistent Table (DELETE 404)', 'DELETE', '/api/tables/999999', adminHeaders, null, 404)

  // 7. POS Sales & Pre-Orders (Read-Only)
  console.log('7. Sales & Orders...')
  await runTest('Sales List (GET)', 'GET', '/api/sales', adminHeaders, null, 200)
  await runTest('Orders List (GET)', 'GET', '/api/orders', adminHeaders, null, 200)
  await runTest('Order Nonexistent (GET 404)', 'GET', '/api/orders/999999', adminHeaders, null, 404)

  // 8. Operating Expenses (Read-Only)
  console.log('8. Expenses...')
  await runTest('Expenses List (GET)', 'GET', '/api/expenses', adminHeaders, null, 200)

  // 9. Vendor Suppliers & Purchases (Read-Only)
  console.log('9. Suppliers & Purchases...')
  await runTest('Suppliers List (GET)', 'GET', '/api/suppliers', adminHeaders, null, 200)
  await runTest('Purchases List (GET)', 'GET', '/api/purchases', adminHeaders, null, 200)

  // 10. Dashboard & Analytics (Read-Only)
  console.log('10. Dashboard & Reports...')
  await runTest('Dashboard (GET)', 'GET', '/api/dashboard', adminHeaders, null, 200)
  await runTest('Sales Report (GET)', 'GET', '/api/reports?type=sales', adminHeaders, null, 200)
  await runTest('Stock Report (GET)', 'GET', '/api/reports?type=stock', adminHeaders, null, 200)
  await runTest('Orders Report (GET)', 'GET', '/api/reports?type=orders', adminHeaders, null, 200)
  await runTest('Product Sales Report (GET)', 'GET', '/api/reports?type=product-sales', adminHeaders, null, 200)
  await runTest('Daily Chart Report (GET)', 'GET', '/api/reports?type=daily-chart', adminHeaders, null, 200)
  await runTest('Table Sessions Report (GET)', 'GET', '/api/reports?type=table-sessions', adminHeaders, null, 200)
  await runTest('Invalid Report Validation (GET 400)', 'GET', '/api/reports?type=invalid', adminHeaders, null, 400)

  // 11. User Management (Read-Only & 404 guards)
  console.log('11. User Management...')
  await runTest('Users List (GET)', 'GET', '/api/users', adminHeaders, null, 200)
  await runTest('Update Nonexistent User (PUT 404)', 'PUT', '/api/users/999999', adminHeaders, { name: 'Ghost' }, 404)
  await runTest('Delete Nonexistent User (DELETE 404)', 'DELETE', '/api/users/999999', adminHeaders, null, 404)

  // 12. Security & RBAC Regression Checks (Zero DB Writes)
  console.log('12. Staff RBAC & Outlet Isolation Checks...')
  const staffLogin = await runTest(
    'Login (Staff - Ramesh)',
    'POST',
    '/api/auth/login',
    {},
    { email: 'ramesh@dybala.com', password: 'staff123' },
    200
  )
  const staffToken = staffLogin.data?.token || ''
  const staffHeadersSekuwa = { Authorization: `Bearer ${staffToken}`, 'x-outlet-id': '2' }
  const staffHeadersCafeForbidden = { Authorization: `Bearer ${staffToken}`, 'x-outlet-id': '1' }

  // Fail-closed checks on unassigned outlet
  await runTest('Outlet Isolation: Dashboard (Staff forbidden on unassigned outlet)', 'GET', '/api/dashboard', staffHeadersCafeForbidden, null, 403)
  await runTest('Outlet Isolation: Reports (Staff forbidden on unassigned outlet)', 'GET', '/api/reports?type=sales', staffHeadersCafeForbidden, null, 403)
  await runTest('Outlet Isolation: Products (Staff forbidden on unassigned outlet)', 'GET', '/api/products', staffHeadersCafeForbidden, null, 403)
  await runTest('Outlet Isolation: Sales (Staff forbidden on unassigned outlet)', 'GET', '/api/sales', staffHeadersCafeForbidden, null, 403)

  // Zero-permission staff denials
  await runTest('Zero-Permission: Categories (403)', 'GET', '/api/categories', staffHeadersSekuwa, null, 403)
  await runTest('Zero-Permission: Products (403)', 'GET', '/api/products', staffHeadersSekuwa, null, 403)
  await runTest('Zero-Permission: Purchases (403)', 'GET', '/api/purchases', staffHeadersSekuwa, null, 403)
  await runTest('Zero-Permission: Users (403)', 'GET', '/api/users', staffHeadersSekuwa, null, 403)

  // Summary Reporting
  console.log(`\n=================================================================`)
  console.log(`  Live Read-Only Smoke Test Results Summary                      `)
  console.log(`=================================================================\n`)

  const passed = results.filter((r) => r.pass).length
  const failed = results.filter((r) => !r.pass).length

  for (const r of results) {
    const icon = r.pass ? '✔ PASS' : '❌ FAIL'
    const expected = Array.isArray(r.expectedStatus) ? r.expectedStatus.join('/') : r.expectedStatus
    console.log(`${icon} [${r.method.padEnd(6)}] ${r.route.padEnd(42)} -> ${r.status} (Exp: ${expected}) [${r.latencyMs}ms] ${r.notes !== 'OK' ? `(${r.notes})` : ''}`)
  }

  console.log(`\nTotal Smoke Checks: ${results.length}`)
  console.log(`Passed: ${passed}`)
  console.log(`Failed: ${failed}`)

  if (failed > 0) {
    console.error(`\n❌ ${failed} smoke checks failed!`)
    process.exit(1)
  } else {
    console.log(`\n🎉 All live read-only checks passed with 100% success! No database records were modified.`)
  }
}

main().catch((err) => {
  console.error('Fatal execution error:', err)
  process.exit(1)
})
