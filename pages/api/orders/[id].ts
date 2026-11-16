// pages/api/orders/[id].ts
import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { ordersService } from '@/lib/services/orders.service'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
    const id = Number(req.query.id)
    if (!id || isNaN(id)) return res.status(400).json({ error: 'Invalid order ID' })

    const order = await ordersService.getOrderById(id)
    if (!order) return res.status(404).json({ error: 'Order not found' })

    // Validate outlet assignment for non-superadmin
    if (user.role !== 'SUPER_ADMIN') {
        const hasAccess = await prisma.userOutlet.findUnique({
            where: { userId_outletId: { userId: user.userId, outletId: order.outletId } },
        })
        if (!hasAccess) {
            return res.status(403).json({ error: 'Forbidden: You do not have access to this outlet' })
        }
    }

    // ── GET: single order detail ─────────────────────────────────────────────────
    if (req.method === 'GET') {
        if (!can(user.permissions, user.role, 'orders', 'view')) {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view orders' })
        }
        return res.status(200).json(order)
    }

    // ── PUT: update status and/or record a payment ───────────────────────────────
    if (req.method === 'PUT') {
        if (!can(user.permissions, user.role, 'orders', 'edit')) {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions to edit orders' })
        }
        const { status, advancePaid } = req.body

        try {
            const updated = await ordersService.updateOrder(id, {
                status,
                advancePaid: advancePaid !== undefined ? Number(advancePaid) : undefined,
            })
            return res.status(200).json(updated)
        } catch (err: unknown) {
            return res.status(400).json({ error: err instanceof Error ? err.message : 'Order update failed' })
        }
    }

    // ── DELETE: cancel order ─────────────────────────────────────────────────────
    if (req.method === 'DELETE') {
        if (!can(user.permissions, user.role, 'orders', 'delete')) {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions to cancel orders' })
        }
        await ordersService.cancelOrder(id)
        return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
