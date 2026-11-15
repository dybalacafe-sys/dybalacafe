// pages/api/table-sessions/[id].ts
import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const POINTS_PER_AMOUNT = 10

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
    const id = Number(req.query.id)

    // GET: full session detail with all rounds
    if (req.method === 'GET') {
        const session = await prisma.tableSession.findUnique({
            where: { id },
            include: {
                table: { select: { name: true, capacity: true, outletId: true } },
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
        return res.status(200).json(session)
    }

    // PATCH: checkout — close session, deduct inventory, award points
    if (req.method === 'PATCH') {
        const { action, discount, paymentMethod, note, paidAmount } = req.body

        if (action !== 'checkout') {
            return res.status(400).json({ error: 'Unknown action' })
        }

        const session = await prisma.tableSession.findUnique({
            where: { id },
            include: {
                table: true,
                orders: {
                    include: {
                        items: {
                            include: {
                                product: {
                                    include: {
                                        recipeItems: { include: { ingredient: true } },
                                    },
                                },
                            },
                        },
                    },
                },
                customer: true,
            },
        })

        if (!session) return res.status(404).json({ error: 'Session not found' })
        if (session.status === 'CLOSED') return res.status(409).json({ error: 'Session already closed' })

        const outletId = session.table.outletId

        // Aggregate all items across all rounds
        const allItems: Array<{
            productId: number
            name: string
            quantity: number
            price: number
        }> = []

        const productQtyMap = new Map<number, number>()

        for (const order of session.orders) {
            for (const item of order.items) {
                if (!item.productId) continue
                const existing = productQtyMap.get(item.productId) || 0
                productQtyMap.set(item.productId, existing + item.quantity)
                allItems.push({
                    productId: item.productId,
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price,
                })
            }
        }

        // Validate stock availability for all products in OutletProduct
        const recipeMap = new Map<number, Array<{ ingredientId: number; quantity: number; unit: string }>>()

        for (const [productId, totalQty] of Array.from(productQtyMap.entries())) {
            const product = await prisma.product.findUnique({
                where: { id: productId },
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
            if (!product) return res.status(400).json({ error: `Product ${productId} not found` })

            const prodStock = product.outletProducts[0]?.stock ?? 0
            if (prodStock < totalQty) {
                return res.status(400).json({
                    error: `Insufficient stock for ${product.name} (need ${totalQty}, have ${prodStock})`,
                })
            }
            // Validate raw material stock
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
        const subtotal = session.orders.reduce(
            (sum, order) => sum + order.items.reduce((s, i) => s + i.subtotal, 0),
            0
        )
        const discountAmt = Number(discount) || 0
        const grandTotal = subtotal - discountAmt
        const paid = Math.min(Number(paidAmount) ?? grandTotal, grandTotal)
        const creditAmount = grandTotal - paid
        const pointsEarned = session.customerId ? Math.floor(grandTotal / POINTS_PER_AMOUNT) : 0

        // If putting on credit, validate customer has a credit limit and enough headroom
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

        // Transaction: close session, deduct stock, award points
        const closed = await prisma.$transaction(async (tx) => {
            // Update session
            const updated = await tx.tableSession.update({
                where: { id },
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

            // Deduct finished product stock from OutletProduct
            for (const [productId, totalQty] of Array.from(productQtyMap.entries())) {
                await tx.outletProduct.upsert({
                    where: { outletId_productId: { outletId, productId } },
                    update: { stock: { decrement: totalQty } },
                    create: { outletId, productId, stock: -totalQty, minStock: 5 },
                })
                await tx.stockLog.create({
                    data: {
                        outletId,
                        productId,
                        type: 'OUT',
                        quantity: totalQty,
                        note: `Table Session #${id} (${session.table.name})`,
                    },
                })
                // Deduct raw materials via recipe
                const recipe = recipeMap.get(productId)
                if (recipe) {
                    for (const ri of recipe) {
                        const used = ri.quantity * totalQty
                        await tx.outletProduct.upsert({
                            where: { outletId_productId: { outletId, productId: ri.ingredientId } },
                            update: { stock: { decrement: used } },
                            create: { outletId, productId: ri.ingredientId, stock: -used, minStock: 5 },
                        })
                        await tx.stockLog.create({
                            data: {
                                outletId,
                                productId: ri.ingredientId,
                                type: 'OUT',
                                quantity: used,
                                note: `Table Session #${id} (ingredient)`,
                            },
                        })
                    }
                }
            }

            // Award loyalty points + track credit used
            if (session.customerId) {
                await tx.customer.update({
                    where: { id: session.customerId },
                    data: {
                        points: { increment: pointsEarned },
                        creditUsed: { increment: creditAmount },
                    },
                })
            }

            return updated
        })

        return res.status(200).json(closed)
    }

    return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
