// pages/api/dashboard.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload, getOutletIdFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function handler(req: NextApiRequest, res: NextApiResponse, _user: JWTPayload) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

    const outletId = await getOutletIdFromRequest(req).catch(() => null)

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const outletFilter = outletId ? { outletId } : {}

    const [
        todayPosSales,
        todayTableSessions,
        pendingOrders,
        activeTableSessions,
        totalProducts,
        recentSales,
        recentOrders,
        recentTableSessions,
        lowStock,
    ] = await Promise.all([
        // POS sales today (filtered by outlet)
        prisma.sale.aggregate({
            where: {
                ...outletFilter,
                createdAt: { gte: today, lt: tomorrow },
            },
            _sum: { total: true },
            _count: true,
        }),

        // Closed table sessions today (filtered by table's outlet)
        prisma.tableSession.aggregate({
            where: {
                status: 'CLOSED',
                closedAt: { gte: today, lt: tomorrow },
                ...(outletId ? { table: { outletId } } : {}),
            },
            _sum: { grandTotal: true },
            _count: true,
        }),

        // Pending pre-orders
        prisma.order.count({
            where: {
                ...outletFilter,
                status: 'PENDING',
            },
        }),

        // Currently open table sessions
        prisma.tableSession.count({
            where: {
                status: 'OPEN',
                ...(outletId ? { table: { outletId } } : {}),
            },
        }),

        // Total active products in this outlet
        prisma.outletProduct.count({
            where: {
                ...outletFilter,
                active: true,
            },
        }),

        // Recent POS sales
        prisma.sale.findMany({
            where: outletFilter,
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { name: true } },
                items: { include: { product: { select: { name: true } } } },
            },
        }),

        // Recent pending/in-progress orders
        prisma.order.findMany({
            where: {
                ...outletFilter,
                status: { in: ['PENDING', 'IN_PROGRESS'] },
            },
            take: 5,
            orderBy: { createdAt: 'desc' },
        }),

        // Recent closed table sessions
        prisma.tableSession.findMany({
            where: {
                status: 'CLOSED',
                ...(outletId ? { table: { outletId } } : {}),
            },
            take: 5,
            orderBy: { closedAt: 'desc' },
            include: {
                table: { select: { name: true } },
                openedBy: { select: { name: true } },
                orders: { include: { items: true } },
            },
        }),

        // Low stock products from OutletProduct
        prisma.outletProduct.findMany({
            where: {
                ...outletFilter,
                active: true,
                stock: { lte: 5 },
            },
            take: 10,
            include: {
                product: {
                    select: { id: true, name: true, unit: true },
                },
            },
        }),
    ])

    const posTotal = todayPosSales._sum.total || 0
    const tableTotal = todayTableSessions._sum.grandTotal || 0
    const combinedTotal = posTotal + tableTotal
    const combinedCount = todayPosSales._count + todayTableSessions._count

    const formattedLowStock = lowStock.map((op) => ({
        id: op.productId,
        name: op.product.name,
        stock: op.stock,
        minStock: op.minStock,
        unit: op.product.unit,
    }))

    return res.status(200).json({
        todaySales: {
            total: combinedTotal,
            count: combinedCount,
            pos: { total: posTotal, count: todayPosSales._count },
            table: { total: tableTotal, count: todayTableSessions._count },
        },
        pendingOrders,
        activeTableSessions,
        totalProducts,
        lowStockCount: formattedLowStock.length,
        lowStockProducts: formattedLowStock,
        recentSales,
        recentOrders,
        recentTableSessions,
    })
}

export default withAuth(handler)
