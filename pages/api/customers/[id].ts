// pages/api/customers/[id].ts
import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
    const id = Number(req.query.id)
    if (!id || isNaN(id)) return res.status(400).json({ error: 'Invalid customer ID' })

    // ── GET: full customer detail ────────────────────────────────────────────────
    if (req.method === 'GET') {
        if (!can(user.permissions, user.role, 'customers', 'view')) {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view customer details' })
        }
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
        if (!can(user.permissions, user.role, 'customers', 'edit')) {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions to edit customers' })
        }

        const existing = await prisma.customer.findUnique({ where: { id } })
        if (!existing) return res.status(404).json({ error: 'Customer not found' })

        const { name, phone, email, address, type, creditLimit } = req.body
        const updated = await prisma.customer.update({
            where: { id },
            data: {
                ...(name !== undefined && { name: String(name).trim() }),
                ...(phone !== undefined && { phone: phone ? String(phone).trim() : null }),
                ...(email !== undefined && { email: email ? String(email).trim() : null }),
                ...(address !== undefined && { address: address ? String(address).trim() : null }),
                ...(type !== undefined && { type }),
                ...(creditLimit !== undefined && { creditLimit: Math.max(0, Number(creditLimit)) }),
            },
        })
        return res.status(200).json(updated)
    }

    return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
