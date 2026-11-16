// pages/api/customers/index.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
    if (req.method === 'GET') {
        if (!can(user.permissions, user.role, 'customers', 'view')) {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view customers' })
        }
        const { search } = req.query
        const where: Record<string, unknown> = {}
        if (search) where.name = { contains: search as string }

        const customers = await prisma.customer.findMany({
            where,
            include: {
                _count: { select: { orders: true } },
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

        const result = customers.map(c => {
            const totalCredit = c.tableSessions.reduce((s, ts) => s + ts.creditAmount, 0)
            const totalCreditPaid = c.tableSessions
                .filter(ts => ts.creditPaid)
                .reduce((s, ts) => s + ts.creditAmount, 0)
            const outstandingCredit = totalCredit - totalCreditPaid

            return {
                ...c,
                tableSessions: undefined,
                creditUsed: outstandingCredit,
                totalCredit,
            }
        })

        return res.status(200).json(result)
    }

    if (req.method === 'POST') {
        if (!can(user.permissions, user.role, 'customers', 'edit')) {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions to create customers' })
        }
        const { name, phone, email, address, type, creditLimit } = req.body
        if (!name || typeof name !== 'string') {
            return res.status(400).json({ error: 'Customer name is required' })
        }

        const customer = await prisma.customer.create({
            data: {
                name: name.trim(),
                phone: phone ? String(phone).trim() : null,
                email: email ? String(email).trim() : null,
                address: address ? String(address).trim() : null,
                type: type || 'regular',
                creditLimit: Math.max(0, Number(creditLimit) || 0),
            },
        })
        return res.status(201).json(customer)
    }

    return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
