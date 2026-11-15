// pages/api/customers/credit.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function handler(req: NextApiRequest, res: NextApiResponse, _user: JWTPayload) {
    if (req.method === 'GET') {
        const { search } = req.query
        const where: Record<string, unknown> = {}
        if (search) where.name = { contains: search as string }

        const customers = await prisma.customer.findMany({
            where,
            include: {
                _count: { select: { orders: true } },
                // Pull outstanding credit sessions so we can compute totals
                tableSessions: {
                    where: { status: 'CLOSED', creditAmount: { gt: 0 } },
                    select: {
                        id: true,
                        grandTotal: true,
                        creditAmount: true,
                        paidAmount: true,
                        creditPaid: true,
                    },
                },
            },
            orderBy: { name: 'asc' },
        })

        // Compute live credit balance per customer
        const result = customers.map(c => {
            const totalCredit = c.tableSessions.reduce((s, ts) => s + ts.creditAmount, 0)
            const totalCreditPaid = c.tableSessions
                .filter(ts => ts.creditPaid)
                .reduce((s, ts) => s + ts.creditAmount, 0)
            const outstandingCredit = totalCredit - totalCreditPaid

            return {
                ...c,
                tableSessions: undefined, // don't expose raw sessions in list
                creditUsed: outstandingCredit,
                totalCredit,
            }
        })

        return res.status(200).json(result)
    }

    if (req.method === 'POST') {
        const { name, phone, email, address, type, creditLimit } = req.body
        const customer = await prisma.customer.create({
            data: {
                name,
                phone,
                email,
                address,
                type: type || 'regular',
                creditLimit: Number(creditLimit) || 0,
            },
        })
        return res.status(201).json(customer)
    }

    return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)