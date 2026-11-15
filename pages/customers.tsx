// pages/customers.tsx
import { useEffect, useState, useCallback } from 'react'
import Layout from '@/components/Layout'
import { useAuth, apiFetch } from '@/lib/AuthContext'
import toast from 'react-hot-toast'
import {
    FiPlus, FiSearch, FiStar, FiX, FiShoppingCart,
    FiPackage, FiCreditCard, FiAlertCircle, FiCheckCircle,
    FiClock, FiEdit2, FiBookOpen, FiPrinter, FiArrowUp, FiArrowDown,
    FiTrash2,
} from 'react-icons/fi'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Customer {
    id: number; name: string; phone?: string; email?: string; address?: string
    type: string; points: number; creditLimit: number; creditUsed: number
    createdAt: string; _count: { orders: number }
}

interface SaleItem {
    id: number; quantity: number; price: number; subtotal: number
    product: { name: string; unit: string }
}
interface Sale {
    id: number; total: number; discount: number; paymentMethod: string
    pointsEarned: number; createdAt: string; items: SaleItem[]
}

interface OrderItem { id: number; name: string; quantity: number; price: number; subtotal: number }
interface Order {
    id: number; orderNumber: string; status: string; paymentStatus: string
    totalAmount: number; advancePaid: number; balanceDue: number
    deliveryDate?: string; createdAt: string; items: OrderItem[]
    user?: { name: string }
}

interface NewOrderItem {
    productId?: number
    name: string
    quantity: number
    price: number
}

interface Product { id: number; name: string; price: number }

interface CreditPayment {
    id: number; amount: number; note: string | null; createdAt: string
    recordedBy: { name: string }
}
interface TableSessionItem { id: number; name: string; quantity: number; subtotal: number }
interface TableOrderRound { id: number; roundNumber: number; items: TableSessionItem[] }
interface TableSession {
    id: number; openedAt: string; closedAt: string | null
    grandTotal: number; paidAmount: number; creditAmount: number; creditPaid: boolean
    paymentMethod: string; discount: number
    table: { name: string }
    openedBy: { name: string }
    orders: TableOrderRound[]
    creditPayments: CreditPayment[]
}

interface CustomerDetail extends Customer {
    sales: Sale[]
    orders: Order[]
    tableSessions: TableSession[]
}

type LedgerEntryType =
    | 'POS_SALE' | 'ORDER_PLACED' | 'ORDER_PAYMENT'
    | 'TABLE_SESSION' | 'TABLE_CREDIT' | 'CREDIT_PAYMENT'

interface LedgerEntry {
    id: string
    date: string
    type: LedgerEntryType
    description: string
    debit: number
    credit: number
    balance: number
    ref: string
    meta?: Record<string, unknown>
}

