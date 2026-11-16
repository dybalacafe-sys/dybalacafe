import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // 1. Disable setup endpoint in production unless explicitly enabled
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_SETUP_ENDPOINT !== 'true') {
    return res.status(403).json({
      error: 'Setup endpoint is disabled in production. Run database seeding via CLI: npm run seed',
    })
  }

  // 2. Make initial password strictly mandatory — NO hardcoded default fallback
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD
  if (!adminPassword || adminPassword.trim().length < 8) {
    return res.status(400).json({
      error: 'INITIAL_ADMIN_PASSWORD environment variable (minimum 8 characters) is required for setup. Default passwords are disallowed.',
    })
  }

  // 3. Require secret key if configured
  if (process.env.SETUP_SECRET) {
    const key = req.headers['x-setup-secret']
    if (key !== process.env.SETUP_SECRET) {
      return res.status(401).json({ error: 'Unauthorized: Invalid setup secret' })
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findFirst()
      if (existing) {
        throw new Error('ALREADY_INITIALIZED')
      }

      const hashedPw = await hashPassword(adminPassword.trim())
      await tx.user.create({
        data: {
          name: 'Super Admin',
          email: 'admin@dybala.com',
          password: hashedPw,
          role: 'SUPER_ADMIN',
        },
      })

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
        await tx.category.upsert({ where: { name: c.name }, update: {}, create: c })
      }
    })

    return res.status(200).json({ message: 'Setup complete! Login with admin@dybala.com.' })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'ALREADY_INITIALIZED') {
      return res.status(400).json({ error: 'Already initialized' })
    }
    console.error(error)
    return res.status(500).json({ error: 'Setup failed' })
  }
}
