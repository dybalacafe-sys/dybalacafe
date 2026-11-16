/**
 * Seed Outlets & Terminals
 * -------------------------------------------------------------
 * Sets up Outlet Types, Outlets (Cafe, Sekuwa), and POS Terminals.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function seedOutlets(client: PrismaClient = prisma) {
  console.log('🏪 Seeding Outlets & Terminals...')

  const cafeType = await client.outletType.upsert({
    where: { code: 'CAFE' },
    update: {},
    create: { name: 'Cafe & Bakery', code: 'CAFE' },
  })

  const sekuwaType = await client.outletType.upsert({
    where: { code: 'SEKUWA' },
    update: {},
    create: { name: 'Restaurant & Sekuwa Corner', code: 'SEKUWA' },
  })

  const cafe = await client.outlet.upsert({
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

  const sekuwa = await client.outlet.upsert({
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

  // Terminals
  for (const name of ['POS-1 (Main Counter)', 'POS-2 (Bar Counter)']) {
    await client.terminal.upsert({
      where: { outletId_name: { outletId: sekuwa.id, name } },
      update: {},
      create: { outletId: sekuwa.id, name },
    })
  }

  for (const name of ['Cafe POS Main']) {
    await client.terminal.upsert({
      where: { outletId_name: { outletId: cafe.id, name } },
      update: {},
      create: { outletId: cafe.id, name },
    })
  }

  console.log('   ✔ Outlets & Terminals configured successfully.')
  return { cafe, sekuwa }
}

// Standalone execution support
if (require.main === module || process.argv[1]?.endsWith('01-outlets.ts')) {
  seedOutlets()
    .catch((e) => {
      console.error('❌ Failed seeding outlets:', e)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
