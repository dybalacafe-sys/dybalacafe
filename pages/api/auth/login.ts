import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { comparePassword, signToken } from '@/lib/auth'
import { parsePermissions } from '@/lib/permissions'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

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
}
