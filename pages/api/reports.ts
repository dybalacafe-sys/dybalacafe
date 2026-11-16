// pages/api/reports.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload, getOutletIdFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

    if (!can(user.permissions, user.role, 'reports', 'view')) {
        return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view reports' })
    }

    const headerVal = req.headers['x-outlet-id'] || req.query.outletId || (req.body && req.body.outletId)
    let outletId: number | null = null

    if (user.role === 'SUPER_ADMIN' && headerVal === 'all') {
        outletId = null
    } else {
        try {
            outletId = await getOutletIdFromRequest(req, user)
        } catch (err: unknown) {
            return res.status(403).json({ error: err instanceof Error ? err.message : 'Forbidden: Outlet access denied' })
        }
    }
    const { type, startDate, endDate } = req.query

    const start = startDate
        ? new Date(startDate as string)
        : new Date(new Date().setHours(0, 0, 0, 0))
    const end = endDate
        ? new Date(endDate as string)
        : new Date(new Date().setHours(23, 59, 59, 999))

    const outletFilter = outletId ? { outletId } : {}

    // ─── SALES REPORT ────────────────────────────────────────────────────────────
    // Combines: POS sales + closed table sessions
    if (type === 'sales') {
        const [sales, tableSessions] = await Promise.all([
            prisma.sale.findMany({
                where: {
                    ...outletFilter,
                    createdAt: { gte: start, lte: end },
                },
                include: {
                    items: { include: { product: { select: { name: true, costPrice: true } } } },
                    user: { select: { name: true } },
                    customer: { select: { name: true } },
                },
                orderBy: { createdAt: 'asc' },
            }),
            prisma.tableSession.findMany({
                where: {
                    status: 'CLOSED',
                    closedAt: { gte: start, lte: end },
                    ...(outletId ? { table: { outletId } } : {}),
                },
                include: {
                    table: { select: { name: true } },
                    openedBy: { select: { name: true } },
                    orders: {
                        include: {
                            items: {
                                include: { product: { select: { name: true, costPrice: true } } },
                            },
                        },
                    },
                },
                orderBy: { closedAt: 'asc' },
            }),
        ])

        const posRevenue = sales.reduce((s, sale) => s + sale.total, 0)
        const posDiscount = sales.reduce((s, sale) => s + sale.discount, 0)
        const posCost = sales.reduce(
            (s, sale) =>
                s +
                sale.items.reduce(
                    (is, item) => is + (item.product ? item.product.costPrice * item.quantity : 0),
                    0
                ),
            0
        )

        const tableRevenue = tableSessions.reduce((s, ts) => s + ts.grandTotal, 0)
        const tableDiscount = tableSessions.reduce((s, ts) => s + ts.discount, 0)
        const tableCost = tableSessions.reduce(
            (s, ts) =>
                s +
                ts.orders.reduce(
                    (os, o) =>
                        os +
                        o.items.reduce(
                            (is, item) =>
                                is + (item.product ? item.product.costPrice * item.quantity : 0),
                            0
                        ),
                    0
                ),
            0
        )

        const totalRevenue = posRevenue + tableRevenue
        const totalDiscount = posDiscount + tableDiscount
        const totalCost = posCost + tableCost
        const totalProfit = totalRevenue - totalCost

        return res.status(200).json({
            sales,
            tableSessions,
            posRevenue,
            posDiscount,
            posCost,
            tableRevenue,
            tableDiscount,
            tableCost,
            totalRevenue,
            totalDiscount,
            totalCost,
            totalProfit,
        })
    }

    // ─── STOCK REPORT ─────────────────────────────────────────────────────────────
    if (type === 'stock') {
        const outletProducts = await prisma.outletProduct.findMany({
            where: {
                active: true,
                ...(outletId ? { outletId } : {}),
            },
            include: {
                product: { include: { category: true } },
                outlet: { select: { id: true, name: true, code: true } },
            },
            orderBy: { product: { name: 'asc' } },
        })

        const products = outletProducts.map((op) => ({
            ...op.product,
            stock: op.stock,
            minStock: op.minStock,
            price: op.price !== null ? op.price : op.product.price,
            outlet: op.outlet,
        }))

        const totalValue = products.reduce((s, p) => s + p.stock * p.costPrice, 0)
        return res.status(200).json({ products, totalValue })
    }

    // ─── ORDERS REPORT ────────────────────────────────────────────────────────────
    if (type === 'orders') {
        const orders = await prisma.order.findMany({
            where: {
                ...outletFilter,
                createdAt: { gte: start, lte: end },
            },
            include: { items: true },
            orderBy: { createdAt: 'desc' },
        })
        const totalAmount = orders.reduce((s, o) => s + o.totalAmount, 0)
        const totalPaid = orders.reduce((s, o) => s + o.advancePaid, 0)
        const totalDue = orders.reduce((s, o) => s + o.balanceDue, 0)
        return res.status(200).json({ orders, totalAmount, totalPaid, totalDue })
    }

    // ─── TABLE SESSIONS REPORT ───────────────────────────────────────────────────
    if (type === 'table-sessions') {
        const tableSessions = await prisma.tableSession.findMany({
            where: {
                status: 'CLOSED',
                closedAt: { gte: start, lte: end },
                ...(outletId ? { table: { outletId } } : {}),
            },
            include: {
                table: { select: { name: true } },
                openedBy: { select: { name: true } },
                closedBy: { select: { name: true } },
                customer: { select: { name: true, phone: true } },
                orders: {
                    include: {
                        items: {
                            include: { product: { select: { name: true, costPrice: true } } },
                        },
                    },
                },
            },
            orderBy: { closedAt: 'desc' },
        })

        const totalRevenue = tableSessions.reduce((s, ts) => s + ts.grandTotal, 0)
        const totalDiscount = tableSessions.reduce((s, ts) => s + ts.discount, 0)
        const totalCost = tableSessions.reduce(
            (s, ts) =>
                s +
                ts.orders.reduce(
                    (os, o) =>
                        os +
                        o.items.reduce(
                            (is, item) =>
                                is + (item.product ? item.product.costPrice * item.quantity : 0),
                            0
                        ),
                    0
                ),
            0
        )

        return res.status(200).json({
            tableSessions,
            totalRevenue,
            totalDiscount,
            totalCost,
            totalProfit: totalRevenue - totalCost,
        })
    }

    // ─── DAILY CHART ─────────────────────────────────────────────────────────────
    if (type === 'daily-chart') {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

        const [sales, tableSessions] = await Promise.all([
            prisma.sale.findMany({
                where: {
                    ...outletFilter,
                    createdAt: { gte: thirtyDaysAgo },
                },
                select: { createdAt: true, total: true },
            }),
            prisma.tableSession.findMany({
                where: {
                    status: 'CLOSED',
                    closedAt: { gte: thirtyDaysAgo },
                    ...(outletId ? { table: { outletId } } : {}),
                },
                select: { closedAt: true, grandTotal: true },
            }),
        ])

        const grouped: Record<string, number> = {}

        // Add POS sales
        sales.forEach((s) => {
            const day = s.createdAt.toISOString().slice(0, 10)
            grouped[day] = (grouped[day] || 0) + s.total
        })

        // Add table session revenue
        tableSessions.forEach((ts) => {
            if (!ts.closedAt) return
            const day = ts.closedAt.toISOString().slice(0, 10)
            grouped[day] = (grouped[day] || 0) + ts.grandTotal
        })

        const chartData = Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, total]) => ({ date, total }))

        return res.status(200).json(chartData)
    }

    // ─── PRODUCT SALES ───────────────────────────────────────────────────────────
    if (type === 'product-sales') {
        const [saleItems, tableOrderItems] = await Promise.all([
            // POS sale items
            prisma.saleItem.findMany({
                where: {
                    sale: {
                        ...outletFilter,
                        createdAt: { gte: start, lte: end },
                    },
                },
                include: { product: { select: { name: true, costPrice: true } } },
            }),
            // Table session order items
            prisma.tableOrderItem.findMany({
                where: {
                    order: {
                        session: {
                            status: 'CLOSED',
                            closedAt: { gte: start, lte: end },
                            ...(outletId ? { table: { outletId } } : {}),
                        },
                    },
                    productId: { not: null },
                },
                include: { product: { select: { name: true, costPrice: true } } },
            }),
        ])

        const grouped: Record<string, { name: string; quantity: number; revenue: number; cost: number }> = {}

        // POS items
        saleItems.forEach((item) => {
            const key = item.product.name
            if (!grouped[key]) grouped[key] = { name: key, quantity: 0, revenue: 0, cost: 0 }
            grouped[key].quantity += item.quantity
            grouped[key].revenue += item.subtotal
            grouped[key].cost += item.product.costPrice * item.quantity
        })

        // Table order items
        tableOrderItems.forEach((item) => {
            if (!item.product) return
            const key = item.product.name
            if (!grouped[key]) grouped[key] = { name: key, quantity: 0, revenue: 0, cost: 0 }
            grouped[key].quantity += item.quantity
            grouped[key].revenue += item.subtotal
            grouped[key].cost += item.product.costPrice * item.quantity
        })

        const sorted = Object.values(grouped).sort((a, b) => b.revenue - a.revenue)
        return res.status(200).json(sorted)
    }

    return res.status(400).json({ error: 'Invalid report type' })
}

export default withAuth(handler)
