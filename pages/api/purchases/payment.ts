import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload, getOutletIdFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function handler(req: NextApiRequest, res: NextApiResponse, _user: JWTPayload) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const outletId = await getOutletIdFromRequest(req)
  const { supplierId, amount, note, date } = req.body

  const numAmount = Number(amount)
  if (!supplierId || isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: 'Valid supplierId and positive payment amount are required' })
  }

  const supplier = await prisma.supplier.findUnique({
    where: { id: Number(supplierId) },
  })

  if (!supplier) {
    return res.status(404).json({ error: 'Supplier not found' })
  }

  // Find all purchases with due balance for this supplier in this outlet
  const unpaidPurchases = await prisma.purchase.findMany({
    where: {
      outletId,
      supplierId: Number(supplierId),
      due: { gt: 0 },
    },
    orderBy: { createdAt: 'asc' },
  })

  const totalOutstanding = unpaidPurchases.reduce((sum, p) => sum + p.due, 0)
  if (totalOutstanding <= 0) {
    return res.status(400).json({ error: 'This supplier has no outstanding credit balance' })
  }

  if (numAmount > totalOutstanding) {
    return res.status(400).json({
      error: `Payment amount (NPR ${numAmount.toLocaleString()}) exceeds total outstanding due (NPR ${totalOutstanding.toLocaleString()})`,
    })
  }

  const paymentDate = date ? new Date(date) : new Date()

  await prisma.$transaction(async (tx) => {
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
  })

  return res.status(200).json({
    message: 'Vendor payment recorded successfully',
    supplierId,
    paidAmount: numAmount,
    newRemainingDue: totalOutstanding - numAmount,
  })
}

export default withAuth(handler)
