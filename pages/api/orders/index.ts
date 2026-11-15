import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload, getOutletIdFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
  const outletId = await getOutletIdFromRequest(req)
  const outlet = await prisma.outlet.findUnique({ where: { id: outletId } })
  const outletCode = outlet?.code || 'ORD'

  if (req.method === 'GET') {
    const { status, customerId, page = '1', limit = '50', search } = req.query
    const pageNum = Number(page) || 1
    const limitNum = Number(limit) || 50
    const skip = (pageNum - 1) * limitNum

    const where: Record<string, unknown> = { outletId }
    if (status) where.status = status
    if (customerId) where.customerId = Number(customerId)
    if (search) {
      where.OR = [
        { customerName: { contains: search as string } },
        { orderNumber: { contains: search as string } },
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

    return res.status(200).json({ orders, total })
  }

  if (req.method === 'POST') {
    const { customerName, customerPhone, customerId, deliveryDate, note, items, advancePaid } = req.body

    if (!customerName || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Customer name and items are required' })
    }

    let total = 0
    const orderItems = items.map((item: { name: string; productId?: number; quantity: number; price: number }) => {
      const subtotal = item.price * item.quantity
      total += subtotal
      return { name: item.name, productId: item.productId || null, quantity: item.quantity, price: item.price, subtotal }
    })

    const advance = Number(advancePaid) || 0
    const balance = total - advance
    let paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' = 'UNPAID'
    if (advance >= total) paymentStatus = 'PAID'
    else if (advance > 0) paymentStatus = 'PARTIAL'

    // Resolve customer: use provided customerId, or look up / create by phone
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

    const count = await prisma.order.count({ where: { outletId } })
    const orderNumber = `${outletCode}-${String(count + 1).padStart(4, '0')}`

    const order = await prisma.order.create({
      data: {
        orderNumber,
        outletId,
        customerName,
        customerPhone: customerPhone || null,
        customerId: resolvedCustomerId,
        userId: user.userId,
        totalAmount: total,
        advancePaid: advance,
        balanceDue: balance,
        paymentStatus,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        note,
        items: { create: orderItems },
      },
      include: { items: true, user: { select: { name: true } } },
    })

    return res.status(201).json(order)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
