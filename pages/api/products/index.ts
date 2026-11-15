import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload, getOutletIdFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
  const currentOutletId = await getOutletIdFromRequest(req).catch(() => 1)

  if (req.method === 'GET') {
    const { type, search, categoryId } = req.query
    const where: Record<string, unknown> = {
      active: true,
      // Strictly separate product data per outlet: only show products active in the current outlet
      outletProducts: {
        some: {
          outletId: currentOutletId,
          active: true,
        },
      },
    }
    if (type) where.type = type
    if (categoryId) where.categoryId = Number(categoryId)
    if (search) where.name = { contains: search as string }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        outletProducts: {
          where: { outletId: currentOutletId },
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
      orderBy: { name: 'asc' },
    })

    // Map outlet stock & price strictly for currentOutletId
    const mapped = products.map((p) => {
      const op = p.outletProducts[0]
      return {
        ...p,
        stock: op ? op.stock : 0,
        minStock: op ? op.minStock : 5,
        price: op && op.price !== null ? op.price : p.price,
        recipeItems: p.recipeItems.map((r) => {
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
    })

    return res.status(200).json(mapped)
  }

  if (req.method === 'POST') {
    if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const { name, sku, categoryId, type, price, costPrice, unit, stock, minStock, recipeItems, allOutlets } = req.body
    const product = await prisma.product.create({
      data: {
        name,
        sku: sku || null,
        categoryId: categoryId ? Number(categoryId) : null,
        type: type || 'finished',
        price: Number(price) || 0,
        costPrice: Number(costPrice) || 0,
        unit: unit || 'piece',
      },
      include: { category: true },
    })

    const initialStock = Number(stock) || 0
    const initialMinStock = Number(minStock) || 5

    // If allOutlets is true (e.g. global product), assign to all active outlets; otherwise, keep separate to current outlet
    if (allOutlets) {
      const activeOutlets = await prisma.outlet.findMany({ where: { active: true } })
      for (const outlet of activeOutlets) {
        await prisma.outletProduct.create({
          data: {
            outletId: outlet.id,
            productId: product.id,
            stock: outlet.id === currentOutletId ? initialStock : 0,
            minStock: initialMinStock,
            active: true,
          },
        })
      }
    } else {
      // Scoped strictly to the current outlet
      await prisma.outletProduct.create({
        data: {
          outletId: currentOutletId,
          productId: product.id,
          stock: initialStock,
          minStock: initialMinStock,
          active: true,
        },
      })
    }

    // Log stock for current outlet
    if (initialStock > 0) {
      await prisma.stockLog.create({
        data: {
          outletId: currentOutletId,
          productId: product.id,
          type: 'IN',
          quantity: initialStock,
          note: 'Initial stock',
        },
      })
    }

    // Save recipe items for finished products
    if (type === 'finished' && Array.isArray(recipeItems) && recipeItems.length > 0) {
      await prisma.recipeItem.createMany({
        data: recipeItems.map((r: { ingredientId: number; quantity: number; unit: string }) => ({
          productId: product.id,
          ingredientId: Number(r.ingredientId),
          quantity: Number(r.quantity),
          unit: r.unit,
        })),
      })
    }

    return res.status(201).json({
      ...product,
      stock: initialStock,
      minStock: initialMinStock,
    })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
