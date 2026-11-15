import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload, getOutletIdFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function handler(req: NextApiRequest, res: NextApiResponse, _user: JWTPayload) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const outletId = await getOutletIdFromRequest(req)
  const { productId, type, quantity, note } = req.body

  const prodId = Number(productId)
  const product = await prisma.product.findUnique({ where: { id: prodId } })
  if (!product) return res.status(404).json({ error: 'Product not found' })

  const qty = Number(quantity)

  // Ensure outletProduct exists
  let op = await prisma.outletProduct.findUnique({
    where: { outletId_productId: { outletId, productId: prodId } },
  })

  if (!op) {
    op = await prisma.outletProduct.create({
      data: { outletId, productId: prodId, stock: 0, minStock: 5 },
    })
  }

  let newStock = op.stock
  if (type === 'IN') newStock += qty
  else if (type === 'OUT') newStock -= qty
  else if (type === 'ADJUSTMENT') newStock = qty

  await prisma.$transaction([
    prisma.outletProduct.update({
      where: { outletId_productId: { outletId, productId: prodId } },
      data: { stock: newStock },
    }),
    prisma.stockLog.create({
      data: { outletId, productId: prodId, type, quantity: qty, note },
    }),
  ])

  return res.status(200).json({ message: 'Stock updated', newStock })
}

export default withAuth(handler)
