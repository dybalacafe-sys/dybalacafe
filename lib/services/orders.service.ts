import { prisma } from '@/lib/prisma'

export interface CreateOrderInput {
  outletId: number
  userId: number
  customerName: string
  customerPhone?: string
  customerId?: number
  deliveryDate?: string
  note?: string
  items: Array<{
    name: string
    productId?: number
    quantity: number
    price: number
  }>
  advancePaid?: number
}

export interface GetOrdersParams {
  outletId: number
  status?: string
  customerId?: number
  search?: string
  page?: number
  limit?: number
}

export const ordersService = {
  async getOrders({ outletId, status, customerId, search, page = 1, limit = 50 }: GetOrdersParams) {
    const pageNum = Math.max(1, page)
    const limitNum = Math.min(100, Math.max(1, limit))
    const skip = (pageNum - 1) * limitNum

    const where: Record<string, unknown> = { outletId }
    if (status) where.status = status
    if (customerId) where.customerId = customerId
    if (search) {
      where.OR = [
        { customerName: { contains: search } },
        { orderNumber: { contains: search } },
      ]
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
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
      prisma.order.count({ where }),
    ])

    return { orders, total, page: pageNum, limit: limitNum }
  },

  async getOrderById(id: number) {
    return await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        user: { select: { name: true } },
        customer: { select: { id: true, name: true, phone: true, creditLimit: true, creditUsed: true } },
      },
    })
  },

  async createOrder({
    outletId,
    userId,
    customerName,
    customerPhone,
    customerId,
    deliveryDate,
    note,
    items,
    advancePaid = 0,
  }: CreateOrderInput) {
    if (!customerName || !items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Customer name and items are required')
    }

    let total = 0
    const orderItems = items.map((item) => {
      const qty = Number(item.quantity)
      if (isNaN(qty) || qty <= 0) {
        throw new Error('Item quantity must be a positive number')
      }
      const price = Number(item.price)
      if (isNaN(price) || price < 0) {
        throw new Error('Item price must be a non-negative number')
      }
      const subtotal = price * qty
      total += subtotal
      return {
        name: String(item.name).trim(),
        productId: item.productId ? Number(item.productId) : null,
        quantity: qty,
        price,
        subtotal,
      }
    })

    const advance = Number(advancePaid) || 0
    if (isNaN(advance) || advance < 0) {
      throw new Error('Advance paid must be a non-negative number')
    }
    if (advance > total) {
      throw new Error('Advance paid cannot exceed the total order amount')
    }

    const outlet = await prisma.outlet.findUnique({ where: { id: outletId } })
    const outletCode = outlet?.code || 'ORD'
    const balance = total - advance
    let paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' = 'UNPAID'
    if (advance >= total) paymentStatus = 'PAID'
    else if (advance > 0) paymentStatus = 'PARTIAL'

    // Resolve customer
    let resolvedCustomerId: number | null = customerId ? Number(customerId) : null
    if (!resolvedCustomerId && customerPhone) {
      const existing = await prisma.customer.findFirst({ where: { phone: customerPhone } })
      if (existing) {
        resolvedCustomerId = existing.id
      } else {
        const created = await prisma.customer.create({
          data: { name: customerName, phone: customerPhone, type: 'regular', points: 0 },
        })
        resolvedCustomerId = created.id
      }
    }

    // Collision-safe unique order number generation
    const count = await prisma.order.count({ where: { outletId } })
    const baseNum = String(count + 1).padStart(4, '0')
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
    const orderNumber = `${outletCode}-${baseNum}-${randomSuffix}`

    if (balance > 0 && resolvedCustomerId) {
      const customer = await prisma.customer.findUnique({ where: { id: resolvedCustomerId } })
      if (customer && customer.creditLimit > 0) {
        const available = customer.creditLimit - customer.creditUsed
        if (balance > available) {
          throw new Error(
            `Insufficient customer credit limit. Available: NPR ${available.toLocaleString()}, Requested: NPR ${balance.toLocaleString()}`
          )
        }
      }
    }

    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber,
          outletId,
          customerName: customerName.trim(),
          customerPhone: customerPhone ? String(customerPhone).trim() : null,
          customerId: resolvedCustomerId,
          userId,
          totalAmount: total,
          advancePaid: advance,
          balanceDue: balance,
          paymentStatus,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
          note: note ? String(note).trim() : null,
          items: { create: orderItems },
        },
        include: { items: true, user: { select: { name: true } } },
      })

      if (resolvedCustomerId && balance > 0) {
        await tx.customer.update({
          where: { id: resolvedCustomerId },
          data: { creditUsed: { increment: balance } },
        })
      }

      return order
    })
  },

  async updateOrder(id: number, input: { status?: string; advancePaid?: number }) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { customer: { select: { id: true, creditLimit: true, creditUsed: true } } },
    })
    if (!order) throw new Error('Order not found')

    const newAdvance = input.advancePaid !== undefined ? Number(input.advancePaid) : order.advancePaid
    if (newAdvance > order.totalAmount || newAdvance < 0) {
      throw new Error('Advance must be between 0 and order total')
    }

    const newBalance = order.totalAmount - newAdvance
    let paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' = 'UNPAID'
    if (newAdvance >= order.totalAmount) paymentStatus = 'PAID'
    else if (newAdvance > 0) paymentStatus = 'PARTIAL'

    const balanceDelta = newBalance - order.balanceDue
    if (balanceDelta > 0 && order.customer) {
      const available = order.customer.creditLimit - order.customer.creditUsed
      if (balanceDelta > available && order.customer.creditLimit > 0) {
        throw new Error(`Insufficient credit limit. Available: NPR ${available.toLocaleString()}`)
      }
    }

    return await prisma.$transaction(async (tx) => {
      const u = await tx.order.update({
        where: { id },
        data: {
          ...(input.status && { status: input.status as any }),
          advancePaid: newAdvance,
          balanceDue: newBalance,
          paymentStatus,
        },
        include: {
          items: true,
          user: { select: { name: true } },
          customer: { select: { id: true, name: true, phone: true, creditLimit: true, creditUsed: true } },
        },
      })

      if (order.customer?.id) {
        const balanceDiff = newBalance - order.balanceDue
        if (balanceDiff !== 0) {
          await tx.customer.update({
            where: { id: order.customer.id },
            data: { creditUsed: { increment: balanceDiff } },
          })
        }
      }

      return u
    })
  },

  async cancelOrder(id: number) {
    const order = await prisma.order.findUnique({ where: { id } })
    if (!order) throw new Error('Order not found')
    if (order.status === 'CANCELLED') return order

    return await prisma.$transaction(async (tx) => {
      const cancelled = await tx.order.update({
        where: { id },
        data: { status: 'CANCELLED' },
      })

      if (order.customerId && order.balanceDue > 0) {
        await tx.customer.update({
          where: { id: order.customerId },
          data: { creditUsed: { decrement: order.balanceDue } },
        })
      }

      return cancelled
    })
  },
}
