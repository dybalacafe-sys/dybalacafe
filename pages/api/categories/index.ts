import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { handleApiError } from '@/lib/apiError'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
  try {
    if (req.method === 'GET') {
      if (!can(user.permissions, user.role, 'inventory', 'view')) {
        return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view categories' })
      }
      const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } })
      return res.status(200).json(categories)
    }
    if (req.method === 'POST') {
      if (!can(user.permissions, user.role, 'inventory', 'edit') && !['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden: Insufficient permissions to create categories' })
      }
      const { name, type } = req.body
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Category name is required' })
      }
      const cat = await prisma.category.create({ data: { name: name.trim(), type: type || 'product' } })
      return res.status(201).json(cat)
    }
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    return handleApiError(res, err, '/api/categories')
  }
}

export default withAuth(handler)
