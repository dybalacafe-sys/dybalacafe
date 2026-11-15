import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function handler(req: NextApiRequest, res: NextApiResponse, _user: JWTPayload) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { phone } = req.query
  if (!phone) return res.status(400).json({ error: 'Phone number required' })

  const customer = await prisma.customer.findFirst({
    where: { phone: phone as string },
    select: { id: true, name: true, phone: true, points: true, type: true },
  })

  return res.status(200).json(customer ?? null)
}

export default withAuth(handler)
