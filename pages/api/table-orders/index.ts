// pages/api/table-orders/index.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    if (!can(user.permissions, user.role, 'tables', 'edit')) {
        return res.status(403).json({ error: 'Forbidden: Insufficient permissions to add table orders' })
    }

    const { sessionId, items, note } = req.body
    const numSessionId = Number(sessionId)

    if (!numSessionId || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Valid sessionId and items are required' })
    }

    // Verify session is open and user has outlet access
    const session = await prisma.tableSession.findUnique({
        where: { id: numSessionId },
        include: {
            table: { select: { name: true, outletId: true } },
            orders: { select: { id: true } },
        },
    })
    if (!session) return res.status(404).json({ error: 'Session not found' })
    if (session.status === 'CLOSED') return res.status(409).json({ error: 'Session is already closed' })

    if (user.role !== 'SUPER_ADMIN') {
        const hasAccess = await prisma.userOutlet.findUnique({
            where: { userId_outletId: { userId: user.userId, outletId: session.table.outletId } },
        })
        if (!hasAccess) {
            return res.status(403).json({ error: 'Forbidden: You do not have access to this outlet' })
        }
    }

    const roundNumber = session.orders.length + 1

    // 1. Batch fetch all products (Eliminate N+1 query loop)
    const productIds = items
        .map((it: { productId?: number }) => Number(it.productId))
        .filter((pid: number) => !isNaN(pid) && pid > 0)

    const products = productIds.length > 0
        ? await prisma.product.findMany({
            where: { id: { in: productIds } },
            include: { outletProducts: { where: { outletId: session.table.outletId } } },
        })
        : []
    const productMap = new Map(products.map((p) => [p.id, p]))

    // 2. Validate items and build order items with verified server pricing
    const orderItems: Array<{
        productId: number | null
        name: string
        quantity: number
        price: number
        subtotal: number
    }> = []

    for (const item of items) {
        const qty = Number(item.quantity)
        if (isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
            return res.status(400).json({ error: 'Quantity must be a positive integer' })
        }

        let name = item.name ? String(item.name).trim() : ''
        let price = Math.max(0, Number(item.price) || 0)

        if (item.productId) {
            const product = productMap.get(Number(item.productId))
            if (!product) return res.status(400).json({ error: `Product #${item.productId} not found` })
            name = product.name
            price = product.outletProducts[0]?.price ?? product.price
        }

        if (!name) return res.status(400).json({ error: 'Item name is required' })

        orderItems.push({
            productId: item.productId ? Number(item.productId) : null,
            name,
            quantity: qty,
            price,
            subtotal: price * qty,
        })
    }

    const tableOrder = await prisma.tableOrder.create({
        data: {
            sessionId: numSessionId,
            roundNumber,
            note: note ? String(note).trim() : null,
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

export default withAuth(handler)
