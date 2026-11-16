import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload, getOutletIdFromRequest } from '@/lib/auth'
import { purchasesService } from '@/lib/services/purchases.service'
import { can } from '@/lib/permissions'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
  const outletId = await getOutletIdFromRequest(req, user)

  if (req.method === 'GET') {
    if (!can(user.permissions, user.role, 'expenses', 'view')) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view purchases' })
    }
    const { supplierId } = req.query
    const purchases = await purchasesService.getPurchases(outletId, supplierId ? Number(supplierId) : undefined)
    return res.status(200).json(purchases)
  }

  if (req.method === 'POST') {
    if (!can(user.permissions, user.role, 'expenses', 'edit')) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to create purchases' })
    }
    const { supplierId, total, paid, note, items, date } = req.body

    try {
      const purchase = await purchasesService.createPurchase({
        outletId,
        supplierId: Number(supplierId),
        total: Number(total),
        paid: paid !== undefined ? Number(paid) : 0,
        note,
        items,
        date,
      })
      return res.status(201).json(purchase)
    } catch (err: unknown) {
      return res.status(400).json({ error: err instanceof Error ? err.message : 'Purchase creation failed' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
