import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload, getOutletIdFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
  let currentOutletId: number
  try {
    currentOutletId = await getOutletIdFromRequest(req, user)
  } catch (err: unknown) {
    return res.status(403).json({ error: err instanceof Error ? err.message : 'Forbidden: Outlet access denied' })
  }

  if (req.method === 'GET') {
    if (!can(user.permissions, user.role, 'inventory', 'view')) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view products' })
    }
    const { type, search, categoryId } = req.query
    const where: Record<string, unknown> = {
      active: true,
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

    const mapped = products.map((p) => {
      const op = p.outletProducts[0]
      return {
        ...p,
        stock: op ? op.stock : 0,
        minStock: op ? op.minStock : 5,
        price: op?.price ?? p.price,
        recipeItems: p.recipeItems.map((r) => {
          const ingOp = r.ingredient.outletProducts[0]
          return {
            ...r,
            ingredient: {
              ...r.ingredient,
              stock: ingOp ? ingOp.stock : 0,
            },
          }
        }),
      }
    })

    return res.status(200).json(mapped)
  }

  if (req.method === 'POST') {
    if (!can(user.permissions, user.role, 'inventory', 'edit')) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to create products' })
    }

    const { name, sku, categoryId, type, price, costPrice, unit, stock, minStock, recipeItems, allOutlets } = req.body

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Product name is required' })
    }

    if (price !== undefined && (isNaN(Number(price)) || Number(price) < 0)) {
      return res.status(400).json({ error: 'Price must be a non-negative number' })
    }
    if (costPrice !== undefined && (isNaN(Number(costPrice)) || Number(costPrice) < 0)) {
      return res.status(400).json({ error: 'Cost price must be a non-negative number' })
    }
    if (stock !== undefined && (isNaN(Number(stock)) || Number(stock) < 0)) {
      return res.status(400).json({ error: 'Stock must be a non-negative number' })
    }
    if (minStock !== undefined && (isNaN(Number(minStock)) || Number(minStock) < 0)) {
      return res.status(400).json({ error: 'Min stock must be a non-negative number' })
    }

    const initialStock = Number(stock) || 0
    const initialMinStock = minStock !== undefined ? Number(minStock) : 5
    const numPrice = Number(price) || 0
    const numCost = Number(costPrice) || 0

    try {
      const product = await prisma.$transaction(async (tx) => {
        const p = await tx.product.create({
          data: {
            name: name.trim(),
            sku: sku ? String(sku).trim() : null,
            categoryId: categoryId ? Number(categoryId) : null,
            type: type || 'finished',
            price: numPrice,
            costPrice: numCost,
            unit: unit || 'piece',
          },
          include: { category: true },
        })

        if (allOutlets) {
          const activeOutlets = await tx.outlet.findMany({ where: { active: true }, select: { id: true } })
          if (activeOutlets.length > 0) {
            await tx.outletProduct.createMany({
              data: activeOutlets.map((outlet) => ({
                outletId: outlet.id,
                productId: p.id,
                stock: outlet.id === currentOutletId ? initialStock : 0,
                minStock: initialMinStock,
                active: true,
              })),
            })
          }
        } else {
          await tx.outletProduct.create({
            data: {
              outletId: currentOutletId,
              productId: p.id,
              stock: initialStock,
              minStock: initialMinStock,
              active: true,
            },
          })
        }

        if (initialStock > 0) {
          await tx.stockLog.create({
            data: {
              outletId: currentOutletId,
              productId: p.id,
              type: 'IN',
              quantity: initialStock,
              note: 'Initial stock',
            },
          })
        }

        if (type === 'finished' && Array.isArray(recipeItems) && recipeItems.length > 0) {
          await tx.recipeItem.createMany({
            data: recipeItems.map((r: { ingredientId: number; quantity: number; unit: string }) => ({
              productId: p.id,
              ingredientId: Number(r.ingredientId),
              quantity: Number(r.quantity),
              unit: r.unit || 'piece',
            })),
          })
        }

        return p
      })

      return res.status(201).json(product)
    } catch (err: unknown) {
      return res.status(400).json({ error: err instanceof Error ? err.message : 'Product creation failed' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
