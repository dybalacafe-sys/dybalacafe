import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload, getOutletIdFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function handler(req: NextApiRequest, res: NextApiResponse, _user: JWTPayload) {
  const outletId = await getOutletIdFromRequest(req)

  if (req.method === 'GET') {
    const { startDate, endDate } = req.query
    const where: Record<string, unknown> = { outletId }
    if (startDate && endDate) {
      where.date = { gte: new Date(startDate as string), lte: new Date(endDate as string) }
    }
    const expenses = await prisma.expense.findMany({ where, orderBy: { date: 'desc' } })
    const total = expenses.reduce((s, e) => s + e.amount, 0)
    return res.status(200).json({ expenses, total })
  }

  if (req.method === 'POST') {
    const { category, amount, description, date } = req.body
    const expense = await prisma.expense.create({
      data: {
        outletId,
        category,
        amount: Number(amount),
        description,
        date: date ? new Date(date) : new Date(),
      },
    })
    return res.status(201).json(expense)
  }

  if (req.method === 'DELETE') {
    const { id } = req.query
    await prisma.expense.delete({ where: { id: Number(id) } })
    return res.status(200).json({ message: 'Deleted' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
