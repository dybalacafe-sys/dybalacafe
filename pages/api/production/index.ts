import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload, getOutletIdFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function handler(req: NextApiRequest, res: NextApiResponse, _user: JWTPayload) {
  const outletId = await getOutletIdFromRequest(req)

  // GET: list finished products that have a recipe (can be produced)
  if (req.method === 'GET') {
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
    const { productId, quantity } = req.body
    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Product and quantity are required' })
    }

    const product = await prisma.product.findUnique({
      where: { id: Number(productId) },
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
      const required = recipe.quantity * quantity
      const ingStock = recipe.ingredient.outletProducts[0]?.stock ?? 0
      if (ingStock < required) {
        return res.status(400).json({
          error: `Insufficient stock for ${recipe.ingredient.name}: need ${required} ${recipe.unit}, have ${ingStock}`,
        })
      }
    }

    // Transaction: deduct raw materials and add to finished product in OutletProduct
    await prisma.$transaction(async (tx) => {
      // Deduct each raw material
      for (const recipe of product.recipeItems) {
        const required = recipe.quantity * quantity
        await tx.outletProduct.upsert({
          where: { outletId_productId: { outletId, productId: recipe.ingredientId } },
          update: { stock: { decrement: required } },
          create: { outletId, productId: recipe.ingredientId, stock: -required, minStock: 5 },
        })
        await tx.stockLog.create({
          data: {
            outletId,
            productId: recipe.ingredientId,
            type: 'OUT',
            quantity: required,
            note: `Production: ${quantity} × ${product.name}`,
          },
        })
      }

      // Add to finished product stock
      await tx.outletProduct.upsert({
        where: { outletId_productId: { outletId, productId: product.id } },
        update: { stock: { increment: quantity } },
        create: { outletId, productId: product.id, stock: quantity, minStock: 5 },
      })
      await tx.stockLog.create({
        data: {
          outletId,
          productId: product.id,
          type: 'IN',
          quantity,
          note: `Produced from raw materials`,
        },
      })
    })

    return res.status(201).json({ message: `Produced ${quantity} × ${product.name} successfully` })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
