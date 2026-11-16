/**
 * Seed User Accounts & Credentials
 * -------------------------------------------------------------
 * Sets up administrative, management, and staff credentials,
 * and configures their outlet access permissions.
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

export async function seedUsers(client: PrismaClient = prisma) {
  console.log('👤 Seeding User Accounts & Credentials...')

  // Allow configuring passwords via environment, with development defaults
  const adminRawPassword = process.env.ADMIN_PASSWORD || 'admin123'
  const staffRawPassword = process.env.STAFF_PASSWORD || 'staff123'

  const hashedAdminPassword = await bcrypt.hash(adminRawPassword, 10)
  const hashedStaffPassword = await bcrypt.hash(staffRawPassword, 10)

  // 1. Super Admin
  const adminUser = await client.user.upsert({
    where: { email: 'admin@dybala.com' },
    update: { role: 'SUPER_ADMIN', active: true, password: hashedAdminPassword },
    create: {
      name: 'Super Admin',
      email: 'admin@dybala.com',
      password: hashedAdminPassword,
      role: 'SUPER_ADMIN',
      active: true,
    },
  })

  // 2. Cafe Manager
  const cafeManager = await client.user.upsert({
    where: { email: 'manager.cafe@dybala.com' },
    update: { role: 'ADMIN', active: true, password: hashedStaffPassword },
    create: {
      name: 'Pooja Shrestha (Cafe Mgr)',
      email: 'manager.cafe@dybala.com',
      password: hashedStaffPassword,
      role: 'ADMIN',
      active: true,
    },
  })

  // 3. Sekuwa Manager
  const sekuwaManager = await client.user.upsert({
    where: { email: 'manager.sekuwa@dybala.com' },
    update: { role: 'ADMIN', active: true, password: hashedStaffPassword },
    create: {
      name: 'Bikash Thapa (Sekuwa Mgr)',
      email: 'manager.sekuwa@dybala.com',
      password: hashedStaffPassword,
      role: 'ADMIN',
      active: true,
    },
  })

  // 4. Server / Waiter Staff
  const waiterRamesh = await client.user.upsert({
    where: { email: 'ramesh@dybala.com' },
    update: { role: 'STAFF', active: true, password: hashedStaffPassword },
    create: {
      name: 'Ramesh Adhikari (Server)',
      email: 'ramesh@dybala.com',
      password: hashedStaffPassword,
      role: 'STAFF',
      active: true,
    },
  })

  // 5. Cashier Staff
  const cashierSita = await client.user.upsert({
    where: { email: 'sita@dybala.com' },
    update: { role: 'STAFF', active: true, password: hashedStaffPassword },
    create: {
      name: 'Sita Sharma (Cashier)',
      email: 'sita@dybala.com',
      password: hashedStaffPassword,
      role: 'STAFF',
      active: true,
    },
  })

  // Resolve outlets
  const outlets = await client.outlet.findMany({ where: { active: true } })
  const cafe = outlets.find((o) => o.code === 'CAF')
  const sekuwa = outlets.find((o) => o.code === 'SEK')

  // Super Admin assigned to all active outlets
  for (const o of outlets) {
    await client.userOutlet.upsert({
      where: { userId_outletId: { userId: adminUser.id, outletId: o.id } },
      update: {},
      create: { userId: adminUser.id, outletId: o.id },
    })
  }

  // Branch Manager assignments
  if (cafe) {
    await client.userOutlet.upsert({
      where: { userId_outletId: { userId: cafeManager.id, outletId: cafe.id } },
      update: {},
      create: { userId: cafeManager.id, outletId: cafe.id },
    })

    // Cashier assigned to Cafe
    await client.userOutlet.upsert({
      where: { userId_outletId: { userId: cashierSita.id, outletId: cafe.id } },
      update: {},
      create: { userId: cashierSita.id, outletId: cafe.id },
    })
  }

  if (sekuwa) {
    await client.userOutlet.upsert({
      where: { userId_outletId: { userId: sekuwaManager.id, outletId: sekuwa.id } },
      update: {},
      create: { userId: sekuwaManager.id, outletId: sekuwa.id },
    })

    // Staff assigned to Sekuwa
    await client.userOutlet.upsert({
      where: { userId_outletId: { userId: waiterRamesh.id, outletId: sekuwa.id } },
      update: {},
      create: { userId: waiterRamesh.id, outletId: sekuwa.id },
    })
  }

  console.log('   ✔ Users & Staff provisioned:')
  console.log(`     - Super Admin:    admin@dybala.com          (password: ${adminRawPassword})`)
  console.log(`     - Cafe Manager:   manager.cafe@dybala.com   (password: ${staffRawPassword})`)
  console.log(`     - Sekuwa Manager: manager.sekuwa@dybala.com (password: ${staffRawPassword})`)
  console.log(`     - Server Staff:   ramesh@dybala.com         (password: ${staffRawPassword})`)
  console.log(`     - Cashier Staff:  sita@dybala.com           (password: ${staffRawPassword})`)

  return { adminUser, cafeManager, sekuwaManager, waiterRamesh, cashierSita }
}

// Standalone execution support
if (require.main === module || process.argv[1]?.endsWith('02-users.ts')) {
  seedUsers()
    .catch((e) => {
      console.error('❌ Failed seeding users:', e)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
