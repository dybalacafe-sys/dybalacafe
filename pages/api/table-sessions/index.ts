// pages/api/table-sessions/credit.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
    // GET: list sessions (history)
    if (req.method === 'GET') {
        const { status, page = '1', limit = '20', tableId } = req.query
        const skip = (Number(page) - 1) * Number(limit)
        const where: Record<string, unknown> = {}
        if (status) where.status = status
        if (tableId) where.tableId = Number(tableId)

        const [sessions, total] = await Promise.all([
            prisma.tableSession.findMany({
                where,
                include: {
                    table: { select: { name: true, capacity: true } },
                    openedBy: { select: { name: true } },
                    closedBy: { select: { name: true } },
                    customer: { select: { name: true, phone: true } },
                    orders: {
                        orderBy: { roundNumber: 'asc' },
                        include: {
                            items: {
                                include: { product: { select: { name: true, unit: true } } },
                            },
                        },
                    },
                },
                orderBy: { openedAt: 'desc' },
                skip,
                take: Number(limit),
            }),
            prisma.tableSession.count({ where }),
        ])

        return res.status(200).json({ sessions, total })
    }

    // POST: open a new session for a table
    if (req.method === 'POST') {
        const { tableId, customerName, customerPhone, note } = req.body
        if (!tableId) return res.status(400).json({ error: 'tableId required' })

        // Check no open session already exists for this table
        const existing = await prisma.tableSession.findFirst({
            where: { tableId: Number(tableId), status: 'OPEN' },
        })
        if (existing) {
            return res.status(409).json({ error: 'Table already has an open session', sessionId: existing.id })
        }

        // Optional customer lookup/create
        let customerId: number | null = null
        if (customerPhone) {
            const found = await prisma.customer.findFirst({ where: { phone: customerPhone } })
            if (found) {
                customerId = found.id
            } else if (customerName) {
                const created = await prisma.customer.create({
                    data: { name: customerName, phone: customerPhone, type: 'regular', points: 0 },
                })
                customerId = created.id
            }
        }

        const session = await prisma.tableSession.create({
            data: {
                tableId: Number(tableId),
                openedById: user.userId,
                customerId,
                customerName: customerName || null,
                note: note || null,
                status: 'OPEN',
            },
            include: {
                table: { select: { name: true } },
                openedBy: { select: { name: true } },
                orders: true,
            },
        })

        return res.status(201).json(session)
    }

    return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)