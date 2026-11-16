import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload, getOutletIdFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
  const outletId = await getOutletIdFromRequest(req, user)

  if (req.method === 'GET') {
    if (!can(user.permissions, user.role, 'expenses', 'view')) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view suppliers' })
    }

    const { search } = req.query
    const where: Record<string, unknown> = {}
    if (search) {
      where.name = { contains: search as string }
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      include: {
        purchases: {
          where: { outletId },
          select: {
            id: true,
            total: true,
            paid: true,
            due: true,
            createdAt: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    const result = suppliers.map((s) => {
      const totalPurchased = s.purchases.reduce((sum, p) => sum + p.total, 0)
      const totalPaid = s.purchases.reduce((sum, p) => sum + p.paid, 0)
      const totalDue = s.purchases.reduce((sum, p) => sum + p.due, 0)

      return {
        id: s.id,
        name: s.name,
        phone: s.phone,
        email: s.email,
        address: s.address,
        createdAt: s.createdAt,
        purchaseCount: s.purchases.length,
        totalPurchased,
        totalPaid,
        totalDue, // Vendor credit balance owed to this supplier
      }
    })

    return res.status(200).json(result)
  }

  if (req.method === 'POST') {
    if (!can(user.permissions, user.role, 'expenses', 'edit')) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to manage suppliers' })
    }

    const { name, phone, email, address } = req.body
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Vendor name is required' })
    }

    const supplier = await prisma.supplier.create({
      data: {
        name: name.trim(),
        phone: phone ? String(phone).trim() : null,
        email: email ? String(email).trim() : null,
        address: address ? String(address).trim() : null,
      },
    })

    return res.status(201).json(supplier)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
