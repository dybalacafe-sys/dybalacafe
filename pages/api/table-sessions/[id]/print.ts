import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload, getOutletIdFromRequest } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!can(user.permissions, user.role, 'tables', 'view')) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const outletId = await getOutletIdFromRequest(req, user)
  const id = Number(req.query.id)
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'Invalid session ID' })
  }

  const existing = await prisma.tableSession.findFirst({
    where: { id, table: { outletId } },
    select: { id: true },
  })
  if (!existing) {
    return res.status(404).json({ error: 'Session not found' })
  }

  const updated = await prisma.tableSession.update({
    where: { id },
    data: { printCount: { increment: 1 } },
    select: { id: true, printCount: true },
  })

  return res.status(200).json(updated)
}

export default withAuth(handler)
