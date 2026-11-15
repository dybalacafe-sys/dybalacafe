import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload, getOutletIdFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function handler(req: NextApiRequest, res: NextApiResponse, _user: JWTPayload) {
  const outletId = await getOutletIdFromRequest(req)

  if (req.method === 'GET') {
    const { supplierId } = req.query
    const where: Record<string, unknown> = { outletId }
    if (supplierId) {
      where.supplierId = Number(supplierId)
    }

    const purchases = await prisma.purchase.findMany({
      where,
      include: {
        supplier: {
          select: { id: true, name: true, phone: true },
        },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return res.status(200).json(purchases)
  }

  if (req.method === 'POST') {
    const { supplierId, total, paid = 0, note, items = [], date } = req.body

    const numTotal = Number(total)
    const numPaid = Number(paid) || 0

    if (!supplierId || isNaN(numTotal) || numTotal <= 0) {
      return res.status(400).json({ error: 'Valid supplier and total amount are required' })
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id: Number(supplierId) },
    })

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' })
    }

    const numDue = Math.max(0, numTotal - numPaid)
    const purchaseDate = date ? new Date(date) : new Date()

    const purchase = await prisma.$transaction(async (tx) => {
      // 1. Create Purchase record
      const p = await tx.purchase.create({
        data: {
          outletId,
          supplierId: Number(supplierId),
          total: numTotal,
          paid: numPaid,
          due: numDue,
          note: note ? String(note).trim() : null,
          createdAt: purchaseDate,
          items: Array.isArray(items) && items.length > 0 ? {
            create: items.map((it: { productId?: number; name: string; quantity: number; price: number; subtotal?: number }) => ({
              productId: it.productId ? Number(it.productId) : 1,
              name: it.name || 'Supply Item',
              quantity: Number(it.quantity) || 1,
              price: Number(it.price) || 0,
              subtotal: Number(it.subtotal) || (Number(it.quantity) * Number(it.price)),
            })),
          } : undefined,
        },
        include: {
          supplier: true,
          items: true,
        },
      })

      // 2. If any amount was paid upfront, record it in expenses so the cash flow reflects it
      if (numPaid > 0) {
        await tx.expense.create({
          data: {
            outletId,
            category: 'Supplies',
            amount: numPaid,
            description: `Vendor bill #${p.id} (${supplier.name})${note ? ' - ' + note : ''}`,
            date: purchaseDate,
          },
        })
      }

      return p
    })

    return res.status(201).json(purchase)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
