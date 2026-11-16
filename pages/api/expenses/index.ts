import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload, getOutletIdFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
  const outletId = await getOutletIdFromRequest(req, user)

  if (req.method === 'GET') {
    if (!can(user.permissions, user.role, 'expenses', 'view')) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view expenses' })
    }
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
    if (!can(user.permissions, user.role, 'expenses', 'edit')) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to create expenses' })
    }
    const { category, amount, description, date } = req.body
    const numAmount = Number(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' })
    }
    const expense = await prisma.expense.create({
      data: {
        outletId,
        category: category || 'Miscellaneous',
        amount: numAmount,
        description,
        date: date ? new Date(date) : new Date(),
      },
    })
    return res.status(201).json(expense)
  }

  if (req.method === 'DELETE') {
    if (!can(user.permissions, user.role, 'expenses', 'delete')) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to delete expenses' })
    }
    const { id } = req.query
    const expenseId = Number(id)
    if (!expenseId || isNaN(expenseId)) {
      return res.status(400).json({ error: 'Invalid expense ID' })
    }
    // Verify expense belongs to this outlet (or user is SUPER_ADMIN)
    const existing = await prisma.expense.findUnique({ where: { id: expenseId } })
    if (!existing || (user.role !== 'SUPER_ADMIN' && existing.outletId !== outletId)) {
      return res.status(404).json({ error: 'Expense not found' })
    }
    await prisma.expense.delete({ where: { id: expenseId } })
    return res.status(200).json({ message: 'Deleted' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
