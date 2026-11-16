import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload, getOutletIdFromRequest } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { ordersService } from '@/lib/services/orders.service'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
  const outletId = await getOutletIdFromRequest(req, user)

  if (req.method === 'GET') {
    if (!can(user.permissions, user.role, 'orders', 'view')) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view orders' })
    }

    const { status, customerId, page, limit, search } = req.query
    const result = await ordersService.getOrders({
      outletId,
      status: status as string | undefined,
      customerId: customerId ? Number(customerId) : undefined,
      search: search as string | undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })

    return res.status(200).json(result)
  }

  if (req.method === 'POST') {
    if (!can(user.permissions, user.role, 'orders', 'edit')) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to create orders' })
    }

    const { customerName, customerPhone, customerId, deliveryDate, note, items, advancePaid } = req.body

    try {
      const order = await ordersService.createOrder({
        outletId,
        userId: user.userId,
        customerName,
        customerPhone,
        customerId: customerId ? Number(customerId) : undefined,
        deliveryDate,
        note,
        items,
        advancePaid,
      })
      return res.status(201).json(order)
    } catch (err: unknown) {
      return res.status(400).json({ error: err instanceof Error ? err.message : 'Order creation failed' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
