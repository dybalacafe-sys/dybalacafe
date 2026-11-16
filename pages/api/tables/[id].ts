// pages/api/tables/[id].ts
import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
    const id = Number(req.query.id)
    if (!id || isNaN(id)) return res.status(400).json({ error: 'Invalid table ID' })

    const table = await prisma.table.findUnique({ where: { id } })
    if (!table) return res.status(404).json({ error: 'Table not found' })

    if (user.role !== 'SUPER_ADMIN') {
        const hasAccess = await prisma.userOutlet.findUnique({
            where: { userId_outletId: { userId: user.userId, outletId: table.outletId } },
        })
        if (!hasAccess) {
            return res.status(403).json({ error: 'Forbidden: You do not have access to this outlet' })
        }
    }

    if (req.method === 'PUT') {
        if (!can(user.permissions, user.role, 'tables', 'edit')) {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions to edit tables' })
        }
        const { name, capacity, active } = req.body
        const updated = await prisma.table.update({
            where: { id },
            data: {
                ...(name !== undefined && { name: String(name).trim() }),
                ...(capacity !== undefined && { capacity: Math.max(1, Number(capacity)) }),
                ...(active !== undefined && { active: Boolean(active) }),
            },
        })
        return res.status(200).json(updated)
    }

    if (req.method === 'DELETE') {
        if (!can(user.permissions, user.role, 'tables', 'delete')) {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions to delete tables' })
        }
        // Soft delete
        await prisma.table.update({ where: { id }, data: { active: false } })
        return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
