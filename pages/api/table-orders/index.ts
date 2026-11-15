// pages/api/table-orders/credit.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
    // POST: add a new round of items to an open session
    if (req.method === 'POST') {
        const { sessionId, items, note } = req.body

        if (!sessionId || !items || items.length === 0) {
            return res.status(400).json({ error: 'sessionId and items required' })
        }

        // Verify session is open
        const session = await prisma.tableSession.findUnique({
            where: { id: Number(sessionId) },
            include: {
                table: { select: { name: true } },
                orders: { select: { id: true } },
            },
        })
        if (!session) return res.status(404).json({ error: 'Session not found' })
        if (session.status === 'CLOSED') return res.status(409).json({ error: 'Session is already closed' })

        const roundNumber = session.orders.length + 1

        // Validate items and build order items
        const orderItems: Array<{
            productId: number | null
            name: string
            quantity: number
            price: number
            subtotal: number
        }> = []

        for (const item of items) {
            let name = item.name
            let price = Number(item.price)

            if (item.productId) {
                const product = await prisma.product.findUnique({ where: { id: Number(item.productId) } })
                if (!product) return res.status(400).json({ error: `Product ${item.productId} not found` })
                // Note: stock NOT deducted here — only at checkout
                name = product.name
                price = item.price ?? product.price
            }

            if (!name) return res.status(400).json({ error: 'Item name required' })
            if (item.quantity <= 0) return res.status(400).json({ error: 'Quantity must be > 0' })

            orderItems.push({
                productId: item.productId ? Number(item.productId) : null,
                name,
                quantity: Number(item.quantity),
                price,
                subtotal: price * Number(item.quantity),
            })
        }

        const tableOrder = await prisma.tableOrder.create({
            data: {
                sessionId: Number(sessionId),
                roundNumber,
                note: note || null,
                items: { create: orderItems },
            },
            include: {
                items: {
                    include: { product: { select: { name: true, unit: true } } },
                },
                session: {
                    include: { table: { select: { name: true } } },
                },
            },
        })

        return res.status(201).json(tableOrder)
    }

    return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)