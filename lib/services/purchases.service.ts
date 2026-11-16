import { prisma } from '@/lib/prisma'

export interface CreatePurchaseInput {
  outletId: number
  supplierId: number
  total: number
  paid?: number
  note?: string
  date?: string
  items?: Array<{
    productId?: number
    name?: string
    quantity?: number
    price?: number
    subtotal?: number
  }>
}

export interface AllocatePaymentInput {
  outletId: number
  supplierId: number
  amount: number
  note?: string
  date?: string
}

export const purchasesService = {
  async getPurchases(outletId: number, supplierId?: number) {
    const where: Record<string, unknown> = { outletId }
    if (supplierId) {
      where.supplierId = supplierId
    }

    return await prisma.purchase.findMany({
      where,
      include: {
        supplier: {
          select: { id: true, name: true, phone: true },
        },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  },

  async createPurchase({
    outletId,
    supplierId,
    total,
    paid = 0,
    note,
    items = [],
    date,
  }: CreatePurchaseInput) {
    const numTotal = Number(total)
    const numPaid = Number(paid) || 0

    if (!supplierId || isNaN(numTotal) || numTotal <= 0) {
      throw new Error('Valid supplier and positive total amount are required')
    }

    if (isNaN(numPaid) || numPaid < 0 || numPaid > numTotal) {
      throw new Error('Paid amount must be between 0 and the total bill amount')
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id: Number(supplierId) },
    })
    if (!supplier) throw new Error('Supplier not found')

    const numDue = numTotal - numPaid
    const purchaseDate = date ? new Date(date) : new Date()

    return await prisma.$transaction(async (tx) => {
      const p = await tx.purchase.create({
        data: {
          outletId,
          supplierId: Number(supplierId),
          total: numTotal,
          paid: numPaid,
          due: numDue,
          note: note ? String(note).trim() : null,
          createdAt: purchaseDate,
          items:
            Array.isArray(items) && items.length > 0
              ? {
                  create: items.map((it) => ({
                    productId: it.productId ? Number(it.productId) : 1,
                    name: it.name || 'Supply Item',
                    quantity: Number(it.quantity) || 1,
                    price: Number(it.price) || 0,
                    subtotal: Number(it.subtotal) || (Number(it.quantity) || 1) * (Number(it.price) || 0),
                  })),
                }
              : undefined,
        },
        include: {
          supplier: true,
          items: true,
        },
      })

      // If paid upfront, record operating expense
      if (numPaid > 0) {
        await tx.expense.create({
          data: {
            outletId,
            category: 'Supplies',
            amount: numPaid,
            description: `Vendor bill #${p.id} (${supplier.name})${note ? ' - ' + note : ''}`,
            date: purchaseDate,
          },
        })
      }

      return p
    })
  },

  async allocatePayment({ outletId, supplierId, amount, note, date }: AllocatePaymentInput) {
    const numAmount = Number(amount)
    if (!supplierId || isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Valid supplierId and positive payment amount are required')
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id: Number(supplierId) },
    })
    if (!supplier) throw new Error('Supplier not found')

    const paymentDate = date ? new Date(date) : new Date()

    return await prisma.$transaction(async (tx) => {
      // Find all purchases with due balance inside transaction to prevent race conditions
      const unpaidPurchases = await tx.purchase.findMany({
        where: {
          outletId,
          supplierId: Number(supplierId),
          due: { gt: 0 },
        },
        orderBy: { createdAt: 'asc' },
      })

      const totalOutstanding = unpaidPurchases.reduce((sum, p) => sum + p.due, 0)
      if (totalOutstanding <= 0) {
        throw new Error('This supplier has no outstanding credit balance')
      }

      if (numAmount > totalOutstanding) {
        throw new Error(
          `Payment amount (NPR ${numAmount.toLocaleString()}) exceeds total outstanding due (NPR ${totalOutstanding.toLocaleString()})`
        )
      }

      let remaining = numAmount
      for (const p of unpaidPurchases) {
        if (remaining <= 0) break

        const payThis = Math.min(remaining, p.due)
        const newPaid = p.paid + payThis
        const newDue = p.due - payThis

        await tx.purchase.update({
          where: { id: p.id },
          data: {
            paid: newPaid,
            due: newDue,
            note: p.note
              ? `${p.note} | Paid NPR ${payThis.toLocaleString()} on ${paymentDate.toISOString().slice(0, 10)}`
              : `Paid NPR ${payThis.toLocaleString()} on ${paymentDate.toISOString().slice(0, 10)}`,
          },
        })

        remaining -= payThis
      }

      // Record cash payment in operating expenses
      await tx.expense.create({
        data: {
          outletId,
          category: 'Supplies',
          amount: numAmount,
          description: `Vendor Credit Payment (${supplier.name})${note ? ' - ' + note : ''}`,
          date: paymentDate,
        },
      })

      return {
        totalOutstanding,
        paidAmount: numAmount,
        newRemainingDue: totalOutstanding - numAmount,
      }
    })
  },
}
