import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload, getOutletIdFromRequest } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { salesService } from '@/lib/services/sales.service'
import { createSaleSchema, getSalesQuerySchema } from '@/lib/schemas/sales.schema'
import { prisma } from '@/lib/prisma'
import { isCafeOutlet } from '@/lib/outlet'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
  try {
    const outletId = await getOutletIdFromRequest(req, user)
    const outlet = await prisma.outlet.findUnique({
      where: { id: outletId },
      select: { code: true, name: true, type: { select: { code: true } } },
    })
    if (isCafeOutlet(outlet)) {
      return res.status(404).json({ error: 'Not found' })
    }

    if (req.method === 'GET') {
      if (!can(user.permissions, user.role, 'pos', 'view')) {
        return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view sales' })
      }

      const parsed = getSalesQuerySchema.safeParse(req.query)
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid query parameters' })
      }

      const result = await salesService.getSales({
        outletId,
        ...parsed.data,
      })

      return res.status(200).json(result)
    }

    if (req.method === 'POST') {
      if (!can(user.permissions, user.role, 'pos', 'edit')) {
        return res.status(403).json({ error: 'Forbidden: Insufficient permissions to create sales' })
      }

      const parsed = createSaleSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid sale payload' })
      }

      const sale = await salesService.createSale({
        outletId,
        userId: user.userId,
        ...parsed.data,
      })
      return res.status(201).json(sale)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: unknown) {
    console.error('[API /api/sales]', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    const status = message.startsWith('Forbidden') ? 403 : req.method === 'POST' ? 400 : 500
    return res.status(status).json({ error: message })
  }
}

export default withAuth(handler)
