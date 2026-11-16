import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload, getOutletIdFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!can(user.permissions, user.role, 'inventory', 'edit')) {
    return res.status(403).json({ error: 'Forbidden: Insufficient permissions to adjust inventory' })
  }

  const outletId = await getOutletIdFromRequest(req, user)
  const { productId, type, quantity, note } = req.body

  const prodId = Number(productId)
  if (!prodId || isNaN(prodId)) return res.status(400).json({ error: 'Valid productId is required' })

  const product = await prisma.product.findUnique({ where: { id: prodId } })
  if (!product) return res.status(404).json({ error: 'Product not found' })

  const qty = Number(quantity)
  if (isNaN(qty) || qty < 0) return res.status(400).json({ error: 'Quantity must be non-negative' })
  if (type !== 'ADJUSTMENT' && qty <= 0) return res.status(400).json({ error: 'Quantity must be greater than zero for stock movements' })

  try {
    const result = await prisma.$transaction(async (tx) => {
      let op = await tx.outletProduct.findUnique({
        where: { outletId_productId: { outletId, productId: prodId } },
      })

      if (!op) {
        op = await tx.outletProduct.create({
          data: { outletId, productId: prodId, stock: 0, minStock: 5 },
        })
      }

      let finalStock: number
      if (type === 'IN') {
        const updated = await tx.outletProduct.update({
          where: { outletId_productId: { outletId, productId: prodId } },
          data: { stock: { increment: qty } },
        })
        finalStock = updated.stock
      } else if (type === 'OUT') {
        const updated = await tx.outletProduct.updateMany({
          where: {
            outletId,
            productId: prodId,
            stock: { gte: qty },
          },
          data: {
            stock: { decrement: qty },
          },
        })
        if (updated.count === 0) {
          throw new Error(`Cannot deduct ${qty} from stock of ${op.stock}`)
        }
        finalStock = op.stock - qty
      } else if (type === 'ADJUSTMENT') {
        const updated = await tx.outletProduct.update({
          where: { outletId_productId: { outletId, productId: prodId } },
          data: { stock: qty },
        })
        finalStock = updated.stock
      } else {
        throw new Error('Invalid adjustment type')
      }

      await tx.stockLog.create({
        data: {
          outletId,
          productId: prodId,
          type: type || 'ADJUSTMENT',
          quantity: qty,
          note: note ? String(note).trim() : 'Manual stock adjustment',
        },
      })

      return finalStock
    })

    return res.status(200).json({ message: 'Stock updated', newStock: result })
  } catch (err: unknown) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Adjustment failed' })
  }
}

export default withAuth(handler)
