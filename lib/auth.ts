import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { NextApiRequest, NextApiResponse } from 'next'
import { Permissions, ModuleKey, ModulePermission, can } from './permissions'
import { prisma } from './prisma'

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'bms-super-secret-key-2026')
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('FATAL: JWT_SECRET environment variable is missing in production!')
}

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

export async function getOutletIdFromRequest(req: NextApiRequest, user?: JWTPayload): Promise<number> {
  const headerVal = req.headers['x-outlet-id'] || req.query.outletId || (req.body && req.body.outletId)
  let requestedOutletId: number | null = null

  if (headerVal) {
    const parsed = Array.isArray(headerVal) ? parseInt(headerVal[0], 10) : parseInt(headerVal as string, 10)
    if (!isNaN(parsed) && parsed > 0) requestedOutletId = parsed
  }

  if (!requestedOutletId) {
    if (user && user.role !== 'SUPER_ADMIN') {
      const userAssigned = await prisma.userOutlet.findFirst({
        where: { userId: user.userId },
        orderBy: { outletId: 'asc' },
      })
      if (!userAssigned) {
        throw new Error('Forbidden: You have no assigned outlets')
      }
      requestedOutletId = userAssigned.outletId
    } else {
      const defaultOutlet = await prisma.outlet.findFirst({
        where: { active: true },
        orderBy: { id: 'asc' },
      })
      if (!defaultOutlet) throw new Error('No active outlet found in system')
      requestedOutletId = defaultOutlet.id
    }
  }

  if (user && user.role !== 'SUPER_ADMIN') {
    const assigned = await prisma.userOutlet.findUnique({
      where: {
        userId_outletId: {
          userId: user.userId,
          outletId: requestedOutletId,
        },
      },
    })
    if (!assigned) {
      throw new Error('Forbidden: You are not assigned to this outlet')
    }
  }

  return requestedOutletId
}

export interface AuthOptions {
  roles?: string[]
  permission?: {
    module: ModuleKey
    action: keyof ModulePermission
  }
}

export function withAuth(
  handler: (req: NextApiRequest, res: NextApiResponse, user: JWTPayload) => Promise<void>,
  options?: AuthOptions | string[]
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    let user: JWTPayload
    try {
      const token = getTokenFromRequest(req)
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' })
      }
      user = verifyToken(token)
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    // Active status verification to revoke access for deactivated accounts
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { active: true },
    })
    if (!dbUser || !dbUser.active) {
      return res.status(401).json({ error: 'Unauthorized: User account is inactive or revoked' })
    }

    const roles = Array.isArray(options) ? options : options?.roles
    if (roles && !roles.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient role' })
    }

    const permission = !Array.isArray(options) ? options?.permission : undefined
    if (permission) {
      if (!can(user.permissions, user.role, permission.module, permission.action)) {
        return res.status(403).json({ error: `Forbidden: Missing ${permission.module}:${permission.action} permission` })
      }
    }

    try {
      return await handler(req, res, user)
    } catch (err: unknown) {
      console.error(`[API Error] ${req.method} ${req.url}:`, err)
      const msg = err instanceof Error ? err.message : 'Internal server error'
      if (msg.startsWith('Forbidden')) return res.status(403).json({ error: msg })
      return res.status(500).json({ error: msg })
    }
  }
}

export function withPermission(
  module: ModuleKey,
  action: keyof ModulePermission,
  handler: (req: NextApiRequest, res: NextApiResponse, user: JWTPayload) => Promise<void>
) {
  return withAuth(handler, { permission: { module, action } })
}
