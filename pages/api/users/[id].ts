// pages/api/users/[id].ts
import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload, hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function assignableRoles(requesterRole: string): string[] {
    if (requesterRole === 'SUPER_ADMIN') return ['SUPER_ADMIN', 'ADMIN', 'STAFF']
    if (requesterRole === 'ADMIN')       return ['ADMIN', 'STAFF']
    return []
}

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
    const id = Number(req.query.id)

    // ── PUT: update user ─────────────────────────────────────────────────────────
    if (req.method === 'PUT') {
        if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role) && user.userId !== id) {
            return res.status(403).json({ error: 'Forbidden' })
        }

        const target = await prisma.user.findUnique({ where: { id } })
        if (!target) return res.status(404).json({ error: 'User not found' })

        if (user.role === 'ADMIN' && target.role === 'SUPER_ADMIN' && user.userId !== id) {
            return res.status(403).json({ error: 'Admins cannot edit Super Admin accounts' })
        }

        const { name, email, role, active, password, permissions, outletIds } = req.body
        const data: Record<string, unknown> = {}

        if (name)  data.name  = name
        if (email) data.email = email
        if (password) data.password = await hashPassword(password)

        if (role !== undefined && ['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
            if (!assignableRoles(user.role).includes(role)) {
                return res.status(403).json({
                    error: `Your role (${user.role}) cannot assign the role: ${role}`,
                })
            }
            data.role = role
        }

        if (active !== undefined && ['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
            if (user.userId === id && !active) {
                return res.status(400).json({ error: 'You cannot deactivate your own account' })
            }
            data.active = active
        }

        if (permissions !== undefined && ['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
            const effectiveRole = (role ?? target.role) as string
            data.permissions = effectiveRole === 'SUPER_ADMIN' ? {} : permissions
        }

        const updated = await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id },
                data,
            })

            // Update outlet assignments if provided
            if (Array.isArray(outletIds) && ['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
                await tx.userOutlet.deleteMany({ where: { userId: id } })
                const validOutletIds: number[] = outletIds
                    .map((oId: unknown) => Number(oId))
                    .filter((oId: number) => !isNaN(oId))
                if (validOutletIds.length > 0) {
                    await tx.userOutlet.createMany({
                        data: validOutletIds.map((oId) => ({
                            userId: id,
                            outletId: oId,
                        })),
                    })
                }
            }

            return tx.user.findUnique({
                where: { id },
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

        return res.status(200).json(updated)
    }

    // ── DELETE: deactivate user ──────────────────────────────────────────────────
    if (req.method === 'DELETE') {
        if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
            return res.status(403).json({ error: 'Forbidden' })
        }
        if (user.userId === id) {
            return res.status(400).json({ error: 'You cannot deactivate your own account' })
        }

        const target = await prisma.user.findUnique({ where: { id } })
        if (!target) return res.status(404).json({ error: 'User not found' })

        if (user.role === 'ADMIN' && target.role === 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Admins cannot deactivate Super Admin accounts' })
        }

        await prisma.user.update({
            where: { id },
            data: { active: false },
        })
        return res.status(200).json({ message: 'User deactivated' })
    }

    return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
