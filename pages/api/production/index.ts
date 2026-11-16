import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload, getOutletIdFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
  const outletId = await getOutletIdFromRequest(req, user)

  // GET: list finished products that have a recipe (can be produced)
  if (req.method === 'GET') {
    if (!can(user.permissions, user.role, 'inventory', 'view')) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view production' })
    }

    const products = await prisma.product.findMany({
      where: { type: 'finished', active: true, recipeItems: { some: {} } },
      include: {
        outletProducts: { where: { outletId } },
        recipeItems: {
          include: {
            ingredient: {
              include: { outletProducts: { where: { outletId } } },
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

  // POST: record a production run
  if (req.method === 'POST') {
    if (!can(user.permissions, user.role, 'inventory', 'edit')) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to record production' })
    }

    const { productId, quantity } = req.body
    const numQty = Number(quantity)
    const numPid = Number(productId)

    if (!numPid || isNaN(numQty) || numQty <= 0) {
      return res.status(400).json({ error: 'Valid product and positive quantity are required' })
    }

    const product = await prisma.product.findUnique({
      where: { id: numPid },
      include: {
        outletProducts: { where: { outletId } },
        recipeItems: {
          include: {
            ingredient: {
              include: { outletProducts: { where: { outletId } } },
            },
          },
        },
      },
    })

    if (!product) return res.status(404).json({ error: 'Product not found' })
    if (product.type !== 'finished') return res.status(400).json({ error: 'Product must be a finished product' })
    if (product.recipeItems.length === 0) return res.status(400).json({ error: 'No recipe defined for this product' })

    // Check if enough raw materials are available
    for (const recipe of product.recipeItems) {
      const required = recipe.quantity * numQty
      const ingStock = recipe.ingredient.outletProducts[0]?.stock ?? 0
      if (ingStock < required) {
        return res.status(400).json({
          error: `Insufficient stock for ${recipe.ingredient.name}: need ${required} ${recipe.unit}, have ${ingStock}`,
        })
      }
    }

    try {
      // Transaction: deduct raw materials atomically and add to finished product in OutletProduct
      await prisma.$transaction(async (tx) => {
        // Concurrency-safe atomic raw material deduction
        for (const recipe of product.recipeItems) {
          const required = recipe.quantity * numQty
          const updatedIng = await tx.outletProduct.updateMany({
            where: {
              outletId,
              productId: recipe.ingredientId,
              stock: { gte: required },
            },
            data: {
              stock: { decrement: required },
            },
          })

          if (updatedIng.count === 0) {
            throw new Error(`Insufficient stock for ingredient ${recipe.ingredient.name} in concurrent production run`)
          }

          await tx.stockLog.create({
            data: {
              outletId,
              productId: recipe.ingredientId,
              type: 'OUT',
              quantity: required,
              note: `Production: ${numQty} × ${product.name}`,
            },
          })
        }

        // Add to finished product stock
        await tx.outletProduct.upsert({
          where: { outletId_productId: { outletId, productId: product.id } },
          update: { stock: { increment: numQty } },
          create: { outletId, productId: product.id, stock: numQty, minStock: 5 },
        })
        await tx.stockLog.create({
          data: {
            outletId,
            productId: product.id,
            type: 'IN',
            quantity: numQty,
            note: `Produced from raw materials`,
          },
        })
      })

      return res.status(201).json({ message: `Produced ${numQty} × ${product.name} successfully` })
    } catch (err: unknown) {
      return res.status(400).json({ error: err instanceof Error ? err.message : 'Production failed' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
