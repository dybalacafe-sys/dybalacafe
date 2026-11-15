import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { NextApiRequest, NextApiResponse } from 'next'
import { Permissions } from './permissions'
import { prisma } from './prisma'

const JWT_SECRET = process.env.JWT_SECRET || 'bms-super-secret-key-2026'

export interface JWTPayload {
  userId: number
  email: string
  role: string
  name: string
  permissions: Permissions
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function getTokenFromRequest(req: NextApiRequest): string | null {
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  const cookie = req.cookies?.token
  return cookie || null
}

export async function getOutletIdFromRequest(req: NextApiRequest): Promise<number> {
  const headerVal = req.headers['x-outlet-id'] || req.query.outletId || (req.body && req.body.outletId)
  if (headerVal) {
    const parsed = Array.isArray(headerVal) ? parseInt(headerVal[0], 10) : parseInt(headerVal as string, 10)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  const defaultOutlet = await prisma.outlet.findFirst({
    where: { active: true },
    orderBy: { id: 'asc' },
  })
  if (!defaultOutlet) throw new Error('No active outlet found in system')
  return defaultOutlet.id
}

export function withAuth(
  handler: (req: NextApiRequest, res: NextApiResponse, user: JWTPayload) => Promise<void>,
  requiredRoles?: string[]
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      const token = getTokenFromRequest(req)
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' })
      }

      const user = verifyToken(token)

      if (requiredRoles && !requiredRoles.includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      return handler(req, res, user)
    } catch {
      return res.status(401).json({ error: 'Invalid token' })
    }
  }
}
