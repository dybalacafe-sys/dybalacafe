import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload, getOutletIdFromRequest } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { purchasesService } from '@/lib/services/purchases.service'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!can(user.permissions, user.role, 'expenses', 'edit')) {
    return res.status(403).json({ error: 'Forbidden: Insufficient permissions to record supplier payments' })
  }

  const outletId = await getOutletIdFromRequest(req, user)
  const { supplierId, amount, note, date } = req.body

  try {
    const result = await purchasesService.allocatePayment({
      outletId,
      supplierId: Number(supplierId),
      amount: Number(amount),
      note,
      date,
    })

    return res.status(200).json({
      message: 'Vendor payment recorded successfully',
      supplierId,
      paidAmount: result.paidAmount,
      newRemainingDue: result.newRemainingDue,
    })
  } catch (err: unknown) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Payment allocation failed' })
  }
}

export default withAuth(handler)
