import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function handler(req: NextApiRequest, res: NextApiResponse, _user: JWTPayload) {
  if (req.method === 'GET') {
    const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } })
    return res.status(200).json(categories)
  }
  if (req.method === 'POST') {
    const { name, type } = req.body
    const cat = await prisma.category.create({ data: { name, type: type || 'product' } })
    return res.status(201).json(cat)
  }
  return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