interface LedgerData {
    entries: LedgerEntry[]
    summary: {
        totalSpent: number
        totalOutstanding: number
        creditLimit: number
        creditUsed: number
        points: number
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString()
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-NP', { year: 'numeric', month: 'short', day: 'numeric' })
const fmtDateTime = (d: string) => new Date(d).toLocaleString('en-NP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

const statusColor: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    IN_PROGRESS: 'bg-blue-100 text-blue-800',
    COMPLETED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
}
const payColor: Record<string, string> = {
    UNPAID: 'bg-red-100 text-red-700',
    PARTIAL: 'bg-orange-100 text-orange-700',
    PAID: 'bg-green-100 text-green-700',
}

// ─── Ledger helpers ───────────────────────────────────────────────────────────

function ledgerTypeConfig(type: LedgerEntryType) {
    switch (type) {
        case 'POS_SALE':       return { icon: <FiShoppingCart size={11} />, color: 'text-blue-500',  label: 'POS Sale' }
        case 'ORDER_PLACED':   return { icon: <FiPackage size={11} />,      color: 'text-indigo-500', label: 'Order' }
        case 'ORDER_PAYMENT':  return { icon: <FiArrowDown size={11} />,    color: 'text-green-500',  label: 'Order Payment' }
        case 'TABLE_SESSION':  return { icon: <FiClock size={11} />,        color: 'text-gray-500',   label: 'Table' }
        case 'TABLE_CREDIT':   return { icon: <FiCreditCard size={11} />,   color: 'text-red-500',    label: 'Table Credit' }
        case 'CREDIT_PAYMENT': return { icon: <FiArrowUp size={11} />,      color: 'text-green-600',  label: 'Credit Payment' }
        default:               return { icon: null,                          color: 'text-gray-400',   label: type }
    }
}

function printLedger(customer: { name: string; phone?: string; creditLimit: number }, ledger: LedgerData) {
    const rows = ledger.entries.map(e => `
    <tr>
      <td>${new Date(e.date).toLocaleDateString()}</td>
      <td>${e.description}<br/><small style="color:#888">${e.ref}</small></td>
      <td style="text-align:right">${e.debit > 0 ? e.debit.toLocaleString() : ''}</td>
      <td style="text-align:right;color:#16a34a">${e.credit > 0 ? e.credit.toLocaleString() : ''}</td>
      <td style="text-align:right;font-weight:bold;color:${e.balance > 0 ? '#dc2626' : e.balance < 0 ? '#16a34a' : '#374151'}">
        ${e.balance !== 0 ? Math.abs(e.balance).toLocaleString() + (e.balance > 0 ? ' Dr' : ' Cr') : '—'}
      </td>
    </tr>
  `).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; padding: 16px; }
    h2 { font-size: 16px; margin-bottom: 2px; }
    .meta { color: #666; font-size: 11px; margin-bottom: 12px; }
    .summary { display: flex; gap: 24px; margin-bottom: 14px; padding: 8px 12px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; }
    .summary div { display: flex; flex-direction: column; gap: 2px; }
    .summary .label { font-size: 10px; color: #6b7280; }
    .summary .value { font-size: 13px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f3f4f6; border-bottom: 2px solid #d1d5db; padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
    th:nth-child(3), th:nth-child(4), th:nth-child(5) { text-align: right; }
    td { padding: 5px 8px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
    tfoot td { border-top: 2px solid #374151; font-weight: bold; background: #f9fafb; }
    @page { margin: 12mm; }
  </style>
  </head><body>
  <h2>Customer Ledger — ${customer.name}</h2>
  <div class="meta">${customer.phone ?? ''} · Printed: ${new Date().toLocaleString()}</div>
  <div class="summary">
    <div><span class="label">Total Spent</span><span class="value">NPR ${ledger.summary.totalSpent.toLocaleString()}</span></div>
    <div><span class="label">Outstanding</span><span class="value" style="color:${ledger.summary.totalOutstanding > 0 ? '#dc2626' : '#16a34a'}">NPR ${ledger.summary.totalOutstanding.toLocaleString()}</span></div>
    <div><span class="label">Credit Limit</span><span class="value">NPR ${customer.creditLimit.toLocaleString()}</span></div>
    <div><span class="label">Points</span><span class="value">${ledger.summary.points}</span></div>
  </div>
  <table>
    <thead><tr><th>Date</th><th>Description</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="2">Totals</td>
        <td style="text-align:right">${ledger.entries.reduce((s, e) => s + e.debit, 0).toLocaleString()}</td>
        <td style="text-align:right;color:#16a34a">${ledger.entries.reduce((s, e) => s + e.credit, 0).toLocaleString()}</td>
        <td style="text-align:right;color:${ledger.summary.totalOutstanding > 0 ? '#dc2626' : '#16a34a'}">
          ${ledger.summary.totalOutstanding.toLocaleString()}${ledger.summary.totalOutstanding > 0 ? ' Dr' : ''}
        </td>
      </tr>
    </tfoot>
  </table>
  </body></html>`

    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;'
    document.body.appendChild(iframe)
    const doc = iframe.contentWindow?.document
    if (!doc) return
    doc.open(); doc.write(html); doc.close()
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(() => document.body.removeChild(iframe), 2000)
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CustomersPage() {
    const { token, can } = useAuth()
    const [customers, setCustomers] = useState<Customer[]>([])
    const [search, setSearch]       = useState('')
    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState({
        name: '', phone: '', email: '', address: '', type: 'regular', creditLimit: '0',
    })
    const [detail, setDetail]           = useState<CustomerDetail | null>(null)
    const [detailTab, setDetailTab]     = useState<'sales' | 'orders' | 'tables' | 'ledger'>('sales')
    const [loadingDetail, setLoadingDetail] = useState(false)

    // Ledger state
    const [ledger, setLedger]           = useState<LedgerData | null>(null)
    const [ledgerLoading, setLedgerLoading] = useState(false)

    // Credit payment state
    const [creditSession, setCreditSession] = useState<TableSession | null>(null)
    const [creditAmount, setCreditAmount]   = useState('')
    const [creditNote, setCreditNote]       = useState('')
    const [creditLoading, setCreditLoading] = useState(false)

    // Edit credit limit
    const [editingCreditLimit, setEditingCreditLimit] = useState(false)
    const [newCreditLimit, setNewCreditLimit]         = useState('')
    const [savingCreditLimit, setSavingCreditLimit]   = useState(false)

    // Products for order creation
    const [products, setProducts] = useState<Product[]>([])

    // New order modal state
    const [showNewOrder, setShowNewOrder]   = useState(false)
    const [orderForm, setOrderForm]         = useState({ deliveryDate: '', note: '', advancePaid: '0' })
    const [orderItems, setOrderItems]       = useState<NewOrderItem[]>([{ name: '', quantity: 1, price: 0 }])
    const [orderLoading, setOrderLoading]   = useState(false)

    // Update order modal state
    const [editingOrder, setEditingOrder]   = useState<Order | null>(null)
    const [orderUpdate, setOrderUpdate]     = useState({ status: '', advancePaid: '' })
    const [orderUpdateLoading, setOrderUpdateLoading] = useState(false)

    const fetchCustomers = useCallback(async () => {
        if (!token) return
        const params = search ? `?search=${encodeURIComponent(search)}` : ''
        const data = await apiFetch(`/api/customers${params}`, {}, token)
        setCustomers(data as Customer[])
    }, [token, search])

    useEffect(() => { fetchCustomers() }, [fetchCustomers])

    const fetchLedger = useCallback(async (customerId: number) => {
        if (!token) return
        setLedgerLoading(true)
        try {
            const data = await apiFetch(`/api/customers/${customerId}/ledger`, {}, token)
            setLedger(data as LedgerData)
        } catch { toast.error('Failed to load ledger') }
        finally { setLedgerLoading(false) }
    }, [token])

    const fetchProducts = useCallback(async () => {
        if (!token || products.length > 0) return
        const data = await apiFetch('/api/products?type=finished', {}, token)
        setProducts(data as Product[])
    }, [token, products.length])

    // ── Order helpers ────────────────────────────────────────────────────────────

    const openNewOrder = () => {
        fetchProducts()
        setOrderForm({ deliveryDate: '', note: '', advancePaid: '0' })
        setOrderItems([{ name: '', quantity: 1, price: 0 }])
        setShowNewOrder(true)
    }

    const addOrderItem = () =>
        setOrderItems(prev => [...prev, { name: '', quantity: 1, price: 0 }])

    const removeOrderItem = (i: number) =>
        setOrderItems(prev => prev.filter((_, idx) => idx !== i))

    const updateOrderItem = (i: number, field: keyof NewOrderItem, value: string | number) => {
        setOrderItems(prev => {
            const updated = [...prev]
            updated[i] = { ...updated[i], [field]: value }
            if (field === 'productId') {
                const p = products.find(p => p.id === Number(value))
                if (p) { updated[i].name = p.name; updated[i].price = p.price }
            }
            return updated
        })
    }

    const orderTotal   = orderItems.reduce((s, i) => s + i.price * i.quantity, 0)
    const orderAdvance = Number(orderForm.advancePaid) || 0
    const orderBalance = orderTotal - orderAdvance

    const handleCreateOrder = async () => {
        if (!detail) return
        if (orderItems.some(i => !i.name || i.quantity <= 0)) {
            toast.error('Fill in all item details'); return
        }
        setOrderLoading(true)
        try {
            await apiFetch('/api/orders', {
                method: 'POST',
                body: JSON.stringify({
                    customerName: detail.name,
                    customerPhone: detail.phone || undefined,
                    customerId: detail.id,
                    items: orderItems,
                    deliveryDate: orderForm.deliveryDate || undefined,
                    note: orderForm.note || undefined,
                    advancePaid: orderAdvance,
                }),
            }, token)
            toast.success('Order created!')
            setShowNewOrder(false)
            // Refresh detail to show new order
            const updated = await apiFetch(`/api/customers/${detail.id}`, {}, token)
            setDetail(updated as CustomerDetail)
            fetchCustomers()
            if (ledger) fetchLedger(detail.id)
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed')
        } finally {
            setOrderLoading(false)
        }
    }

    const openEditOrder = (order: Order) => {
        setEditingOrder(order)
        setOrderUpdate({ status: order.status, advancePaid: order.advancePaid.toString() })
    }

    const handleUpdateOrder = async () => {
        if (!detail || !editingOrder) return
        setOrderUpdateLoading(true)
        try {
            await apiFetch(`/api/orders/${editingOrder.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    status: orderUpdate.status,
                    advancePaid: Number(orderUpdate.advancePaid),
                }),
            }, token)
            toast.success('Order updated')
            setEditingOrder(null)
            const updated = await apiFetch(`/api/customers/${detail.id}`, {}, token)
            setDetail(updated as CustomerDetail)
            fetchCustomers()
            if (ledger) fetchLedger(detail.id)
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed')
        } finally {
            setOrderUpdateLoading(false)
        }
    }

    const openDetail = async (c: Customer) => {
        setLoadingDetail(true)
        setDetail(null)
        setLedger(null)
        setDetailTab('sales')
        try {
            const data = await apiFetch(`/api/customers/${c.id}`, {}, token)
            setDetail(data as CustomerDetail)
        } catch { toast.error('Failed to load customer details') }
        finally { setLoadingDetail(false) }
    }

    const handleSave = async () => {
        if (!form.name) { toast.error('Name is required'); return }
        try {
            await apiFetch('/api/customers', {
                method: 'POST',
                body: JSON.stringify({ ...form, creditLimit: Number(form.creditLimit) || 0 }),
            }, token)
            toast.success('Customer added')
            setShowModal(false)
            setForm({ name: '', phone: '', email: '', address: '', type: 'regular', creditLimit: '0' })
            fetchCustomers()
        } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed') }
    }

    // Record a credit payment against a table session
    const handleCreditPayment = async () => {
        if (!detail || !creditSession || !creditAmount) return
        setCreditLoading(true)
        try {
            await apiFetch(`/api/customers/${detail.id}/credit`, {
                method: 'POST',
                body: JSON.stringify({
                    sessionId: creditSession.id,
                    amount: Number(creditAmount),
                    note: creditNote || undefined,
                }),
            }, token)
            toast.success(`NPR ${fmt(Number(creditAmount))} credit payment recorded`)
            setCreditSession(null)
            setCreditAmount('')
            setCreditNote('')
            // Refresh detail
            const updated = await apiFetch(`/api/customers/${detail.id}`, {}, token)
            setDetail(updated as CustomerDetail)
            fetchCustomers()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed')
        } finally {
            setCreditLoading(false)
        }
    }

    // Save updated credit limit
    const handleSaveCreditLimit = async () => {
        if (!detail) return
        setSavingCreditLimit(true)
        try {
            await apiFetch(`/api/customers/${detail.id}`, {
                method: 'PUT',
                body: JSON.stringify({ creditLimit: Number(newCreditLimit) }),
            }, token)
            toast.success('Credit limit updated')
            setEditingCreditLimit(false)
            const updated = await apiFetch(`/api/customers/${detail.id}`, {}, token)
            setDetail(updated as CustomerDetail)
            fetchCustomers()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed')
        } finally {
            setSavingCreditLimit(false)
        }
    }

    // Derived credit stats from detail
    const creditStats = detail ? (() => {
        const sessions = detail.tableSessions ?? []
        const totalCredit = sessions.reduce((s, ts) => s + ts.creditAmount, 0)
        const totalPaid   = sessions.reduce((s, ts) =>
            s + ts.creditPayments.reduce((a, p) => a + p.amount, 0), 0)
        const outstanding = totalCredit - totalPaid
        const unpaidSessions = sessions.filter(ts => ts.creditAmount > 0 && !ts.creditPaid)
        return { totalCredit, totalPaid, outstanding, unpaidSessions }
    })() : null

    return (
        <Layout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
                    {can('customers', 'edit') && (
                        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
                            <FiPlus size={15} /> Add Customer
                        </button>
                    )}
                </div>

                <div className="card">
                    <div className="relative mb-4">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            placeholder="Search customers..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="input pl-10"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {customers.map(c => (
                            <div
                                key={c.id}
                                onClick={() => openDetail(c)}
                                className="border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
                                        {c.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {c.creditUsed > 0 && (
                                            <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                        <FiCreditCard size={10} /> NPR {fmt(c.creditUsed)} due
                      </span>
                                        )}
                                        <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${
                                            c.type === 'vip' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700'
                                        }`}>
                      {c.type}
                    </span>
                                    </div>
                                </div>
                                <p className="font-semibold text-gray-900">{c.name}</p>
                                {c.phone && <p className="text-sm text-gray-500">{c.phone}</p>}
                                {c.email && <p className="text-sm text-gray-400 truncate">{c.email}</p>}
                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                                    <p className="text-xs text-blue-600">{c._count.orders} order(s)</p>
                                    <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                    <FiStar className="fill-amber-400 text-amber-400" size={11} />
                                        {c.points ?? 0} pts
                  </span>
                                </div>
                                {c.creditLimit > 0 && (
                                    <div className="mt-1.5 flex items-center justify-between text-xs">
                                        <span className="text-gray-400">Credit limit: NPR {fmt(c.creditLimit)}</span>
                                        <span className={c.creditUsed > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                      {c.creditUsed > 0 ? `NPR ${fmt(c.creditUsed)} used` : 'Clear'}
                    </span>
                                    </div>
                                )}
                            </div>
                        ))}
                        {customers.length === 0 && (
                            <p className="col-span-3 text-center py-8 text-gray-400">No customers found</p>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Add Customer Modal ── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4">
                        <h2 className="text-lg font-bold">Add Customer</h2>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <label className="label">Name *</label>
                                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
                            </div>
                            <div>
                                <label className="label">Phone</label>
                                <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="98XXXXXXXX" />
                            </div>
                            <div>
                                <label className="label">Type</label>
                                <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                                    <option value="regular">Regular</option>
                                    <option value="vip">VIP</option>
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="label">Email</label>
                                <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                            </div>
                            <div className="col-span-2">
                                <label className="label">Address</label>
                                <input className="input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                            </div>
                            <div className="col-span-2">
                                <label className="label">Credit Limit (NPR)</label>
                                <input
                                    type="number" min="0" className="input"
                                    value={form.creditLimit}
                                    onChange={e => setForm(f => ({ ...f, creditLimit: e.target.value }))}
                                    placeholder="0 = no credit"
                                />
                                <p className="text-xs text-gray-400 mt-1">Set to 0 to disable credit for this customer</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={handleSave} className="btn-primary flex-1">Save</button>
                            <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Customer Detail Modal ── */}
            {(loadingDetail || detail) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                        {loadingDetail ? (
                            <div className="flex items-center justify-center p-16 text-gray-400">Loading...</div>
                        ) : detail && (
                            <>
                                {/* Header */}
                                <div className="flex items-start justify-between p-5 border-b border-gray-200">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0">
                                            {detail.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="font-bold text-gray-900 text-lg">{detail.name}</p>
                                                <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${
                                                    detail.type === 'vip' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700'
                                                }`}>{detail.type}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5 flex-wrap">
                                                {detail.phone && <span>{detail.phone}</span>}
                                                {detail.email && <span>{detail.email}</span>}
                                                <span className="flex items-center gap-1 text-amber-600 font-medium">
                          <FiStar className="fill-amber-400 text-amber-400" size={12} />
                                                    {detail.points} pts
                        </span>
                                            </div>
                                            {/* Credit summary in header */}
                                            {detail.creditLimit > 0 && creditStats && (
                                                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <span className="text-xs text-gray-500">
                            Limit: <strong>NPR {fmt(detail.creditLimit)}</strong>
                          </span>
                                                    {creditStats.outstanding > 0 ? (
                                                        <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                              <FiAlertCircle size={11} /> NPR {fmt(creditStats.outstanding)} outstanding
                            </span>
                                                    ) : (
                                                        <span className="text-xs text-green-600 flex items-center gap-1">
                              <FiCheckCircle size={11} /> No outstanding credit
                            </span>
                                                    )}
                                                    {can('customers', 'edit') && (
                                                        <button
                                                            onClick={() => { setNewCreditLimit(String(detail.creditLimit)); setEditingCreditLimit(true) }}
                                                            className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
                                                        >
                                                            <FiEdit2 size={10} /> Edit limit
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            {detail.creditLimit === 0 && can('customers', 'edit') && (
                                                <button
                                                    onClick={() => { setNewCreditLimit('0'); setEditingCreditLimit(true) }}
                                                    className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 mt-1"
                                                >
                                                    <FiCreditCard size={10} /> Enable credit
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600 shrink-0">
                                        <FiX size={22} />
                                    </button>
                                </div>

                                {/* Edit credit limit inline */}
                                {editingCreditLimit && (
                                    <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-3">
                                        <label className="text-sm font-medium text-blue-800 shrink-0">Credit Limit (NPR)</label>
                                        <input
                                            type="number" min="0"
                                            className="input text-sm flex-1 max-w-xs"
                                            value={newCreditLimit}
                                            onChange={e => setNewCreditLimit(e.target.value)}
                                        />
                                        <button
                                            onClick={handleSaveCreditLimit}
                                            disabled={savingCreditLimit}
                                            className="btn-primary text-sm py-1.5 px-4 disabled:opacity-50"
                                        >
                                            {savingCreditLimit ? 'Saving...' : 'Save'}
                                        </button>
                                        <button onClick={() => setEditingCreditLimit(false)} className="text-sm text-gray-500 hover:text-gray-700">
                                            Cancel
                                        </button>
                                    </div>
                                )}

                                {/* Tabs */}
                                <div className="flex border-b border-gray-200 px-5 overflow-x-auto">
                                    {[
                                        { key: 'sales',  label: 'POS Sales',       icon: <FiShoppingCart size={13} />, count: detail.sales.length },
                                        { key: 'orders', label: 'Orders',          icon: <FiPackage size={13} />,      count: detail.orders.length },
                                        { key: 'tables', label: 'Tables / Credit', icon: <FiCreditCard size={13} />,   count: detail.tableSessions?.length ?? 0,
                                            badge: creditStats && creditStats.outstanding > 0 ? creditStats.unpaidSessions.length : 0 },
                                        { key: 'ledger', label: 'Ledger',          icon: <FiBookOpen size={13} />,     count: null },
                                    ].map(tab => (
                                        <button
                                            key={tab.key}
                                            onClick={() => {
                                                setDetailTab(tab.key as typeof detailTab)
                                                if (tab.key === 'ledger' && !ledger && detail) fetchLedger(detail.id)
                                            }}
                                            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                                                detailTab === tab.key
                                                    ? 'border-blue-600 text-blue-600'
                                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                            }`}
                                        >
                                            {tab.icon} {tab.label}{tab.count !== null ? ` (${tab.count})` : ''}
                                            {tab.badge ? (
                                                <span className="ml-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                          {tab.badge}
                        </span>
                                            ) : null}
                                        </button>
                                    ))}
                                </div>

                                {/* Content */}
                                <div className="flex-1 overflow-y-auto p-5 space-y-3">

                                    {/* ── POS Sales ── */}
                                    {detailTab === 'sales' && (
                                        detail.sales.length === 0
                                            ? <p className="text-center py-8 text-gray-400">No POS purchases yet</p>
                                            : detail.sales.map(sale => (
                                                <div key={sale.id} className="border border-gray-200 rounded-lg p-4">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-xs text-gray-400">{fmtDateTime(sale.createdAt)}</span>
                                                        <div className="flex items-center gap-2">
                                                            {sale.pointsEarned > 0 && (
                                                                <span className="flex items-center gap-1 text-xs text-amber-600">
                                  <FiStar size={11} className="fill-amber-400" /> +{sale.pointsEarned} pts
                                </span>
                                                            )}
                                                            <span className="text-sm font-bold text-gray-900">NPR {fmt(sale.total)}</span>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        {sale.items.map(item => (
                                                            <div key={item.id} className="flex justify-between text-xs text-gray-600">
                                                                <span>{item.product.name} × {item.quantity} {item.product.unit}</span>
                                                                <span>NPR {fmt(item.subtotal)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="flex justify-between mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
                                                        <span className="capitalize">{sale.paymentMethod}</span>
                                                        {sale.discount > 0 && <span>Disc: NPR {fmt(sale.discount)}</span>}
                                                    </div>
                                                </div>
                                            ))
                                    )}

                                    {/* ── Orders ── */}
                                    {detailTab === 'orders' && (
                                        <>
                                            {/* Header row with summary + new order button */}
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-3 flex-wrap">
                                                    {detail.orders.length > 0 && (() => {
                                                        const totalDue = detail.orders.reduce((s, o) => s + o.balanceDue, 0)
                                                        const totalOrders = detail.orders.length
                                                        const pending = detail.orders.filter(o => o.status === 'PENDING' || o.status === 'IN_PROGRESS').length
                                                        return (
                                                            <>
                                                                <span className="text-xs text-gray-500">{totalOrders} order{totalOrders !== 1 ? 's' : ''}</span>
                                                                {pending > 0 && (
                                                                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                                    {pending} active
                                  </span>
                                                                )}
                                                                {totalDue > 0 && (
                                                                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                    <FiAlertCircle size={10} /> NPR {fmt(totalDue)} due
                                  </span>
                                                                )}
                                                            </>
                                                        )
                                                    })()}
                                                </div>
                                                {can('orders', 'edit') && (
                                                    <button
                                                        onClick={openNewOrder}
                                                        className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                                                    >
                                                        <FiPlus size={13} /> New Order
                                                    </button>
                                                )}
                                            </div>

                                            {detail.orders.length === 0 ? (
                                                <div className="text-center py-10 text-gray-400">
                                                    <FiPackage size={32} className="mx-auto mb-2 opacity-40" />
                                                    <p className="font-medium text-sm">No orders yet</p>
                                                    {can('orders', 'edit') && (
                                                        <button onClick={openNewOrder} className="mt-3 text-blue-600 text-sm hover:underline flex items-center gap-1 mx-auto">
                                                            <FiPlus size={13} /> Create first order
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {detail.orders.map(order => {
                                                        const isActive = order.status === 'PENDING' || order.status === 'IN_PROGRESS'
                                                        const isFullyPaid = order.paymentStatus === 'PAID'
                                                        const isCancelled = order.status === 'CANCELLED'
                                                        return (
                                                            <div
                                                                key={order.id}
                                                                className={`border rounded-xl overflow-hidden transition-all ${
                                                                    isCancelled ? 'border-gray-200 opacity-60' :
                                                                        order.balanceDue > 0 ? 'border-orange-200' :
                                                                            'border-gray-200'
                                                                }`}
                                                            >
                                                                {/* Order header */}
                                                                <div className={`flex items-start justify-between px-4 py-3 ${
                                                                    isCancelled ? 'bg-gray-50' :
                                                                        order.balanceDue > 0 ? 'bg-orange-50' :
                                                                            isFullyPaid ? 'bg-green-50' : 'bg-gray-50'
                                                                }`}>
                                                                    <div>
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono text-xs font-semibold text-gray-700">
                                        {order.orderNumber}
                                      </span>
                                                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[order.status] || 'bg-gray-100 text-gray-700'}`}>
                                        {order.status.replace('_', ' ')}
                                      </span>
                                                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${payColor[order.paymentStatus] || 'bg-gray-100'}`}>
                                        {order.paymentStatus}
                                      </span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 flex-wrap">
                                                                            <span><FiClock size={10} className="inline mr-0.5" />{fmtDate(order.createdAt)}</span>
                                                                            {order.deliveryDate && (
                                                                                <span className={`flex items-center gap-0.5 ${
                                                                                    new Date(order.deliveryDate) < new Date() && isActive
                                                                                        ? 'text-red-500 font-medium' : ''
                                                                                }`}>
                                          📦 {fmtDate(order.deliveryDate)}
                                        </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right shrink-0">
                                                                        <p className="text-sm font-bold text-gray-900">NPR {fmt(order.totalAmount)}</p>
                                                                        {order.balanceDue > 0 && (
                                                                            <p className="text-xs text-red-600 font-semibold">
                                                                                Due: NPR {fmt(order.balanceDue)}
                                                                            </p>
                                                                        )}
                                                                        {order.advancePaid > 0 && (
                                                                            <p className="text-xs text-green-600">
                                                                                Paid: NPR {fmt(order.advancePaid)}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Items */}
                                                                <div className="px-4 py-2 space-y-1">
                                                                    {order.items.map(item => (
                                                                        <div key={item.id} className="flex justify-between text-xs text-gray-600">
                                                                            <span>{item.name} × {item.quantity}</span>
                                                                            <span>NPR {fmt(item.subtotal)}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>

                                                                {/* Payment progress bar */}
                                                                {order.totalAmount > 0 && !isCancelled && (
                                                                    <div className="px-4 pb-2">
                                                                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                                            <div
                                                                                className={`h-full rounded-full transition-all ${isFullyPaid ? 'bg-green-500' : 'bg-orange-400'}`}
                                                                                style={{ width: `${Math.min(100, (order.advancePaid / order.totalAmount) * 100)}%` }}
                                                                            />
                                                                        </div>
                                                                        <p className="text-xs text-gray-400 mt-0.5">
                                                                            {Math.round((order.advancePaid / order.totalAmount) * 100)}% paid
                                                                        </p>
                                                                    </div>
                                                                )}

                                                                {/* Actions */}
                                                                {!isCancelled && can('orders', 'edit') && (
                                                                    <div className="px-4 pb-3 flex gap-2">
                                                                        <button
                                                                            onClick={() => openEditOrder(order)}
                                                                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors"
                                                                        >
                                                                            <FiEdit2 size={11} /> Update
                                                                        </button>
                                                                        {order.balanceDue > 0 && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    openEditOrder(order)
                                                                                    setOrderUpdate({
                                                                                        status: order.status,
                                                                                        advancePaid: order.totalAmount.toString(),
                                                                                    })
                                                                                }}
                                                                                className="flex items-center gap-1 text-xs text-green-700 border border-green-300 rounded-lg px-3 py-1.5 hover:bg-green-50 transition-colors"
                                                                            >
                                                                                <FiCheckCircle size={11} /> Mark Paid
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* ── Tables / Credit ── */}
                                    {detailTab === 'tables' && (
                                        <>
                                            {/* Credit summary card */}
                                            {creditStats && creditStats.totalCredit > 0 && (
                                                <div className="grid grid-cols-3 gap-3 mb-2">
                                                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                                                        <p className="text-xs text-gray-500">Total Credit Taken</p>
                                                        <p className="text-base font-bold text-gray-900 mt-0.5">NPR {fmt(creditStats.totalCredit)}</p>
                                                    </div>
                                                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                                                        <p className="text-xs text-gray-500">Paid Back</p>
                                                        <p className="text-base font-bold text-green-700 mt-0.5">NPR {fmt(creditStats.totalPaid)}</p>
                                                    </div>
                                                    <div className={`border rounded-xl p-3 text-center ${
                                                        creditStats.outstanding > 0
                                                            ? 'bg-red-50 border-red-200'
                                                            : 'bg-green-50 border-green-200'
                                                    }`}>
                                                        <p className="text-xs text-gray-500">Outstanding</p>
                                                        <p className={`text-base font-bold mt-0.5 ${
                                                            creditStats.outstanding > 0 ? 'text-red-700' : 'text-green-700'
                                                        }`}>
                                                            NPR {fmt(creditStats.outstanding)}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {(!detail.tableSessions || detail.tableSessions.length === 0) ? (
                                                <p className="text-center py-8 text-gray-400">No table sessions yet</p>
                                            ) : (
                                                detail.tableSessions.map(ts => {
                                                    const paidBack = ts.creditPayments.reduce((s, p) => s + p.amount, 0)
                                                    const creditRemaining = ts.creditAmount - paidBack
                                                    const hasCredit = ts.creditAmount > 0

                                                    return (
                                                        <div
                                                            key={ts.id}
                                                            className={`border rounded-xl p-4 ${
                                                                hasCredit && !ts.creditPaid
                                                                    ? 'border-red-200 bg-red-50/40'
                                                                    : hasCredit && ts.creditPaid
                                                                        ? 'border-green-200 bg-green-50/30'
                                                                        : 'border-gray-200'
                                                            }`}
                                                        >
                                                            {/* Session header */}
                                                            <div className="flex items-start justify-between mb-2">
                                                                <div>
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-sm text-gray-800">
                                      {ts.table.name}
                                    </span>
                                                                        {hasCredit && (
                                                                            ts.creditPaid ? (
                                                                                <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                          <FiCheckCircle size={10} /> Credit Cleared
                                        </span>
                                                                            ) : (
                                                                                <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                                          <FiAlertCircle size={10} /> Credit Pending
                                        </span>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                                                                        <FiClock size={10} />
                                                                        {fmtDateTime(ts.openedAt)}
                                                                        {ts.closedAt && ` → ${new Date(ts.closedAt).toLocaleTimeString('en-NP', { hour: '2-digit', minute: '2-digit' })}`}
                                                                        <span>· {ts.openedBy.name}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right shrink-0">
                                                                    <p className="text-sm font-bold text-gray-900">NPR {fmt(ts.grandTotal)}</p>
                                                                    {ts.discount > 0 && (
                                                                        <p className="text-xs text-gray-400">-NPR {fmt(ts.discount)} disc.</p>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Items summary */}
                                                            <div className="space-y-0.5 mb-3">
                                                                {ts.orders.flatMap(o => o.items).map((item, i) => (
                                                                    <div key={i} className="flex justify-between text-xs text-gray-600">
                                                                        <span>{item.name} × {item.quantity}</span>
                                                                        <span>NPR {fmt(item.subtotal)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            {/* Payment breakdown */}
                                                            <div className="border-t border-gray-200 pt-2 space-y-1">
                                                                <div className="flex justify-between text-xs">
                                                                    <span className="text-gray-500">Paid at table</span>
                                                                    <span className="font-medium text-gray-700">NPR {fmt(ts.paidAmount)}</span>
                                                                </div>
                                                                {hasCredit && (
                                                                    <div className="flex justify-between text-xs">
                                                                        <span className="text-red-600">On credit</span>
                                                                        <span className="font-medium text-red-700">NPR {fmt(ts.creditAmount)}</span>
                                                                    </div>
                                                                )}
                                                                {hasCredit && paidBack > 0 && (
                                                                    <div className="flex justify-between text-xs">
                                                                        <span className="text-green-600">Credit repaid</span>
                                                                        <span className="font-medium text-green-700">NPR {fmt(paidBack)}</span>
                                                                    </div>
                                                                )}
                                                                {hasCredit && !ts.creditPaid && creditRemaining > 0 && (
                                                                    <div className="flex justify-between text-xs font-semibold border-t border-red-200 pt-1">
                                                                        <span className="text-red-700">Still owed</span>
                                                                        <span className="text-red-700">NPR {fmt(creditRemaining)}</span>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Credit payment history */}
                                                            {ts.creditPayments.length > 0 && (
                                                                <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                                                                    <p className="text-xs font-medium text-gray-500">Credit payments:</p>
                                                                    {ts.creditPayments.map(p => (
                                                                        <div key={p.id} className="flex justify-between text-xs text-gray-600">
                                      <span className="flex items-center gap-1">
                                        <FiCheckCircle size={10} className="text-green-500" />
                                          {fmtDate(p.createdAt)} · {p.recordedBy.name}
                                          {p.note && <span className="text-gray-400">({p.note})</span>}
                                      </span>
                                                                            <span className="font-medium text-green-700">+NPR {fmt(p.amount)}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* Record payment button */}
                                                            {hasCredit && !ts.creditPaid && can('customers', 'edit') && (
                                                                <button
                                                                    onClick={() => {
                                                                        setCreditSession(ts)
                                                                        setCreditAmount(String(creditRemaining))
                                                                        setCreditNote('')
                                                                    }}
                                                                    className="mt-3 w-full py-1.5 text-sm rounded-lg border border-red-300 text-red-700 hover:bg-red-100 transition-colors font-medium"
                                                                >
                                                                    Record Credit Payment · NPR {fmt(creditRemaining)} remaining
                                                                </button>
                                                            )}
                                                        </div>
                                                    )
                                                })
                                            )}
                                        </>
                                    )}

                                    {/* ── Ledger ── */}
                                    {detailTab === 'ledger' && (
                                        <>
                                            {ledgerLoading ? (
                                                <div className="text-center py-10 text-gray-400">Loading ledger...</div>
                                            ) : !ledger ? (
                                                <div className="text-center py-10 text-gray-400">No data</div>
                                            ) : (
                                                <>
                                                    {/* Summary cards */}
                                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                                                            <p className="text-xs text-gray-500">Total Spent</p>
                                                            <p className="text-lg font-bold text-blue-700 mt-0.5">
                                                                NPR {fmt(ledger.summary.totalSpent)}
                                                            </p>
                                                        </div>
                                                        <div className={`border rounded-xl p-3 ${
                                                            ledger.summary.totalOutstanding > 0
                                                                ? 'bg-red-50 border-red-200'
                                                                : 'bg-green-50 border-green-200'
                                                        }`}>
                                                            <p className="text-xs text-gray-500">Outstanding Balance</p>
                                                            <p className={`text-lg font-bold mt-0.5 ${
                                                                ledger.summary.totalOutstanding > 0 ? 'text-red-700' : 'text-green-700'
                                                            }`}>
                                                                NPR {fmt(ledger.summary.totalOutstanding)}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Print button */}
                                                    <div className="flex justify-end mb-3">
                                                        <button
                                                            onClick={() => {
                                                                if (!detail || !ledger) return
                                                                printLedger(detail, ledger)
                                                            }}
                                                            className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
                                                        >
                                                            <FiPrinter size={13} /> Print Ledger
                                                        </button>
                                                    </div>

                                                    {/* Ledger table */}
                                                    {ledger.entries.length === 0 ? (
                                                        <p className="text-center py-8 text-gray-400">No transactions yet</p>
                                                    ) : (
                                                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                                                            {/* Column headers */}
                                                            <div className="grid grid-cols-12 bg-gray-50 border-b border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500">
                                                                <div className="col-span-2">Date</div>
                                                                <div className="col-span-4">Description</div>
                                                                <div className="col-span-2 text-right">Debit</div>
                                                                <div className="col-span-2 text-right">Credit</div>
                                                                <div className="col-span-2 text-right">Balance</div>
                                                            </div>

                                                            <div className="divide-y divide-gray-100">
                                                                {ledger.entries.map(entry => {
                                                                    const typeConfig = ledgerTypeConfig(entry.type)
                                                                    return (
                                                                        <div
                                                                            key={entry.id}
                                                                            className={`grid grid-cols-12 px-3 py-2.5 items-center text-xs hover:bg-gray-50 ${
                                                                                entry.type === 'CREDIT_PAYMENT' ? 'bg-green-50/40' :
                                                                                    entry.type === 'TABLE_CREDIT'   ? 'bg-red-50/30' : ''
                                                                            }`}
                                                                        >
                                                                            <div className="col-span-2 text-gray-400">
                                                                                {fmtDate(entry.date)}
                                                                            </div>
                                                                            <div className="col-span-4">
                                                                                <div className="flex items-center gap-1.5">
                                          <span className={`${typeConfig.color} shrink-0`}>
                                            {typeConfig.icon}
                                          </span>
                                                                                    <div>
                                                                                        <p className="text-gray-700 font-medium leading-tight">
                                                                                            {entry.description}
                                                                                        </p>
                                                                                        <p className="text-gray-400 text-xs">{entry.ref}</p>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            <div className="col-span-2 text-right">
                                                                                {entry.debit > 0 && (
                                                                                    <span className="text-gray-800 font-medium">
                                            {fmt(entry.debit)}
                                          </span>
                                                                                )}
                                                                            </div>
                                                                            <div className="col-span-2 text-right">
                                                                                {entry.credit > 0 && (
                                                                                    <span className="text-green-700 font-medium">
                                            {fmt(entry.credit)}
                                          </span>
                                                                                )}
                                                                            </div>
                                                                            <div className={`col-span-2 text-right font-semibold ${
                                                                                entry.balance > 0 ? 'text-red-600' :
                                                                                    entry.balance < 0 ? 'text-green-600' : 'text-gray-500'
                                                                            }`}>
                                                                                {entry.balance !== 0 ? fmt(Math.abs(entry.balance)) : '—'}
                                                                                {entry.balance > 0 && <span className="text-xs font-normal ml-0.5">Dr</span>}
                                                                                {entry.balance < 0 && <span className="text-xs font-normal ml-0.5">Cr</span>}
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>

                                                            {/* Footer totals */}
                                                            <div className="grid grid-cols-12 bg-gray-50 border-t-2 border-gray-300 px-3 py-2.5 text-xs font-bold text-gray-700">
                                                                <div className="col-span-6">Totals</div>
                                                                <div className="col-span-2 text-right text-gray-800">
                                                                    {fmt(ledger.entries.reduce((s, e) => s + e.debit, 0))}
                                                                </div>
                                                                <div className="col-span-2 text-right text-green-700">
                                                                    {fmt(ledger.entries.reduce((s, e) => s + e.credit, 0))}
                                                                </div>
                                                                <div className={`col-span-2 text-right ${
                                                                    ledger.summary.totalOutstanding > 0 ? 'text-red-600' : 'text-green-600'
                                                                }`}>
                                                                    {fmt(ledger.summary.totalOutstanding)}
                                                                    {ledger.summary.totalOutstanding > 0 && <span className="font-normal ml-0.5">Dr</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ── Credit Payment Modal ── */}
            {creditSession && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-sm p-6 space-y-4">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Record Credit Payment</h2>
                            <p className="text-sm text-gray-500 mt-0.5">
                                {creditSession.table.name} · {detail?.name}
                            </p>
                        </div>

                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-red-700">Credit taken</span>
                                <span className="font-semibold text-red-800">NPR {fmt(creditSession.creditAmount)}</span>
                            </div>
                            <div className="flex justify-between mt-1">
                                <span className="text-red-700">Already repaid</span>
                                <span className="font-medium text-red-800">
                  NPR {fmt(creditSession.creditPayments.reduce((s, p) => s + p.amount, 0))}
                </span>
                            </div>
                            <div className="flex justify-between mt-1 pt-1 border-t border-red-200 font-semibold">
                                <span className="text-red-800">Remaining</span>
                                <span className="text-red-800">
                  NPR {fmt(creditSession.creditAmount - creditSession.creditPayments.reduce((s, p) => s + p.amount, 0))}
                </span>
                            </div>
                        </div>

                        <div>
                            <label className="label">Payment Amount (NPR) *</label>
                            <input
                                type="number" min="1"
                                className="input"
                                value={creditAmount}
                                onChange={e => setCreditAmount(e.target.value)}
                                placeholder="Enter amount"
                            />
                        </div>
                        <div>
                            <label className="label">Note (optional)</label>
                            <input
                                className="input"
                                value={creditNote}
                                onChange={e => setCreditNote(e.target.value)}
                                placeholder="e.g. Cash received"
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleCreditPayment}
                                disabled={creditLoading || !creditAmount}
                                className="btn-primary flex-1 disabled:opacity-50"
                            >
                                {creditLoading ? 'Saving...' : 'Record Payment'}
                            </button>
                            <button
                                onClick={() => setCreditSession(null)}
                                className="btn-secondary px-5"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── New Order Modal ── */}
            {showNewOrder && detail && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-200">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">New Order</h2>
                                <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                  <span className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {detail.name.charAt(0)}
                  </span>
                                    {detail.name}
                                    {detail.phone && <span className="text-gray-400">· {detail.phone}</span>}
                                </p>
                            </div>
                            <button onClick={() => setShowNewOrder(false)} className="text-gray-400 hover:text-gray-600">
                                <FiX size={22} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                            {/* Delivery & note */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label text-xs">Delivery Date</label>
                                    <input
                                        type="date" className="input text-sm"
                                        value={orderForm.deliveryDate}
                                        min={new Date().toISOString().split('T')[0]}
                                        onChange={e => setOrderForm(f => ({ ...f, deliveryDate: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="label text-xs">Note</label>
                                    <input
                                        className="input text-sm"
                                        placeholder="Special instructions..."
                                        value={orderForm.note}
                                        onChange={e => setOrderForm(f => ({ ...f, note: e.target.value }))}
                                    />
                                </div>
                            </div>

                            {/* Items */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="label text-xs mb-0">Order Items</label>
                                    <button onClick={addOrderItem} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                                        <FiPlus size={12} /> Add item
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {orderItems.map((item, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                                            <div className="col-span-5">
                                                {idx === 0 && <p className="text-xs text-gray-400 mb-1">Product / Description</p>}
                                                <select
                                                    className="input text-sm"
                                                    value={item.productId || ''}
                                                    onChange={e => updateOrderItem(idx, 'productId', Number(e.target.value))}
                                                >
                                                    <option value="">Custom item...</option>
                                                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                </select>
                                                {!item.productId && (
                                                    <input
                                                        className="input text-sm mt-1"
                                                        placeholder="Item name"
                                                        value={item.name}
                                                        onChange={e => updateOrderItem(idx, 'name', e.target.value)}
                                                    />
                                                )}
                                            </div>
                                            <div className="col-span-2">
                                                {idx === 0 && <p className="text-xs text-gray-400 mb-1">Qty</p>}
                                                <input
                                                    type="number" min="1" className="input text-sm"
                                                    value={item.quantity}
                                                    onChange={e => updateOrderItem(idx, 'quantity', Number(e.target.value))}
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                {idx === 0 && <p className="text-xs text-gray-400 mb-1">Unit Price (NPR)</p>}
                                                <input
                                                    type="number" min="0" className="input text-sm"
                                                    value={item.price}
                                                    onChange={e => updateOrderItem(idx, 'price', Number(e.target.value))}
                                                />
                                            </div>
                                            <div className="col-span-1 text-right">
                                                {idx === 0 && <div className="h-4 mb-1" />}
                                                <p className="text-xs font-semibold text-gray-700 py-2">
                                                    {fmt(item.price * item.quantity)}
                                                </p>
                                            </div>
                                            <div className="col-span-1 flex justify-center">
                                                {idx === 0 && <div className="h-4 mb-1" />}
                                                <button
                                                    onClick={() => removeOrderItem(idx)}
                                                    disabled={orderItems.length === 1}
                                                    className="text-red-400 hover:text-red-600 disabled:opacity-30 py-2"
                                                >
                                                    <FiTrash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Totals + advance */}
                            <div className="bg-gray-50 rounded-xl p-4 space-y-2 border border-gray-200">
                                <div className="flex justify-between text-sm font-bold text-gray-900">
                                    <span>Order Total</span>
                                    <span>NPR {fmt(orderTotal)}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <label className="text-sm text-gray-600 shrink-0">Advance Paid (NPR)</label>
                                    <input
                                        type="number" min="0" max={orderTotal}
                                        className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-right"
                                        value={orderForm.advancePaid}
                                        onChange={e => setOrderForm(f => ({ ...f, advancePaid: e.target.value }))}
                                    />
                                </div>
                                <div className={`flex justify-between text-sm font-semibold ${orderBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    <span>Balance Due</span>
                                    <span>NPR {fmt(orderBalance)}</span>
                                </div>
                                {/* Credit limit check */}
                                {orderBalance > 0 && detail.creditLimit > 0 && (
                                    <div className={`text-xs flex items-center gap-1 pt-1 ${
                                        orderBalance > (detail.creditLimit - detail.creditUsed)
                                            ? 'text-red-600' : 'text-green-600'
                                    }`}>
                                        {orderBalance > (detail.creditLimit - detail.creditUsed) ? (
                                            <><FiAlertCircle size={11} /> Exceeds available credit (NPR {fmt(detail.creditLimit - detail.creditUsed)} left)</>
                                        ) : (
                                            <><FiCheckCircle size={11} /> Within credit limit</>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="px-6 pb-5 pt-3 border-t border-gray-200 flex gap-3">
                            <button
                                onClick={handleCreateOrder}
                                disabled={orderLoading || orderItems.every(i => !i.name)}
                                className="btn-primary flex-1 py-2.5 disabled:opacity-50"
                            >
                                {orderLoading ? 'Creating...' : 'Create Order'}
                            </button>
                            <button onClick={() => setShowNewOrder(false)} className="btn-secondary px-6">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Update Order Modal ── */}
            {editingOrder && detail && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Update Order</h2>
                            <p className="text-sm text-gray-500 font-mono mt-0.5">{editingOrder.orderNumber}</p>
                        </div>

                        {/* Amount summary */}
                        <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Total</span>
                                <span className="font-semibold">NPR {fmt(editingOrder.totalAmount)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Currently paid</span>
                                <span className="text-green-600 font-medium">NPR {fmt(editingOrder.advancePaid)}</span>
                            </div>
                            {editingOrder.balanceDue > 0 && (
                                <div className="flex justify-between border-t border-gray-200 pt-1 font-semibold">
                                    <span className="text-red-600">Balance due</span>
                                    <span className="text-red-600">NPR {fmt(editingOrder.balanceDue)}</span>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="label">Status</label>
                            <select
                                className="input"
                                value={orderUpdate.status}
                                onChange={e => setOrderUpdate(d => ({ ...d, status: e.target.value }))}
                            >
                                <option value="PENDING">Pending</option>
                                <option value="IN_PROGRESS">In Progress</option>
                                <option value="COMPLETED">Completed</option>
                                <option value="CANCELLED">Cancelled</option>
                            </select>
                        </div>

                        <div>
                            <label className="label">Total Paid (NPR)</label>
                            <input
                                type="number" min="0" max={editingOrder.totalAmount}
                                className="input"
                                value={orderUpdate.advancePaid}
                                onChange={e => setOrderUpdate(d => ({ ...d, advancePaid: e.target.value }))}
                            />
                            {/* Live balance preview */}
                            {(() => {
                                const newBalance = editingOrder.totalAmount - Number(orderUpdate.advancePaid || 0)
                                return (
                                    <p className={`text-xs mt-1 ${newBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        New balance: NPR {fmt(Math.max(0, newBalance))}
                                        {newBalance <= 0 && ' — fully paid ✓'}
                                    </p>
                                )
                            })()}
                        </div>

                        <div className="flex gap-3 pt-1">
                            <button
                                onClick={handleUpdateOrder}
                                disabled={orderUpdateLoading}
                                className="btn-primary flex-1 disabled:opacity-50"
                            >
                                {orderUpdateLoading ? 'Saving...' : 'Save Changes'}
                            </button>
                            <button onClick={() => setEditingOrder(null)} className="btn-secondary px-5">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}