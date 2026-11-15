import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload, getOutletIdFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const POINTS_PER_AMOUNT = 100 // 1 point per 100 NPR

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
  const outletId = await getOutletIdFromRequest(req)

  if (req.method === 'GET') {
    const { startDate, endDate, customerId, page = '1', limit = '50' } = req.query
    const pageNum = Number(page) || 1
    const limitNum = Number(limit) || 50
    const skip = (pageNum - 1) * limitNum

    const where: Record<string, unknown> = { outletId }
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      }
    }
    if (customerId) where.customerId = Number(customerId)

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          items: { include: { product: true } },
          customer: true,
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.sale.count({ where }),
    ])

    return res.status(200).json({ sales, total })
  }

  if (req.method === 'POST') {
    const { items, discount, paymentMethod, customerPhone, customerName, note, terminalId } = req.body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' })
    }

    let subtotal = 0
    const saleItems: Array<{
      productId: number
      quantity: number
      price: number
      subtotal: number
    }> = []

    // Map to hold recipe info per sale item for later stock deduction
    const recipeMap = new Map<number, Array<{ ingredientId: number; quantity: number; unit: string }>>()

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
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
      if (!product) return res.status(400).json({ error: `Product ${item.productId} not found` })

      const prodStock = product.outletProducts[0]?.stock ?? 0
      if (prodStock < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${product.name} (have ${prodStock})` })
      }

      // Validate raw material availability for finished products with a recipe
      for (const ri of product.recipeItems) {
        const needed = ri.quantity * item.quantity
        const ingStock = ri.ingredient.outletProducts[0]?.stock ?? 0
        if (ingStock < needed) {
          return res.status(400).json({
            error: `Not enough ${ri.ingredient.name} (need ${needed} ${ri.unit}, have ${ingStock})`,
          })
        }
      }

      if (product.recipeItems.length > 0) {
        recipeMap.set(
          item.productId,
          product.recipeItems.map((ri) => ({
            ingredientId: ri.ingredientId,
            quantity: ri.quantity,
            unit: ri.unit,
          }))
        )
      }

      const itemSubtotal = item.price * item.quantity
      subtotal += itemSubtotal
      saleItems.push({ productId: item.productId, quantity: item.quantity, price: item.price, subtotal: itemSubtotal })
    }

    const total = subtotal - (Number(discount) || 0)
    const pointsEarned = Math.floor(total / POINTS_PER_AMOUNT)

    // Resolve customer: lookup by phone, or create if phone provided
    let resolvedCustomerId: number | null = null
    if (customerPhone) {
      const existing = await prisma.customer.findFirst({ where: { phone: customerPhone } })
      if (existing) {
        resolvedCustomerId = existing.id
      } else {
        const newCustomer = await prisma.customer.create({
          data: {
            name: customerName || `Customer (${customerPhone})`,
            phone: customerPhone,
            type: 'regular',
            points: 0,
          },
        })
        resolvedCustomerId = newCustomer.id
      }
    }

    // Create sale, update stock in OutletProduct, and award points in a single transaction
    const sale = await prisma.$transaction(async (tx) => {
      const s = await tx.sale.create({
        data: {
          outletId,
          terminalId: terminalId ? Number(terminalId) : null,
          userId: user.userId,
          customerId: resolvedCustomerId,
          total,
          discount: Number(discount) || 0,
          paymentMethod: paymentMethod || 'cash',
          pointsEarned,
          note,
          items: { create: saleItems },
        },
        include: {
          items: { include: { product: { select: { name: true } } } },
          user: { select: { name: true } },
          customer: { select: { id: true, name: true, phone: true, points: true } },
        },
      })

      // Deduct finished product stock from OutletProduct
      for (const item of saleItems) {
        await tx.outletProduct.upsert({
          where: { outletId_productId: { outletId, productId: item.productId } },
          update: { stock: { decrement: item.quantity } },
          create: { outletId, productId: item.productId, stock: -item.quantity, minStock: 5 },
        })

        await tx.stockLog.create({
          data: {
            outletId,
            productId: item.productId,
            type: 'OUT',
            quantity: item.quantity,
            note: `Sale #${s.id}`,
          },
        })

        // Auto-deduct raw materials based on recipe
        const recipe = recipeMap.get(item.productId)
        if (recipe) {
          for (const ri of recipe) {
            const used = ri.quantity * item.quantity
            await tx.outletProduct.upsert({
              where: { outletId_productId: { outletId, productId: ri.ingredientId } },
              update: { stock: { decrement: used } },
              create: { outletId, productId: ri.ingredientId, stock: -used, minStock: 5 },
            })

            await tx.stockLog.create({
              data: {
                outletId,
                productId: ri.ingredientId,
                type: 'OUT',
                quantity: used,
                note: `Sale #${s.id} (ingredient)`,
              },
            })
          }
        }
      }

      // Award points if customer is linked
      if (resolvedCustomerId && pointsEarned > 0) {
        await tx.customer.update({
          where: { id: resolvedCustomerId },
          data: { points: { increment: pointsEarned } },
        })
      }

      return s
    })

    return res.status(201).json(sale)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
