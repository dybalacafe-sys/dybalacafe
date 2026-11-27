import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { comparePassword, signToken } from '@/lib/auth'
import { parsePermissions } from '@/lib/permissions'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const valid = await comparePassword(password, user.password)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const permissions = parsePermissions(user.permissions)

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      permissions,
    })

    const isProd = process.env.NODE_ENV === 'production'
    res.setHeader(
      'Set-Cookie',
      `bms_token=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800${isProd ? '; Secure' : ''}`
    )

    return res.status(200).json({
      token,
      user: {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions,
      },
    })
  } catch (err: unknown) {
    console.error('[Login Error]', err)
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' })
  }
}
