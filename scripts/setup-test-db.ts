import { execSync } from 'child_process'
import fs from 'fs'

// Load .env.test configuration
if (fs.existsSync('.env.test')) {
  process.loadEnvFile?.('.env.test')
}

const testDbUrl = process.env.DATABASE_URL || 'mysql://root:dybala123@localhost:3307/dybala_bms_test'

console.log(`[Test DB Setup] Deploying migrations to disposable test database: ${testDbUrl}`)

try {
  execSync(`npx prisma migrate deploy`, {
    env: { ...process.env, DATABASE_URL: testDbUrl },
    stdio: 'inherit',
  })
  console.log('[Test DB Setup] Migrations deployed successfully.')
} catch (error) {
  console.error('[Test DB Setup] Failed to deploy migrations:', error)
  process.exit(1)
}
