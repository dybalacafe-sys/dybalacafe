import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload, getOutletIdFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
  const id = Number(req.query.id)
  const currentOutletId = await getOutletIdFromRequest(req).catch(() => 1)

  if (req.method === 'GET') {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        outletProducts: {
          where: { outletId: currentOutletId },
        },
        stockLogs: {
          where: { outletId: currentOutletId },
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
        recipeItems: {
          include: {
            ingredient: {
              include: {
                outletProducts: {
                  where: { outletId: currentOutletId },
                },
              },
            },
          },
        },
      },
    })
    if (!product) return res.status(404).json({ error: 'Not found' })

    const op = product.outletProducts[0]
    const mapped = {
      ...product,
      stock: op ? op.stock : 0,
      minStock: op ? op.minStock : 5,
      price: op && op.price !== null ? op.price : product.price,
      recipeItems: product.recipeItems.map((r) => {
        const ingOp = r.ingredient.outletProducts[0]
        return {
          ...r,
          ingredient: {
            id: r.ingredient.id,
            name: r.ingredient.name,
            unit: r.ingredient.unit,
            stock: ingOp ? ingOp.stock : 0,
          },
        }
      }),
    }

    return res.status(200).json(mapped)
  }

  if (req.method === 'PUT') {
    if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) return res.status(403).json({ error: 'Forbidden' })
    const { name, sku, categoryId, type, price, costPrice, unit, minStock, active, recipeItems } = req.body
    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        sku: sku || null,
        categoryId: categoryId ? Number(categoryId) : null,
        type,
        price: Number(price),
        costPrice: Number(costPrice),
        unit,
        active,
      },
      include: { category: true },
    })

    // Update OutletProduct minStock for the outlet
    if (minStock !== undefined) {
      await prisma.outletProduct.upsert({
        where: { outletId_productId: { outletId: currentOutletId, productId: id } },
        update: { minStock: Number(minStock) },
        create: { outletId: currentOutletId, productId: id, stock: 0, minStock: Number(minStock) },
      })
    }

    // Replace recipe items
    await prisma.recipeItem.deleteMany({ where: { productId: id } })
    if (type === 'finished' && Array.isArray(recipeItems) && recipeItems.length > 0) {
      await prisma.recipeItem.createMany({
        data: recipeItems.map((r: { ingredientId: number; quantity: number; unit: string }) => ({
          productId: id,
          ingredientId: Number(r.ingredientId),
          quantity: Number(r.quantity),
          unit: r.unit,
        })),
      })
    }
    return res.status(200).json(product)
  }

  if (req.method === 'DELETE') {
    if (user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Forbidden' })
    // Deactivate from this outlet
    await prisma.outletProduct.updateMany({
      where: { outletId: currentOutletId, productId: id },
      data: { active: false },
    })
    return res.status(200).json({ message: 'Deleted from outlet' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
