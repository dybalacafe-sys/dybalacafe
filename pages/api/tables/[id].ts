// pages/api/tables/[id].ts
import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
    const id = Number(req.query.id)

    if (req.method === 'PUT') {
        if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Admin only' })
        }
        const { name, capacity, active } = req.body
        const table = await prisma.table.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(capacity !== undefined && { capacity: Number(capacity) }),
                ...(active !== undefined && { active }),
            },
        })
        return res.status(200).json(table)
    }

    if (req.method === 'DELETE') {
        if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Admin only' })
        }
        // Soft delete
        await prisma.table.update({ where: { id }, data: { active: false } })
        return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)