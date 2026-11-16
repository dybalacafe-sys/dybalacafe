import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload, getOutletIdFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
  const id = Number(req.query.id)
  if (!id || isNaN(id)) return res.status(400).json({ error: 'Invalid product ID' })

  let currentOutletId: number
  try {
    currentOutletId = await getOutletIdFromRequest(req, user)
  } catch (err: unknown) {
    return res.status(403).json({ error: err instanceof Error ? err.message : 'Forbidden: Outlet access denied' })
  }

  if (req.method === 'GET') {
    if (!can(user.permissions, user.role, 'inventory', 'view')) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view product details' })
    }
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
    if (!can(user.permissions, user.role, 'inventory', 'edit')) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to edit products' })
    }

    const existing = await prisma.product.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Product not found' })

    const { name, sku, categoryId, type, price, costPrice, unit, minStock, active, recipeItems } = req.body

    if (price !== undefined && (isNaN(Number(price)) || Number(price) < 0)) {
      return res.status(400).json({ error: 'Price must be a non-negative number' })
    }
    if (costPrice !== undefined && (isNaN(Number(costPrice)) || Number(costPrice) < 0)) {
      return res.status(400).json({ error: 'Cost price must be a non-negative number' })
    }
    if (minStock !== undefined && (isNaN(Number(minStock)) || Number(minStock) < 0)) {
      return res.status(400).json({ error: 'Min stock must be a non-negative number' })
    }

    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.update({
        where: { id },
        data: {
          ...(name !== undefined && { name: String(name).trim() }),
          ...(sku !== undefined && { sku: sku ? String(sku).trim() : null }),
          ...(categoryId !== undefined && { categoryId: categoryId ? Number(categoryId) : null }),
          ...(type !== undefined && { type }),
          ...(price !== undefined && { price: Number(price) }),
          ...(costPrice !== undefined && { costPrice: Number(costPrice) }),
          ...(unit !== undefined && { unit }),
          ...(active !== undefined && { active: Boolean(active) }),
        },
        include: { category: true },
      })

      if (minStock !== undefined) {
        await tx.outletProduct.upsert({
          where: { outletId_productId: { outletId: currentOutletId, productId: id } },
          update: { minStock: Number(minStock) },
          create: { outletId: currentOutletId, productId: id, stock: 0, minStock: Number(minStock) },
        })
      }

      if (type === 'finished' && Array.isArray(recipeItems)) {
        await tx.recipeItem.deleteMany({ where: { productId: id } })
        if (recipeItems.length > 0) {
          await tx.recipeItem.createMany({
            data: recipeItems.map((r: { ingredientId: number; quantity: number; unit: string }) => ({
              productId: id,
              ingredientId: Number(r.ingredientId),
              quantity: Number(r.quantity),
              unit: r.unit || 'piece',
            })),
          })
        }
      }

      return p
    })

    return res.status(200).json(product)
  }

  if (req.method === 'DELETE') {
    if (!can(user.permissions, user.role, 'inventory', 'delete')) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to delete products' })
    }

    const existing = await prisma.product.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Product not found' })

    // Deactivate from this outlet
    const result = await prisma.outletProduct.updateMany({
      where: { outletId: currentOutletId, productId: id },
      data: { active: false },
    })

    if (result.count === 0) {
      return res.status(404).json({ error: 'Product not found in this outlet' })
    }

    return res.status(200).json({ message: 'Deleted from outlet' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
