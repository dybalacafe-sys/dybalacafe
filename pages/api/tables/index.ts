import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload, getOutletIdFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
    const outletId = await getOutletIdFromRequest(req, user)

    if (req.method === 'GET') {
        if (!can(user.permissions, user.role, 'tables', 'view')) {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view tables' })
        }
        const tables = await prisma.table.findMany({
            where: { active: true, outletId },
            orderBy: { name: 'asc' },
            include: {
                sessions: {
                    where: { status: 'OPEN' },
                    take: 1,
                    include: {
                        orders: {
                            include: { items: true },
                        },
                    },
                },
            },
        })
        return res.status(200).json(tables)
    }

    if (req.method === 'POST') {
        if (!can(user.permissions, user.role, 'tables', 'edit')) {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions to manage tables' })
        }
        const { name, capacity } = req.body
        if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Valid table name required' })

        const table = await prisma.table.create({
            data: {
                outletId,
                name: name.trim(),
                capacity: Math.max(1, Number(capacity) || 4),
            },
        })
        return res.status(201).json(table)
    }

    return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
