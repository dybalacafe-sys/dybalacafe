import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    // Check if already seeded
    const existing = await prisma.user.findFirst()
    if (existing) {
      return res.status(400).json({ error: 'Already initialized' })
    }

    // Create super admin
    const hashedPw = await hashPassword('admin123')
    await prisma.user.create({
      data: {
        name: 'Super Admin',
        email: 'admin@dybala.com',
        password: hashedPw,
        role: 'SUPER_ADMIN',
      },
    })

    // Create default categories (idempotent — the seeder may have created them)
    const defaultCategories = [
      { name: 'Beverages', type: 'product' },
      { name: 'Food', type: 'product' },
      { name: 'Bakery', type: 'product' },
      { name: 'Cakes', type: 'product' },
      { name: 'Raw Materials', type: 'raw_material' },
      { name: 'Packaging', type: 'raw_material' },
      { name: 'Utilities', type: 'raw_material' },
    ]
    for (const c of defaultCategories) {
      await prisma.category.upsert({ where: { name: c.name }, update: {}, create: c })
    }

    // Products (raw materials + finished items with recipes) are provisioned by
    // the production inventory seeder (prisma/seed.ts), which runs on deploy and
    // can be run manually with `npm run seed`.

    return res.status(200).json({ message: 'Setup complete! Login with admin@dybala.com / admin123. Run the seeder (npm run seed) to load menu items & raw materials.' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Setup failed' })
  }
}
