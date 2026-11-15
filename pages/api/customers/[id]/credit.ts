// pages/api/customers/[id]/credit.ts
// Records a credit repayment against a specific table session
import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
    const customerId = Number(req.query.id)

    // ── POST: record a credit payment ────────────────────────────────────────────
    if (req.method === 'POST') {
        const { sessionId, amount, note } = req.body

        if (!sessionId || !amount || Number(amount) <= 0) {
            return res.status(400).json({ error: 'sessionId and a positive amount are required' })
        }

        const session = await prisma.tableSession.findUnique({
            where: { id: Number(sessionId) },
            include: {
                creditPayments: { select: { amount: true } },
            },
        })

        if (!session) return res.status(404).json({ error: 'Session not found' })
        if (session.customerId !== customerId) {
            return res.status(403).json({ error: 'Session does not belong to this customer' })
        }
        if (session.creditAmount <= 0) {
            return res.status(400).json({ error: 'This session has no credit outstanding' })
        }

        // How much credit has already been repaid
        const alreadyPaid = session.creditPayments.reduce((s, p) => s + p.amount, 0)
        const remaining = session.creditAmount - alreadyPaid

        if (Number(amount) > remaining) {
            return res.status(400).json({
                error: `Payment exceeds remaining credit (NPR ${remaining.toLocaleString()} due)`,
            })
        }

        const payment = await prisma.$transaction(async (tx) => {
            const p = await tx.creditPayment.create({
                data: {
                    sessionId: Number(sessionId),
                    amount: Number(amount),
                    note: note || null,
                    recordedById: user.userId,
                },
                include: { recordedBy: { select: { name: true } } },
            })

            // Mark session as credit-paid if fully settled
            const newTotal = alreadyPaid + Number(amount)
            if (newTotal >= session.creditAmount) {
                await tx.tableSession.update({
                    where: { id: Number(sessionId) },
                    data: { creditPaid: true },
                })
                // Reduce customer's creditUsed
                await tx.customer.update({
                    where: { id: customerId },
                    data: { creditUsed: { decrement: session.creditAmount } },
                })
            }

            return p
        })

        return res.status(201).json(payment)
    }

    return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)