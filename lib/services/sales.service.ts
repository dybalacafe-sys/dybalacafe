import { prisma } from '@/lib/prisma'

const POINTS_PER_AMOUNT = 100 // 1 point per 100 NPR

export interface CreateSaleInput {
  outletId: number
  userId: number
  items: Array<{ productId: number; quantity: number }>
  discount?: number
  paymentMethod?: string
  customerPhone?: string
  customerName?: string
  note?: string
  terminalId?: number
}

export interface GetSalesParams {
  outletId: number
  startDate?: string
  endDate?: string
  customerId?: number
  page?: number
  limit?: number
}

export const salesService = {
  async getSales({ outletId, startDate, endDate, customerId, page = 1, limit = 50 }: GetSalesParams) {
    const pageNum = Math.max(1, page)
    const limitNum = Math.min(100, Math.max(1, limit))
    const skip = (pageNum - 1) * limitNum

    const where: Record<string, unknown> = { outletId }
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }
    if (customerId) where.customerId = customerId

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

    return { sales, total, page: pageNum, limit: limitNum }
  },

  async createSale({
    outletId,
    userId,
    items,
    discount,
    paymentMethod,
    customerPhone,
    customerName,
    note,
    terminalId,
  }: CreateSaleInput) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Cart is empty')
    }

    // 1. Consolidate and validate requested quantities
    const consolidatedMap = new Map<number, number>()
    for (const item of items) {
      const pid = Number(item.productId)
      const qty = Number(item.quantity)
      if (!pid || isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
        throw new Error('Invalid product or quantity specified in cart')
      }
      consolidatedMap.set(pid, (consolidatedMap.get(pid) || 0) + qty)
    }

    return await prisma.$transaction(async (tx) => {
      // 2. Batch fetch all products in cart (Eliminates N+1 query loop)
      const productIds = Array.from(consolidatedMap.keys())
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
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
      const productMap = new Map(products.map((p) => [p.id, p]))

      let subtotal = 0
      const saleItems: Array<{
        productId: number
        quantity: number
        price: number
        subtotal: number
      }> = []
      const recipeMap = new Map<number, Array<{ ingredientId: number; quantity: number; unit: string }>>()

      for (const [productId, quantity] of Array.from(consolidatedMap.entries())) {
        const product = productMap.get(productId)
        if (!product) throw new Error(`Product #${productId} not found`)

        const op = product.outletProducts[0]
        const currentStock = op?.stock ?? 0
        if (currentStock < quantity) {
          throw new Error(`Insufficient stock for ${product.name} (available: ${currentStock})`)
        }

        for (const ri of product.recipeItems) {
          const needed = ri.quantity * quantity
          const ingStock = ri.ingredient.outletProducts[0]?.stock ?? 0
          if (ingStock < needed) {
            throw new Error(`Not enough ${ri.ingredient.name} (need ${needed} ${ri.unit}, have ${ingStock})`)
          }
        }

        if (product.recipeItems.length > 0) {
          recipeMap.set(
            productId,
            product.recipeItems.map((ri) => ({
              ingredientId: ri.ingredientId,
              quantity: ri.quantity,
              unit: ri.unit,
            }))
          )
        }

        // Verified server pricing from database
        const price = op?.price ?? product.price
        const itemSubtotal = price * quantity
        subtotal += itemSubtotal
        saleItems.push({ productId, quantity, price, subtotal: itemSubtotal })
      }

      const safeDiscount = Math.max(0, Math.min(Number(discount) || 0, subtotal))
      const total = subtotal - safeDiscount
      const pointsEarned = Math.floor(total / POINTS_PER_AMOUNT)

      // Resolve customer
      let resolvedCustomerId: number | null = null
      if (customerPhone) {
        const existing = await tx.customer.findFirst({ where: { phone: customerPhone } })
        if (existing) {
          resolvedCustomerId = existing.id
        } else {
          const newCustomer = await tx.customer.create({
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

      // Record Sale
      const s = await tx.sale.create({
        data: {
          outletId,
          terminalId: terminalId ? Number(terminalId) : null,
          userId,
          customerId: resolvedCustomerId,
          total,
          discount: safeDiscount,
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

      // Concurrency-Safe Atomic Decrements (aggregated per productId to avoid duplicate updates)
      const stockDecrements = new Map<number, { qty: number; label: string }>()
      const stockLogs: { outletId: number; productId: number; type: string; quantity: number; note: string }[] = []

      const addDecrement = (productId: number, qty: number, label: string) => {
        const existing = stockDecrements.get(productId)
        if (existing) {
          existing.qty += qty
        } else {
          stockDecrements.set(productId, { qty, label })
        }
      }

      for (const item of saleItems) {
        const product = productMap.get(item.productId)
        addDecrement(item.productId, item.quantity, product?.name || String(item.productId))
        stockLogs.push({
          outletId,
          productId: item.productId,
          type: 'OUT',
          quantity: item.quantity,
          note: `Sale #${s.id}`,
        })

        const recipe = recipeMap.get(item.productId)
        if (recipe) {
          for (const ri of recipe) {
            const used = ri.quantity * item.quantity
            addDecrement(ri.ingredientId, used, `recipe ingredient #${ri.ingredientId}`)
            stockLogs.push({
              outletId,
              productId: ri.ingredientId,
              type: 'OUT',
              quantity: used,
              note: `Sale #${s.id} (ingredient)`,
            })
          }
        }
      }

      await Promise.all(
        Array.from(stockDecrements.entries()).map(async ([productId, { qty, label }]) => {
          const updated = await tx.outletProduct.updateMany({
            where: { outletId, productId, stock: { gte: qty } },
            data: { stock: { decrement: qty } },
          })
          if (updated.count === 0) {
            throw new Error(`Insufficient stock for ${label} (concurrent sale conflict)`)
          }
        })
      )

      if (stockLogs.length > 0) {
        await tx.stockLog.createMany({ data: stockLogs })
      }

      if (resolvedCustomerId && pointsEarned > 0) {
        await tx.customer.update({
          where: { id: resolvedCustomerId },
          data: { points: { increment: pointsEarned } },
        })
      }

      return s
    }, { timeout: 15000 })
  },
}
