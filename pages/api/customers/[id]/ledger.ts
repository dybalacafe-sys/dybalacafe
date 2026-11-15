// pages/api/customers/[id]/ledger.ts
// Returns a chronological list of all financial events for a customer,
// plus running balance (amount owed) and total spent.

import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export type LedgerEntryType =
    | 'POS_SALE'
    | 'ORDER_PLACED'
    | 'ORDER_PAYMENT'
    | 'TABLE_SESSION'
    | 'TABLE_CREDIT'
    | 'CREDIT_PAYMENT'

export interface LedgerEntry {
    id: string            // unique key for React
    date: string          // ISO string
    type: LedgerEntryType
    description: string
    debit: number         // money they owe / spent
    credit: number        // money they paid back / paid in advance
    balance: number       // running outstanding balance after this entry
    ref: string           // e.g. "Sale #12", "Order #ORD-001", "Table 3"
    meta?: Record<string, unknown>
}

async function handler(req: NextApiRequest, res: NextApiResponse, _user: JWTPayload) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

    const customerId = Number(req.query.id)

    const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: {
            // POS sales — fully paid at point of sale
            sales: {
                orderBy: { createdAt: 'asc' },
                select: {
                    id: true, total: true, discount: true,
                    paymentMethod: true, createdAt: true,
                    items: { include: { product: { select: { name: true } } } },
                },
            },
            // Pre-orders — may have balance due
            orders: {
                orderBy: { createdAt: 'asc' },
                select: {
                    id: true, orderNumber: true, totalAmount: true,
                    advancePaid: true, balanceDue: true,
                    paymentStatus: true, status: true, createdAt: true,
                    items: { select: { name: true, quantity: true } },
                },
            },
            // Table sessions — may have credit
            tableSessions: {
                where: { status: 'CLOSED' },
                orderBy: { closedAt: 'asc' },
                select: {
                    id: true, grandTotal: true, paidAmount: true,
                    creditAmount: true, creditPaid: true,
                    paymentMethod: true, closedAt: true, openedAt: true,
                    table: { select: { name: true } },
                    creditPayments: {
                        orderBy: { createdAt: 'asc' },
                        select: {
                            id: true, amount: true, note: true, createdAt: true,
                            recordedBy: { select: { name: true } },
                        },
                    },
                },
            },
        },
    })

    if (!customer) return res.status(404).json({ error: 'Customer not found' })

    // ── Build raw events list ─────────────────────────────────────────────────

    type RawEvent = {
        date: Date
        type: LedgerEntryType
        description: string
        debit: number
        credit: number
        ref: string
        meta?: Record<string, unknown>
    }

    const events: RawEvent[] = []

    // POS Sales — fully paid, debit + immediate credit = net 0 outstanding
    for (const sale of customer.sales) {
        const itemNames = sale.items.slice(0, 3).map(i => i.product.name).join(', ')
        const more = sale.items.length > 3 ? ` +${sale.items.length - 3} more` : ''
        events.push({
            date: new Date(sale.createdAt),
            type: 'POS_SALE',
            description: `POS Sale — ${itemNames}${more}`,
            debit: sale.total,
            credit: sale.total, // fully paid immediately
            ref: `Sale #${sale.id}`,
            meta: { paymentMethod: sale.paymentMethod, discount: sale.discount },
        })
    }

    // Pre-orders — debit full amount, credit advance paid
    for (const order of customer.orders) {
        const itemNames = order.items.slice(0, 3).map(i => `${i.name} ×${i.quantity}`).join(', ')
        const more = order.items.length > 3 ? ` +${order.items.length - 3} more` : ''

        // Order placed
        events.push({
            date: new Date(order.createdAt),
            type: 'ORDER_PLACED',
            description: `Order placed — ${itemNames}${more}`,
            debit: order.totalAmount,
            credit: order.advancePaid,
            ref: order.orderNumber,
            meta: { status: order.status, paymentStatus: order.paymentStatus },
        })
    }

    // Table sessions — debit grand total, credit paid amount
    for (const ts of customer.tableSessions) {
        const date = ts.closedAt ? new Date(ts.closedAt) : new Date(ts.openedAt)
        events.push({
            date,
            type: ts.creditAmount > 0 ? 'TABLE_CREDIT' : 'TABLE_SESSION',
            description: `${ts.table.name} — table session`,
            debit: ts.grandTotal,
            credit: ts.paidAmount,
            ref: `Session #${ts.id}`,
            meta: {
                paymentMethod: ts.paymentMethod,
                creditAmount: ts.creditAmount,
                creditPaid: ts.creditPaid,
            },
        })

        // Each credit repayment is its own entry
        for (const cp of ts.creditPayments) {
            events.push({
                date: new Date(cp.createdAt),
                type: 'CREDIT_PAYMENT',
                description: `Credit repayment — ${ts.table.name}${cp.note ? ` (${cp.note})` : ''}`,
                debit: 0,
                credit: cp.amount,
                ref: `Session #${ts.id}`,
                meta: { recordedBy: cp.recordedBy.name },
            })
        }
    }

    // ── Sort chronologically ──────────────────────────────────────────────────

    events.sort((a, b) => a.date.getTime() - b.date.getTime())

    // ── Compute running outstanding balance ───────────────────────────────────
    // balance = sum of debits - sum of credits so far
    // POS sales net to 0 (debit == credit) so they don't affect outstanding

    let runningBalance = 0
    let totalSpent = 0
    let totalOutstanding = 0

    const entries: LedgerEntry[] = events.map((e, i) => {
        runningBalance += e.debit - e.credit
        totalSpent += e.debit
        return {
            id: `${e.type}-${i}-${e.date.getTime()}`,
            date: e.date.toISOString(),
            type: e.type,
            description: e.description,
            debit: e.debit,
            credit: e.credit,
            balance: runningBalance,
            ref: e.ref,
            meta: e.meta,
        }
    })

    totalOutstanding = runningBalance

    return res.status(200).json({
        entries,
        summary: {
            totalSpent,
            totalOutstanding,
            totalCredit: customer.sales.reduce((s, x) => s + x.total, 0),
            creditLimit: customer.creditLimit,
            creditUsed: customer.creditUsed,
            points: customer.points,
        },
    })
}

export default withAuth(handler)