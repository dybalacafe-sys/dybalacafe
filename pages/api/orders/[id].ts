// pages/api/orders/[id].ts
import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
    const id = Number(req.query.id)

    // ── GET: single order detail ─────────────────────────────────────────────────
    if (req.method === 'GET') {
        const order = await prisma.order.findUnique({
            where: { id },
            include: {
                items: true,
                user: { select: { name: true } },
                customer: { select: { id: true, name: true, phone: true, creditLimit: true, creditUsed: true } },
            },
        })
        if (!order) return res.status(404).json({ error: 'Order not found' })
        return res.status(200).json(order)
    }

    // ── PUT: update status and/or record a payment ───────────────────────────────
    if (req.method === 'PUT') {
        const { status, advancePaid, paymentNote } = req.body

        const order = await prisma.order.findUnique({
            where: { id },
            include: {
                customer: { select: { id: true, creditLimit: true, creditUsed: true } },
            },
        })
        if (!order) return res.status(404).json({ error: 'Order not found' })

        const newAdvance = advancePaid !== undefined ? Number(advancePaid) : order.advancePaid

        // Validate advance doesn't exceed total
        if (newAdvance > order.totalAmount) {
            return res.status(400).json({ error: 'Advance cannot exceed order total' })
        }

        const newBalance = order.totalAmount - newAdvance
        let paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' = 'UNPAID'
        if (newAdvance >= order.totalAmount) paymentStatus = 'PAID'
        else if (newAdvance > 0) paymentStatus = 'PARTIAL'

        // If customer has a credit limit and balance is going up, check headroom
        const balanceDelta = newBalance - order.balanceDue // positive = more owed
        if (balanceDelta > 0 && order.customer) {
            const available = order.customer.creditLimit - order.customer.creditUsed
            if (balanceDelta > available && order.customer.creditLimit > 0) {
                return res.status(400).json({
                    error: `Insufficient credit limit. Available: NPR ${available.toLocaleString()}`,
                })
            }
        }

        const updated = await prisma.$transaction(async (tx) => {
            const u = await tx.order.update({
                where: { id },
                data: {
                    ...(status && { status }),
                    advancePaid: newAdvance,
                    balanceDue: newBalance,
                    paymentStatus,
                },
                include: {
                    items: true,
                    user: { select: { name: true } },
                    customer: { select: { id: true, name: true, phone: true, creditLimit: true, creditUsed: true } },
                },
            })

            // If customer has a credit profile, keep creditUsed in sync
            // creditUsed for orders = total balance still owed across all orders
            if (order.customer?.id) {
                const balanceDiff = newBalance - order.balanceDue
                if (balanceDiff !== 0) {
                    await tx.customer.update({
                        where: { id: order.customer.id },
                        data: { creditUsed: { increment: balanceDiff } },
                    })
                }
            }

            return u
        })

        return res.status(200).json(updated)
    }

    // ── DELETE: cancel order ─────────────────────────────────────────────────────
    if (req.method === 'DELETE') {
        if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
            return res.status(403).json({ error: 'Forbidden' })
        }
        const order = await prisma.order.findUnique({ where: { id } })
        if (!order) return res.status(404).json({ error: 'Order not found' })
        await prisma.order.update({ where: { id }, data: { status: 'CANCELLED' } })
        return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)