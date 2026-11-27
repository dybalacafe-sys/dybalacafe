// pages/api/table-sessions/[id].ts
import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'

const POINTS_PER_AMOUNT = 10

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
    const id = Number(req.query.id)
    if (!id || isNaN(id)) return res.status(400).json({ error: 'Invalid session ID' })

    const session = await prisma.tableSession.findUnique({
        where: { id },
        include: {
            table: true,
            openedBy: { select: { name: true } },
            closedBy: { select: { name: true } },
            customer: { select: { id: true, name: true, phone: true, points: true } },
            orders: {
                orderBy: { roundNumber: 'asc' },
                include: {
                    items: {
                        include: { product: { select: { name: true, unit: true } } },
                    },
                },
            },
        },
    })
    if (!session) return res.status(404).json({ error: 'Session not found' })

    // Validate outlet assignment for non-superadmin
    if (user.role !== 'SUPER_ADMIN') {
        const hasAccess = await prisma.userOutlet.findUnique({
            where: { userId_outletId: { userId: user.userId, outletId: session.table.outletId } },
        })
        if (!hasAccess) {
            return res.status(403).json({ error: 'Forbidden: You do not have access to this outlet' })
        }
    }

    // GET: full session detail with all rounds
    if (req.method === 'GET') {
        if (!can(user.permissions, user.role, 'tables', 'view')) {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view table sessions' })
        }
        return res.status(200).json(session)
    }

    // PATCH: checkout — close session, deduct inventory, award points
    if (req.method === 'PATCH') {
        if (!can(user.permissions, user.role, 'tables', 'edit')) {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions to close table sessions' })
        }
        const { action, discount, paymentMethod, note, paidAmount } = req.body

        if (action !== 'checkout') {
            return res.status(400).json({ error: 'Unknown action' })
        }
        if (session.status === 'CLOSED') {
            return res.status(409).json({ error: 'Session already closed' })
        }

        const outletId = session.table.outletId

        // Aggregate all items across all rounds
        const productQtyMap = new Map<number, number>()
        for (const order of session.orders) {
            for (const item of order.items) {
                if (!item.productId) continue
                const existing = productQtyMap.get(item.productId) || 0
                productQtyMap.set(item.productId, existing + item.quantity)
            }
        }

        // 1. Batch fetch all products in cart (Eliminate N+1 queries)
        const productIds = Array.from(productQtyMap.keys())
        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
            include: {
                outletProducts: { where: { outletId } },
                recipeItems: {
                    include: {
                        ingredient: {
                            include: { outletProducts: { where: { outletId } } },
                        },
                    },
                },
            },
        })
        const productMap = new Map(products.map((p) => [p.id, p]))

        // Validate stock availability
        const recipeMap = new Map<number, Array<{ ingredientId: number; quantity: number; unit: string }>>()
        for (const [productId, totalQty] of Array.from(productQtyMap.entries())) {
            const product = productMap.get(productId)
            if (!product) return res.status(400).json({ error: `Product #${productId} not found` })

            const prodStock = product.outletProducts[0]?.stock ?? 0
            if (prodStock < totalQty) {
                return res.status(400).json({
                    error: `Insufficient stock for ${product.name} (need ${totalQty}, have ${prodStock})`,
                })
            }
            for (const ri of product.recipeItems) {
                const needed = ri.quantity * totalQty
                const ingStock = ri.ingredient.outletProducts[0]?.stock ?? 0
                if (ingStock < needed) {
                    return res.status(400).json({
                        error: `Not enough ${ri.ingredient.name} (need ${needed} ${ri.unit}, have ${ingStock})`,
                    })
                }
            }
            if (product.recipeItems.length > 0) {
                recipeMap.set(productId, product.recipeItems.map(ri => ({
                    ingredientId: ri.ingredientId,
                    quantity: ri.quantity,
                    unit: ri.unit,
                })))
            }
        }

        // Calculate totals
        const subtotal = session.orders.reduce((sum, order) => {
            return sum + order.items.reduce((iSum, item) => iSum + item.subtotal, 0)
        }, 0)

        const discountAmt = Math.max(0, Math.min(Number(discount) || 0, subtotal))
        const grandTotal = Math.max(0, subtotal - discountAmt)
        const pointsEarned = Math.floor(grandTotal / POINTS_PER_AMOUNT)

        const paid = Math.max(0, Number(paidAmount) || 0)
        const creditAmount = Math.max(0, grandTotal - paid)

        if (creditAmount > 0) {
            if (!session.customerId) {
                return res.status(400).json({ error: 'Credit requires a linked customer' })
            }
            const customer = await prisma.customer.findUnique({ where: { id: session.customerId } })
            if (!customer) return res.status(404).json({ error: 'Customer not found' })
            const availableCredit = customer.creditLimit - customer.creditUsed
            if (creditAmount > availableCredit) {
                return res.status(400).json({
                    error: `Insufficient credit limit. Available: NPR ${availableCredit.toLocaleString()}, Requested: NPR ${creditAmount.toLocaleString()}`,
                })
            }
        }

        try {
            // Transaction: close session conditionally on status 'OPEN', deduct stock atomically, award points
            const closed = await prisma.$transaction(async (tx) => {
                const closeResult = await tx.tableSession.updateMany({
                    where: { id, status: 'OPEN' },
                    data: {
                        status: 'CLOSED',
                        closedById: user.userId,
                        closedAt: new Date(),
                        totalAmount: subtotal,
                        discount: discountAmt,
                        grandTotal,
                        paidAmount: paid,
                        creditAmount,
                        creditPaid: creditAmount === 0,
                        paymentMethod: paymentMethod || 'cash',
                        note: note || session.note,
                    },
                })

                if (closeResult.count === 0) {
                    throw new Error('Session already closed or being processed by another cashier')
                }

                // Atomic conditional stock updates (aggregated per productId)
                const stockDecrements = new Map<number, { qty: number; label: string }>()
                const stockLogs: { outletId: number; productId: number; type: string; quantity: number; note: string }[] = []

                const addDecrement = (productId: number, qty: number, label: string) => {
                    const existing = stockDecrements.get(productId)
                    if (existing) {
                        existing.qty += qty
                    } else {
                        stockDecrements.set(productId, { qty, label })
                    }
                }

                for (const [productId, totalQty] of Array.from(productQtyMap.entries())) {
                    const product = productMap.get(productId)
                    addDecrement(productId, totalQty, product?.name || String(productId))
                    stockLogs.push({
                        outletId,
                        productId,
                        type: 'OUT',
                        quantity: totalQty,
                        note: `Table Session #${id} (${session.table.name})`,
                    })

                    const recipe = recipeMap.get(productId)
                    if (recipe) {
                        for (const ri of recipe) {
                            const used = ri.quantity * totalQty
                            addDecrement(ri.ingredientId, used, `recipe ingredient #${ri.ingredientId}`)
                            stockLogs.push({
                                outletId,
                                productId: ri.ingredientId,
                                type: 'OUT',
                                quantity: used,
                                note: `Table Session #${id} (ingredient)`,
                            })
                        }
                    }
                }

                await Promise.all(
                    Array.from(stockDecrements.entries()).map(async ([productId, { qty, label }]) => {
                        const updatedStock = await tx.outletProduct.updateMany({
                            where: { outletId, productId, stock: { gte: qty } },
                            data: { stock: { decrement: qty } },
                        })
                        if (updatedStock.count === 0) {
                            throw new Error(`Insufficient stock for ${label} in concurrent checkout`)
                        }
                    })
                )

                if (stockLogs.length > 0) {
                    await tx.stockLog.createMany({ data: stockLogs })
                }

                if (session.customerId) {
                    await tx.customer.update({
                        where: { id: session.customerId },
                        data: {
                            points: { increment: pointsEarned },
                            creditUsed: { increment: creditAmount },
                        },
                    })
                }

                return await tx.tableSession.findUnique({
                    where: { id },
                    include: {
                        table: { select: { name: true } },
                        openedBy: { select: { name: true } },
                        closedBy: { select: { name: true } },
                        customer: { select: { name: true, phone: true, points: true } },
                        orders: {
                            orderBy: { roundNumber: 'asc' },
                            include: {
                                items: {
                                    include: { product: { select: { name: true, unit: true } } },
                                },
                            },
                        },
                    },
                })
            })

            return res.status(200).json(closed)
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Checkout failed'
            if (msg.includes('already closed')) {
                return res.status(409).json({ error: msg })
            }
            return res.status(400).json({ error: msg })
        }
    }

    return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
