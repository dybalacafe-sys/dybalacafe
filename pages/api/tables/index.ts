import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload, getOutletIdFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
    const outletId = await getOutletIdFromRequest(req)

    if (req.method === 'GET') {
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
        if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Admin only' })
        }
        const { name, capacity } = req.body
        if (!name) return res.status(400).json({ error: 'Table name required' })

        const table = await prisma.table.create({
            data: {
                outletId,
                name,
                capacity: Number(capacity) || 4,
            },
        })
        return res.status(201).json(table)
    }

    return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
