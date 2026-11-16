// pages/api/table-sessions/index.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload, getOutletIdFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
    let currentOutletId: number
    try {
        currentOutletId = await getOutletIdFromRequest(req, user)
    } catch (err: unknown) {
        return res.status(403).json({ error: err instanceof Error ? err.message : 'Forbidden: Outlet access denied' })
    }

    // GET: list sessions (history)
    if (req.method === 'GET') {
        if (!can(user.permissions, user.role, 'tables', 'view')) {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view table sessions' })
        }
        const { status, page = '1', limit = '20', tableId } = req.query
        const pageNum = Math.max(1, Number(page) || 1)
        const limitNum = Math.min(100, Math.max(1, Number(limit) || 20))
        const skip = (pageNum - 1) * limitNum
        const where: Record<string, unknown> = {
            table: { outletId: currentOutletId },
        }
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
                take: limitNum,
            }),
            prisma.tableSession.count({ where }),
        ])

        return res.status(200).json({ sessions, total })
    }

    // POST: open a new session for a table
    if (req.method === 'POST') {
        if (!can(user.permissions, user.role, 'tables', 'edit')) {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions to open table sessions' })
        }
        const { tableId, customerName, customerPhone, note } = req.body
        const numTableId = Number(tableId)
        if (!numTableId || isNaN(numTableId)) return res.status(400).json({ error: 'Valid tableId required' })

        const table = await prisma.table.findUnique({ where: { id: numTableId } })
        if (!table) return res.status(404).json({ error: 'Table not found' })

        if (user.role !== 'SUPER_ADMIN') {
            const hasAccess = await prisma.userOutlet.findUnique({
                where: { userId_outletId: { userId: user.userId, outletId: table.outletId } },
            })
            if (!hasAccess) {
                return res.status(403).json({ error: 'Forbidden: You do not have access to this outlet' })
            }
        }

        try {
            const session = await prisma.$transaction(async (tx) => {
                // Check no open session already exists for this table inside transaction
                const existing = await tx.tableSession.findFirst({
                    where: { tableId: numTableId, status: 'OPEN' },
                })
                if (existing) {
                    throw new Error('Table already has an open session')
                }

                // Optional customer lookup/create
                let customerId: number | null = null
                if (customerPhone) {
                    const found = await tx.customer.findFirst({ where: { phone: customerPhone } })
                    if (found) {
                        customerId = found.id
                    } else if (customerName) {
                        const created = await tx.customer.create({
                            data: { name: customerName, phone: customerPhone, type: 'regular', points: 0 },
                        })
                        customerId = created.id
                    }
                }

                return await tx.tableSession.create({
                    data: {
                        tableId: numTableId,
                        openedById: user.userId,
                        customerId,
                        customerName: customerName || null,
                        note: note || null,
                        status: 'OPEN',
                    },
                    include: {
                        table: { select: { name: true, capacity: true } },
                        openedBy: { select: { name: true } },
                        customer: { select: { name: true, phone: true } },
                    },
                })
            })

            return res.status(201).json(session)
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to open table session'
            if (msg.includes('already has an open session')) {
                return res.status(409).json({ error: msg })
            }
            return res.status(400).json({ error: msg })
        }
    }

    return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
