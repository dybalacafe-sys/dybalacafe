import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload, getOutletIdFromRequest } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { salesService } from '@/lib/services/sales.service'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
  const outletId = await getOutletIdFromRequest(req, user)

  if (req.method === 'GET') {
    if (!can(user.permissions, user.role, 'pos', 'view')) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view sales' })
    }

    const { startDate, endDate, customerId, page, limit } = req.query
    const result = await salesService.getSales({
      outletId,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      customerId: customerId ? Number(customerId) : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })

    return res.status(200).json(result)
  }

  if (req.method === 'POST') {
    if (!can(user.permissions, user.role, 'pos', 'edit')) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to create sales' })
    }

    const { items, discount, paymentMethod, customerPhone, customerName, note, terminalId } = req.body

    try {
      const sale = await salesService.createSale({
        outletId,
        userId: user.userId,
        items,
        discount,
        paymentMethod,
        customerPhone,
        customerName,
        note,
        terminalId,
      })
      return res.status(201).json(sale)
    } catch (err: unknown) {
      return res.status(400).json({ error: err instanceof Error ? err.message : 'Sale processing failed' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
