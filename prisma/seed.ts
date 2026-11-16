/**
 * Master Database Seeder Orchestrator
 * -----------------------------------------------------------------
 * Coordinates modular domain seeders in sequential order:
 *  1. Outlets & POS Terminals    (prisma/seeds/01-outlets.ts)
 *  2. User Accounts & Access    (prisma/seeds/02-users.ts)
 *  3. Inventory, Recipes & Stock (prisma/seeds/03-inventory.ts)
 *  4. Demo & Operational Data    (prisma/seeds/04-demo-data.ts)
 */
import { PrismaClient } from '@prisma/client'
import { seedOutlets } from './seeds/01-outlets'
import { seedUsers } from './seeds/02-users'
import { seedInventory } from './seeds/03-inventory'
import { seedDemoData } from './seeds/04-demo-data'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Starting Modular Database Seeding Pipeline...\n')
  const startTime = Date.now()

  try {
    // Phase 1: Infrastructure & Outlets
    await seedOutlets(prisma)
    console.log('')

    // Phase 2: User Accounts & Credentials
    await seedUsers(prisma)
    console.log('')

    // Phase 3: Catalog, Recipes & Baseline Stock
    await seedInventory(prisma)
    console.log('')

    // Phase 4: Mock Transactions, Sessions & Demo Data
    await seedDemoData(prisma)
    console.log('')

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`✨ All seed modules completed successfully in ${duration}s!`)
  } catch (error) {
    console.error('❌ Seeding pipeline encountered an error:', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
