// pages/api/customers/[id].ts
import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
    const id = Number(req.query.id)

    // ── GET: full customer detail ────────────────────────────────────────────────
    if (req.method === 'GET') {
        const customer = await prisma.customer.findUnique({
            where: { id },
            include: {
                sales: {
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                    include: {
                        items: { include: { product: { select: { name: true, unit: true } } } },
                    },
                },
                orders: {
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                    include: { items: true },
                },
                // All table sessions for this customer
                tableSessions: {
                    orderBy: { openedAt: 'desc' },
                    take: 30,
                    include: {
                        table: { select: { name: true } },
                        openedBy: { select: { name: true } },
                        orders: {
                            include: { items: true },
                        },
                        creditPayments: {
                            orderBy: { createdAt: 'asc' },
                            include: { recordedBy: { select: { name: true } } },
                        },
                    },
                },
            },
        })

        if (!customer) return res.status(404).json({ error: 'Customer not found' })
        return res.status(200).json(customer)
    }

    // ── PUT: update customer (creditLimit, type, etc.) ───────────────────────────
    if (req.method === 'PUT') {
        const { name, phone, email, address, type, creditLimit } = req.body
        const updated = await prisma.customer.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(phone !== undefined && { phone }),
                ...(email !== undefined && { email }),
                ...(address !== undefined && { address }),
                ...(type !== undefined && { type }),
                ...(creditLimit !== undefined && { creditLimit: Number(creditLimit) }),
            },
        })
        return res.status(200).json(updated)
    }

    return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)