// pages/api/users/index.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload, hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'

function assignableRoles(requesterRole: string): string[] {
    if (requesterRole === 'SUPER_ADMIN') return ['SUPER_ADMIN', 'ADMIN', 'STAFF']
    if (requesterRole === 'ADMIN')       return ['ADMIN', 'STAFF']
    return []
}

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
    // ── GET: list users with assigned outlets ─────────────────────────────────────
    if (req.method === 'GET') {
        if (!can(user.permissions, user.role, 'users', 'view') && !['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view users' })
        }
        const where = user.role === 'ADMIN' ? { role: { not: 'SUPER_ADMIN' as const } } : {}
        const users = await prisma.user.findMany({
            where,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                active: true,
                permissions: true,
                createdAt: true,
                outlets: {
                    select: {
                        outletId: true,
                        outlet: {
                            select: { id: true, name: true, code: true },
                        },
                    },
                },
            },
            orderBy: { name: 'asc' },
        })
        return res.status(200).json(users)
    }

    // ── POST: create user with outlet assignments ─────────────────────────────────
    if (req.method === 'POST') {
        if (!can(user.permissions, user.role, 'users', 'edit') && !['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions to create users' })
        }
        const { name, email, password, role, permissions, outletIds } = req.body

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' })
        }

        const requestedRole = role || 'STAFF'

        if (!assignableRoles(user.role).includes(requestedRole)) {
            return res.status(403).json({
                error: `Your role (${user.role}) cannot assign the role: ${requestedRole}`,
            })
        }

        const existing = await prisma.user.findUnique({ where: { email } })
        if (existing) return res.status(400).json({ error: 'Email already exists' })

        const hashed = await hashPassword(password)

        const newUser = await prisma.$transaction(async (tx) => {
            const u = await tx.user.create({
                data: {
                    name,
                    email,
                    password: hashed,
                    role: requestedRole,
                    permissions: requestedRole === 'SUPER_ADMIN' ? {} : (permissions ?? {}),
                },
            })

            // Assign outlets
            const validOutletIds: number[] = Array.isArray(outletIds)
                ? outletIds.map((id: unknown) => Number(id)).filter((id: number) => !isNaN(id))
                : []

            if (validOutletIds.length > 0) {
                await tx.userOutlet.createMany({
                    data: validOutletIds.map((oId) => ({
                        userId: u.id,
                        outletId: oId,
                    })),
                })
            }

            return tx.user.findUnique({
                where: { id: u.id },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    active: true,
                    permissions: true,
                    outlets: {
                        select: {
                            outletId: true,
                            outlet: { select: { id: true, name: true, code: true } },
                        },
                    },
                },
            })
        })

        return res.status(201).json(newUser)
    }

    return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
