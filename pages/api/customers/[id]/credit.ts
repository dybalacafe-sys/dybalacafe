// pages/api/customers/[id]/credit.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
    const customerId = Number(req.query.id)
    if (!customerId || isNaN(customerId)) return res.status(400).json({ error: 'Invalid customer ID' })

    if (req.method === 'POST') {
        if (!can(user.permissions, user.role, 'customers', 'edit')) {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions to record credit repayment' })
        }

        const { sessionId, amount, note } = req.body
        const numAmount = Number(amount)

        if (!sessionId || isNaN(numAmount) || numAmount <= 0) {
            return res.status(400).json({ error: 'sessionId and a positive amount are required' })
        }

        try {
            const payment = await prisma.$transaction(async (tx) => {
                const session = await tx.tableSession.findUnique({
                    where: { id: Number(sessionId) },
                    include: {
                        creditPayments: { select: { amount: true } },
                    },
                })

                if (!session) throw new Error('Session not found')
                if (session.customerId !== customerId) {
                    throw new Error('Session does not belong to this customer')
                }
                if (session.creditAmount <= 0) {
                    throw new Error('This session has no credit outstanding')
                }

                const alreadyPaid = session.creditPayments.reduce((s, p) => s + p.amount, 0)
                const remaining = session.creditAmount - alreadyPaid

                if (numAmount > remaining) {
                    throw new Error(`Payment exceeds remaining credit (NPR ${remaining.toLocaleString()} due)`)
                }

                const p = await tx.creditPayment.create({
                    data: {
                        sessionId: Number(sessionId),
                        amount: numAmount,
                        note: note ? String(note).trim() : null,
                        recordedById: user.userId,
                    },
                    include: { recordedBy: { select: { name: true } } },
                })

                const newTotal = alreadyPaid + numAmount
                if (newTotal >= session.creditAmount) {
                    await tx.tableSession.update({
                        where: { id: Number(sessionId) },
                        data: { creditPaid: true },
                    })
                }

                await tx.customer.update({
                    where: { id: customerId },
                    data: { creditUsed: { decrement: numAmount } },
                })

                return p
            })

            return res.status(201).json(payment)
        } catch (err: unknown) {
            return res.status(400).json({ error: err instanceof Error ? err.message : 'Credit payment failed' })
        }
    }

    return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
