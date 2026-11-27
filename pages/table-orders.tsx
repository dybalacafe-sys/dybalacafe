// pages/table-orders.tsx
import { useEffect, useState, useCallback, useRef } from 'react'
import Layout from '@/components/Layout'
import { useAuth, apiFetch } from '@/lib/AuthContext'
import { printReceiptHtml } from '@/lib/printReceipt'
import toast from 'react-hot-toast'
import {
    FiPlus, FiMinus, FiTrash2, FiPrinter, FiSearch,
    FiUser, FiClock, FiCheckCircle, FiXCircle,
    FiChevronRight, FiAlertCircle, FiList,
    FiGrid, FiPackage, FiCreditCard,
} from 'react-icons/fi'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Table {
    id: number
    name: string
    capacity: number
    sessions: ActiveSession[]
}

interface ActiveSession {
    id: number
    status: string
    openedAt: string
    customerName: string | null
    orders: { items: { subtotal: number }[] }[]
}

interface Product {
    id: number
    name: string
    price: number
    stock: number
    unit: string
    category?: { name: string }
}

interface OrderItem {
    productId?: number
    name: string
    quantity: number
    price: number
}

interface TableOrderRound {
    id: number
    roundNumber: number
    note: string | null
    createdAt: string
    items: {
        id: number
        name: string
        quantity: number
        price: number
        subtotal: number
        product: { name: string; unit: string } | null
    }[]
}

interface SessionDetail {
    id: number
    customerId?: number | null
    status: string
    openedAt: string
    closedAt: string | null
    customerName: string | null
    totalAmount: number
    discount: number
    grandTotal: number
    paymentMethod: string
    table: { name: string; capacity: number }
    openedBy: { name: string }
    closedBy: { name: string } | null
    customer: { name: string; phone: string; points: number } | null
    orders: TableOrderRound[]
}

interface HistorySession {
    id: number
    status: string
    openedAt: string
    closedAt: string | null
    customerName: string | null
    grandTotal: number
    totalAmount: number
    discount: number
    paymentMethod: string
    table: { name: string }
    openedBy: { name: string }
    closedBy: { name: string } | null
    orders: TableOrderRound[]
}

type View = 'tables' | 'session' | 'history'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString()
const fmtDate = (d: string) =>
    new Date(d).toLocaleString('en-NP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const fmtTime = (d: string) =>
    new Date(d).toLocaleString('en-NP', { hour: '2-digit', minute: '2-digit', hour12: true })

// ─── Print Receipt ────────────────────────────────────────────────────────────
// Uses a hidden iframe via printReceiptHtml so print never affects the main page layout.
function usePrintReceipt() {
    return printReceiptHtml
}

function buildKitchenHtml(session: SessionDetail, latestRound: TableOrderRound | null): string {
    const items = latestRound?.items ?? []
    const rows = items.map(item => `
    <tr>
      <td style="font-weight:bold;text-transform:uppercase;font-size:14px;">${item.name}</td>
      <td class="right" style="font-size:18px;">${item.quantity}</td>
    </tr>
  `).join('')

    return `
    <div class="center" style="border-bottom:2px dashed #000;padding-bottom:8px;margin-bottom:8px;">
      <div class="bold large">🍽 KITCHEN ORDER</div>
      <div class="bold xlarge">${session.table.name}</div>
      <div>Round #${latestRound?.roundNumber ?? ''}</div>
      <div class="small">${latestRound ? fmtDate(latestRound.createdAt) : ''}</div>
    </div>
    ${latestRound?.note ? `<div class="note-box">NOTE: ${latestRound.note}</div>` : ''}
    <table>
      <thead><tr><th>ITEM</th><th class="right">QTY</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="center small muted" style="margin-top:12px;">*** KITCHEN COPY ***</div>
  `
}

function buildWaiterHtml(session: SessionDetail): string {
    const subtotal = session.orders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.subtotal, 0), 0)
    const grandTotal = session.grandTotal || subtotal - (session.discount || 0)

    const rounds = session.orders.map(order => {
        const itemRows = order.items.map(item => `
      <div class="row">
        <span>${item.name} × ${item.quantity}</span>
        <span>NPR ${item.subtotal.toLocaleString()}</span>
      </div>
    `).join('')
        return `
      <div style="margin-bottom:10px;">
        <div class="row bold" style="border-bottom:1px dashed #000;padding-bottom:3px;margin-bottom:4px;">
          <span>Round #${order.roundNumber}</span>
          <span>${fmtTime(order.createdAt)}</span>
        </div>
        ${itemRows}
      </div>
    `
    }).join('')

    return `
    <div class="center" style="border-bottom:2px dashed #000;padding-bottom:8px;margin-bottom:8px;">
      <div class="bold large">BILL / RECEIPT</div>
      <div class="bold xlarge">${session.table.name}</div>
      ${session.customerName ? `<div>Guest: ${session.customerName}</div>` : ''}
      <div class="small">Opened: ${fmtDate(session.openedAt)}</div>
      ${session.closedAt ? `<div class="small">Closed: ${fmtDate(session.closedAt)}</div>` : ''}
      <div class="small">Server: ${session.openedBy.name}</div>
    </div>

    ${rounds}

    <div class="divider-solid"></div>
    <div class="row"><span>Subtotal</span><span>NPR ${subtotal.toLocaleString()}</span></div>
    ${session.discount > 0 ? `<div class="row"><span>Discount</span><span>- NPR ${session.discount.toLocaleString()}</span></div>` : ''}
    <div class="divider"></div>
    <div class="row-bold" style="font-size:15px;">
      <span>TOTAL</span><span>NPR ${grandTotal.toLocaleString()}</span>
    </div>
    <div class="row small muted"><span>Payment</span><span style="text-transform:capitalize;">${session.paymentMethod}</span></div>

    <div class="center" style="margin-top:14px;">Thank you for dining with us!</div>
    <div class="center small muted">*** CUSTOMER COPY ***</div>
  `
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TableOrdersPage() {
    const { token, selectedOutlet } = useAuth()
    const [view, setView] = useState<View>('tables')

    // Table grid state
    const [tables, setTables] = useState<Table[]>([])
    const [tablesLoading, setTablesLoading] = useState(false)

    // New table modal
    const [showTableModal, setShowTableModal] = useState(false)
    const [newTableName, setNewTableName] = useState('')
    const [newTableCapacity, setNewTableCapacity] = useState('4')
    const [tableModalLoading, setTableModalLoading] = useState(false)

    // Open session modal
    const [openSessionModal, setOpenSessionModal] = useState<Table | null>(null)
    const [sessionCustomerName, setSessionCustomerName] = useState('')
    const [sessionCustomerPhone, setSessionCustomerPhone] = useState('')
    const [openSessionLoading, setOpenSessionLoading] = useState(false)

    // Active session view
    const [session, setSession] = useState<SessionDetail | null>(null)
    const [sessionLoading, setSessionLoading] = useState(false)
    const [products, setProducts] = useState<Product[]>([])
    const [productSearch, setProductSearch] = useState('')

    // New order round state
    const [orderItems, setOrderItems] = useState<OrderItem[]>([{ name: '', quantity: 1, price: 0 }])
    const [orderNote, setOrderNote] = useState('')
    const [orderLoading, setOrderLoading] = useState(false)
    const [showOrderPanel, setShowOrderPanel] = useState(false)
    const [latestRound, setLatestRound] = useState<TableOrderRound | null>(null)

    // Checkout state
    const [showCheckout, setShowCheckout]         = useState(false)
    const [checkoutDiscount, setCheckoutDiscount] = useState(0)
    const [checkoutPayment, setCheckoutPayment]   = useState('cash')
    const [checkoutPaidAmount, setCheckoutPaidAmount] = useState('')
    const [checkoutLoading, setCheckoutLoading]   = useState(false)

    // Print state — managed imperatively via triggerPrint(), no state needed

    // History state
    const [history, setHistory] = useState<HistorySession[]>([])
    const [historyTotal, setHistoryTotal] = useState(0)
    const [historyPage, setHistoryPage] = useState(1)
    const [historyLoading, setHistoryLoading] = useState(false)
    const [expandedSession, setExpandedSession] = useState<number | null>(null)
    const HISTORY_LIMIT = 15

    // ── Data fetching ──

    const fetchTables = useCallback(async () => {
        if (!token) return
        setTablesLoading(true)
        try {
            const data = await apiFetch('/api/tables', {}, token)
            setTables(Array.isArray(data) ? data as Table[] : [])
        } finally {
            setTablesLoading(false)
        }
    }, [token])

    const fetchProducts = useCallback(async () => {
        if (!token) return
        const data = await apiFetch('/api/products?type=finished', {}, token)
        setProducts(Array.isArray(data) ? data as Product[] : [])
    }, [token])

    const fetchSession = useCallback(async (sessionId: number) => {
        if (!token) return
        setSessionLoading(true)
        try {
            const data = await apiFetch(`/api/table-sessions/${sessionId}`, {}, token)
            setSession(data as SessionDetail)
        } finally {
            setSessionLoading(false)
        }
    }, [token])

    const fetchHistory = useCallback(async (page = 1) => {
        if (!token) return
        setHistoryLoading(true)
        try {
            const data = await apiFetch(
                `/api/table-sessions?status=CLOSED&page=${page}&limit=${HISTORY_LIMIT}`,
                {},
                token
            ) as { sessions: HistorySession[]; total: number }
            const list = Array.isArray(data) ? data : ((data && typeof data === 'object' && Array.isArray((data as any).sessions)) ? (data as any).sessions : [])
            setHistory(list)
            setHistoryTotal((data as any)?.total ?? list.length)
            setHistoryPage(page)
        } finally {
            setHistoryLoading(false)
        }
    }, [token])

    useEffect(() => { fetchTables() }, [fetchTables])
    useEffect(() => { fetchProducts() }, [fetchProducts])
    useEffect(() => { if (view === 'history') fetchHistory(1) }, [view, fetchHistory])

    // ── Print (iframe-based, inline styles — no Tailwind dependency) ──
    const printReceipt = usePrintReceipt()

    // @ts-ignore
    const triggerPrint = (mode) => {
        if (!session || !mode) return
        const html = mode === 'kitchen'
            ? buildKitchenHtml(session, latestRound)
            : buildWaiterHtml(session)
        printReceipt(html)
    }

    // ── Table grid helpers ──

    const getTableStatus = (table: Table) => {
        const openSession = table.sessions?.[0]
        if (!openSession) return 'empty'
        return 'occupied'
    }

    const getSessionTotal = (session: ActiveSession) =>
        session.orders?.reduce((s, o) => s + o.items.reduce((a, i) => a + i.subtotal, 0), 0) ?? 0

    // ── Open session ──

    const handleOpenSession = async () => {
        if (!openSessionModal) return
        setOpenSessionLoading(true)
        try {
            const data = await apiFetch('/api/table-sessions', {
                method: 'POST',
                body: JSON.stringify({
                    tableId: openSessionModal.id,
                    customerName: sessionCustomerName || undefined,
                    customerPhone: sessionCustomerPhone || undefined,
                }),
            }, token) as { id: number }
            toast.success(`Session opened for ${openSessionModal.name}`)
            setOpenSessionModal(null)
            setSessionCustomerName('')
            setSessionCustomerPhone('')
            await fetchTables()
            await fetchSession(data.id)
            setView('session')
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed')
        } finally {
            setOpenSessionLoading(false)
        }
    }

    // ── Navigate to an existing open session ──

    const openExistingSession = async (table: Table) => {
        const active = table.sessions?.[0]
        if (!active) return
        await fetchSession(active.id)
        setView('session')
    }

    // ── Add order round ──

    const addOrderItem = () => setOrderItems(prev => [...prev, { name: '', quantity: 1, price: 0 }])
    // Reset order panel state when opening
    const openOrderPanel = () => {
        setOrderItems([])
        setOrderNote('')
        setProductSearch('')
        setShowOrderPanel(true)
    }
    const removeOrderItem = (i: number) => setOrderItems(prev => prev.filter((_, idx) => idx !== i))
    const updateOrderItem = (i: number, field: keyof OrderItem, value: string | number) => {
        setOrderItems(prev => {
            const updated = [...prev]
            updated[i] = { ...updated[i], [field]: value }
            if (field === 'productId') {
                const product = products.find(p => p.id === Number(value))
                if (product) {
                    updated[i].name = product.name
                    updated[i].price = product.price
                }
            }
            return updated
        })
    }

    const handleAddRound = async () => {
        if (!session) return
        const validItems = orderItems.filter(i => i.name && i.quantity > 0)
        if (validItems.length === 0) {
            toast.error('Add at least one item')
            return
        }
        setOrderLoading(true)
        try {
            const round = await apiFetch('/api/table-orders', {
                method: 'POST',
                body: JSON.stringify({
                    sessionId: session.id,
                    items: validItems,
                    note: orderNote || undefined,
                }),
            }, token) as TableOrderRound
            toast.success(`Round #${round.roundNumber} added!`)
            setLatestRound(round)
            setOrderItems([{ name: '', quantity: 1, price: 0 }])
            setOrderNote('')
            setShowOrderPanel(false)
            await fetchSession(session.id)
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed')
        } finally {
            setOrderLoading(false)
        }
    }

    // ── Checkout ──

    const handleCheckout = async () => {
        if (!session) return
        setCheckoutLoading(true)
        try {
            const data = await apiFetch(`/api/table-sessions/${session.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    action: 'checkout',
                    discount: checkoutDiscount,
                    paymentMethod: checkoutPayment,
                    paidAmount: checkoutPaidAmount !== '' ? Number(checkoutPaidAmount) : undefined,
                }),
            }, token) as SessionDetail & { pointsEarned: number }

            toast.success('Bill settled! Table is now free.')
            if (data.pointsEarned > 0) {
                toast.success(`+${data.pointsEarned} loyalty points awarded!`, { icon: '⭐' })
            }
            setSession(data)
            setShowCheckout(false)
            setLatestRound(null)
            setCheckoutPaidAmount('')
            // Auto-print waiter bill after checkout using the fresh session data
            const html = buildWaiterHtml(data)
            printReceipt(html)
            await fetchTables()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed')
        } finally {
            setCheckoutLoading(false)
        }
    }

    // ── Derived ──

    const sessionSubtotal = session?.orders.reduce(
        (s, o) => s + o.items.reduce((a, i) => a + i.subtotal, 0), 0
    ) ?? 0

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase()) && p.stock > 0
    )

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <Layout>
            {/* Tab nav */}
            <div className="flex items-center gap-1 mb-5 border-b border-gray-200">
                {[
                    { key: 'tables', label: 'Tables', icon: <FiGrid size={14} /> },
                    { key: 'history', label: 'Session History', icon: <FiList size={14} /> },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setView(tab.key as View)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                            view === tab.key || (view === 'session' && tab.key === 'tables')
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* ══════════════════ TABLES VIEW ══════════════════ */}
            {(view === 'tables') && (
                <div>
                    <div className="flex items-center justify-between mb-5">
                        <h1 className="text-2xl font-bold text-gray-900">Table Management</h1>
                        <button
                            onClick={() => setShowTableModal(true)}
                            className="btn-primary flex items-center gap-2"
                        >
                            <FiPlus size={16} /> Add Table
                        </button>
                    </div>

                    {tablesLoading ? (
                        <div className="text-center py-20 text-gray-400">Loading tables...</div>
                    ) : tables.length === 0 ? (
                        <div className="text-center py-20 text-gray-400">
                            <FiPackage size={40} className="mx-auto mb-3 opacity-40" />
                            <p className="font-medium">No tables yet</p>
                            <p className="text-sm mt-1">Add your first table to get started</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {tables.map(table => {
                                const status = getTableStatus(table)
                                const activeSession = table.sessions?.[0]
                                const runningTotal = activeSession ? getSessionTotal(activeSession) : 0
                                const isOccupied = status === 'occupied'
                                const elapsed = activeSession
                                    ? Math.floor((Date.now() - new Date(activeSession.openedAt).getTime()) / 60000)
                                    : 0

                                return (
                                    <button
                                        key={table.id}
                                        onClick={() =>
                                            isOccupied ? openExistingSession(table) : setOpenSessionModal(table)
                                        }
                                        className={`relative rounded-2xl border-2 p-5 text-left transition-all hover:shadow-lg group ${
                                            isOccupied
                                                ? 'border-orange-300 bg-orange-50 hover:border-orange-400'
                                                : 'border-gray-200 bg-white hover:border-blue-400'
                                        }`}
                                    >
                                        {/* Status dot */}
                                        <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${
                                            isOccupied ? 'bg-orange-400 animate-pulse' : 'bg-green-400'
                                        }`} />

                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
                                            isOccupied ? 'bg-orange-100' : 'bg-blue-50'
                                        }`}>
                      <span className={`text-xl font-bold ${isOccupied ? 'text-orange-600' : 'text-blue-500'}`}>
                        {table.name.charAt(0)}
                      </span>
                                        </div>

                                        <p className="font-bold text-gray-800 text-sm">{table.name}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {table.capacity} seats
                                        </p>

                                        {isOccupied && activeSession ? (
                                            <div className="mt-3 pt-3 border-t border-orange-200">
                                                <p className="text-xs text-orange-700 font-semibold">
                                                    NPR {fmt(runningTotal)}
                                                </p>
                                                <p className="text-xs text-orange-500 flex items-center gap-1 mt-0.5">
                                                    <FiClock size={10} /> {elapsed}m
                                                    {activeSession.customerName && ` · ${activeSession.customerName}`}
                                                </p>
                                                <p className="text-xs text-orange-400 mt-1">
                                                    {activeSession.orders.length} round{activeSession.orders.length !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="mt-3 pt-3 border-t border-gray-100">
                                                <p className="text-xs text-green-600 font-medium">Available</p>
                                            </div>
                                        )}

                                        <div className={`absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity ${
                                            isOccupied ? 'text-orange-400' : 'text-blue-400'
                                        }`}>
                                            <FiChevronRight size={16} />
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════════ SESSION VIEW ══════════════════ */}
            {view === 'session' && session && (
                <div>
                    {/* Header */}
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <button
                                    onClick={() => { setView('tables'); setSession(null) }}
                                    className="text-sm text-blue-600 hover:underline"
                                >
                                    ← Tables
                                </button>
                                <span className="text-gray-300">/</span>
                                <span className="text-sm text-gray-600">{session.table.name}</span>
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900">{session.table.name}</h1>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    session.status === 'OPEN'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                }`}>
                  {session.status}
                </span>
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <FiClock size={11} /> Opened {fmtDate(session.openedAt)}
                </span>
                                {session.customerName && (
                                    <span className="text-xs text-gray-500 flex items-center gap-1">
                    <FiUser size={11} /> {session.customerName}
                  </span>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            {session.status === 'OPEN' && (
                                <button
                                    onClick={() => openOrderPanel()}
                                    className="btn-primary flex items-center gap-2"
                                >
                                    <FiPlus size={16} /> New Round
                                </button>
                            )}
                            {latestRound && (
                                <button
                                    onClick={() => triggerPrint('kitchen')}
                                    className="btn-secondary flex items-center gap-2 text-sm"
                                >
                                    <FiPrinter size={14} /> Kitchen
                                </button>
                            )}
                            <button
                                onClick={() => triggerPrint('waiter')}
                                className="btn-secondary flex items-center gap-2 text-sm"
                            >
                                <FiPrinter size={14} /> Bill
                            </button>
                            {session.status === 'OPEN' && (
                                <button
                                    onClick={() => { setCheckoutDiscount(0); setCheckoutPaidAmount(''); setShowCheckout(true) }}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
                                >
                                    <FiCheckCircle size={16} /> Checkout
                                </button>
                            )}
                        </div>
                    </div>

                    {sessionLoading ? (
                        <div className="text-center py-20 text-gray-400">Loading session...</div>
                    ) : (
                        <div className="flex flex-col lg:flex-row gap-6">
                            {/* Order rounds */}
                            <div className="flex-1 space-y-4">
                                {session.orders.length === 0 ? (
                                    <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center text-gray-400">
                                        <p className="text-3xl mb-2">🍽</p>
                                        <p>No orders yet — add the first round</p>
                                    </div>
                                ) : (
                                    session.orders.map(order => (
                                        <div key={order.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                                                <div className="flex items-center gap-2">
                          <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full text-xs font-bold flex items-center justify-center">
                            {order.roundNumber}
                          </span>
                                                    <span className="text-sm font-semibold text-gray-700">Round #{order.roundNumber}</span>
                                                    {order.note && (
                                                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                              {order.note}
                            </span>
                                                    )}
                                                </div>
                                                <span className="text-xs text-gray-400 flex items-center gap-1">
                          <FiClock size={10} /> {fmtDate(order.createdAt)}
                        </span>
                                            </div>
                                            <div className="divide-y divide-gray-100">
                                                {order.items.map(item => (
                                                    <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
                                                        <div className="flex-1">
                                                            <p className="text-sm font-medium text-gray-800">{item.name}</p>
                                                            <p className="text-xs text-gray-400">
                                                                NPR {fmt(item.price)} × {item.quantity}
                                                            </p>
                                                        </div>
                                                        <p className="text-sm font-semibold text-gray-900">
                                                            NPR {fmt(item.subtotal)}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex justify-between">
                                                <span className="text-xs text-gray-500">Round total</span>
                                                <span className="text-xs font-semibold text-gray-700">
                          NPR {fmt(order.items.reduce((s, i) => s + i.subtotal, 0))}
                        </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Summary sidebar */}
                            <div className="w-full lg:w-72 space-y-4">
                                <div className="bg-white border border-gray-200 rounded-xl p-4">
                                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Session Summary</h3>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Rounds</span>
                                            <span className="font-medium">{session.orders.length}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Items</span>
                                            <span className="font-medium">
                        {session.orders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.quantity, 0), 0)}
                      </span>
                                        </div>
                                        <div className="border-t border-gray-100 pt-2 flex justify-between">
                                            <span className="font-semibold text-gray-700">Running Total</span>
                                            <span className="font-bold text-gray-900">NPR {fmt(sessionSubtotal)}</span>
                                        </div>
                                    </div>
                                </div>

                                {session.status === 'CLOSED' && (
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <FiCheckCircle className="text-emerald-600" size={16} />
                                            <span className="text-sm font-semibold text-emerald-800">Bill Settled</span>
                                        </div>
                                        <div className="space-y-1 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-emerald-700">Subtotal</span>
                                                <span>NPR {fmt(session.totalAmount)}</span>
                                            </div>
                                            {session.discount > 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-emerald-700">Discount</span>
                                                    <span>- NPR {fmt(session.discount)}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between font-bold border-t border-emerald-200 pt-1">
                                                <span className="text-emerald-800">Grand Total</span>
                                                <span className="text-emerald-900">NPR {fmt(session.grandTotal)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs text-emerald-600 pt-1">
                                                <span>Payment</span>
                                                <span className="capitalize">{session.paymentMethod}</span>
                                            </div>
                                            {session.closedBy && (
                                                <div className="flex justify-between text-xs text-emerald-600">
                                                    <span>By</span>
                                                    <span>{session.closedBy.name}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════════ HISTORY VIEW ══════════════════ */}
            {view === 'history' && (
                <div>
                    <div className="flex items-center justify-between mb-5">
                        <h1 className="text-2xl font-bold text-gray-900">Session History</h1>
                        <button onClick={() => fetchHistory(historyPage)} className="btn-secondary text-sm">
                            Refresh
                        </button>
                    </div>

                    {historyLoading ? (
                        <div className="text-center py-20 text-gray-400">Loading...</div>
                    ) : history.length === 0 ? (
                        <div className="text-center py-20 text-gray-400">No closed sessions yet</div>
                    ) : (
                        <>
                            <div className="space-y-3">
                                {history.map(s => (
                                    <div key={s.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                        <button
                                            onClick={() => setExpandedSession(expandedSession === s.id ? null : s.id)}
                                            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <span className="text-sm font-semibold text-gray-800">{s.table.name}</span>
                                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">
                          {s.paymentMethod}
                        </span>
                                                {s.customerName && (
                                                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <FiUser size={10} /> {s.customerName}
                          </span>
                                                )}
                                                <span className="text-xs text-gray-400">
                          {s.orders.length} round{s.orders.length !== 1 ? 's' : ''}
                        </span>
                                                <span className="text-xs text-gray-400 flex items-center gap-1">
                          <FiClock size={10} />
                                                    {fmtDate(s.openedAt)}
                                                    {s.closedAt && ` → ${fmtTime(s.closedAt)}`}
                        </span>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <div className="text-right">
                                                    <p className="text-sm font-bold text-gray-900">NPR {fmt(s.grandTotal)}</p>
                                                    {s.discount > 0 && (
                                                        <p className="text-xs text-gray-400">-NPR {fmt(s.discount)} disc.</p>
                                                    )}
                                                </div>
                                                <FiChevronRight
                                                    size={16}
                                                    className={`text-gray-400 transition-transform ${expandedSession === s.id ? 'rotate-90' : ''}`}
                                                />
                                            </div>
                                        </button>

                                        {expandedSession === s.id && (
                                            <div className="border-t border-gray-100 px-4 py-3 space-y-3">
                                                {s.orders.map(order => (
                                                    <div key={order.id}>
                                                        <p className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                              <span className="w-4 h-4 bg-blue-100 text-blue-700 rounded-full text-xs font-bold flex items-center justify-center">
                                {order.roundNumber}
                              </span>
                                                            Round #{order.roundNumber} · {fmtTime(order.createdAt)}
                                                        </p>
                                                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                                                            {order.items.map((item, i) => (
                                                                <span key={i} className="text-xs text-gray-600">
                                  {item.name} ×{item.quantity}
                                                                    <span className="text-gray-400 ml-1">NPR {fmt(item.subtotal)}</span>
                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                                <div className="border-t border-gray-100 pt-2 flex items-center justify-between text-xs text-gray-500">
                                                    <span>By {s.openedBy.name}{s.closedBy ? ` · Closed by ${s.closedBy.name}` : ''}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {historyTotal > HISTORY_LIMIT && (
                                <div className="flex items-center justify-center gap-3 mt-6">
                                    <button
                                        onClick={() => fetchHistory(historyPage - 1)}
                                        disabled={historyPage === 1}
                                        className="btn-secondary text-sm disabled:opacity-40"
                                    >
                                        Previous
                                    </button>
                                    <span className="text-sm text-gray-600">
                    Page {historyPage} of {Math.ceil(historyTotal / HISTORY_LIMIT)}
                  </span>
                                    <button
                                        onClick={() => fetchHistory(historyPage + 1)}
                                        disabled={historyPage >= Math.ceil(historyTotal / HISTORY_LIMIT)}
                                        className="btn-secondary text-sm disabled:opacity-40"
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* ══════════════════ MODALS ══════════════════ */}

            {/* Add Table Modal */}
            {showTableModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">Add New Table</h2>
                        <div className="space-y-3">
                            <div>
                                <label className="label text-sm">Table Name *</label>
                                <input
                                    className="input"
                                    placeholder='e.g. "Table 1", "Patio A", "Bar 3"'
                                    value={newTableName}
                                    onChange={e => setNewTableName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="label text-sm">Capacity (seats)</label>
                                <input
                                    type="number" min="1" className="input"
                                    value={newTableCapacity}
                                    onChange={e => setNewTableCapacity(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-5">
                            <button
                                onClick={async () => {
                                    if (!newTableName.trim()) { toast.error('Table name required'); return }
                                    setTableModalLoading(true)
                                    try {
                                        await apiFetch('/api/tables', {
                                            method: 'POST',
                                            body: JSON.stringify({ name: newTableName.trim(), capacity: Number(newTableCapacity) }),
                                        }, token)
                                        toast.success('Table added!')
                                        setShowTableModal(false)
                                        setNewTableName('')
                                        setNewTableCapacity('4')
                                        fetchTables()
                                    } catch (err: unknown) {
                                        toast.error(err instanceof Error ? err.message : 'Failed')
                                    } finally {
                                        setTableModalLoading(false)
                                    }
                                }}
                                disabled={tableModalLoading}
                                className="btn-primary flex-1 disabled:opacity-50"
                            >
                                {tableModalLoading ? 'Adding...' : 'Add Table'}
                            </button>
                            <button onClick={() => setShowTableModal(false)} className="btn-secondary px-4">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Open Session Modal */}
            {openSessionModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
                        <h2 className="text-lg font-bold text-gray-900 mb-1">Open {openSessionModal.name}</h2>
                        <p className="text-sm text-gray-500 mb-4">Start a new session for this table</p>
                        <div className="space-y-3">
                            <div>
                                <label className="label text-sm">Guest Name (optional)</label>
                                <input
                                    className="input"
                                    placeholder="Customer or reservation name"
                                    value={sessionCustomerName}
                                    onChange={e => setSessionCustomerName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="label text-sm">Phone (optional)</label>
                                <input
                                    type="tel" className="input"
                                    placeholder="For loyalty points"
                                    value={sessionCustomerPhone}
                                    onChange={e => setSessionCustomerPhone(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-5">
                            <button
                                onClick={handleOpenSession}
                                disabled={openSessionLoading}
                                className="btn-primary flex-1 disabled:opacity-50"
                            >
                                {openSessionLoading ? 'Opening...' : 'Open Session'}
                            </button>
                            <button onClick={() => setOpenSessionModal(null)} className="btn-secondary px-4">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* New Order Round Panel */}
            {showOrderPanel && session && (
                <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
                    <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl shadow-xl max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-200">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">
                                    New Order — Round #{(session.orders.length ?? 0) + 1}
                                </h2>
                                <p className="text-xs text-gray-500">{session.table.name}</p>
                            </div>
                            <button onClick={() => setShowOrderPanel(false)} className="text-gray-400 hover:text-gray-600">
                                <FiXCircle size={22} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 space-y-5">
                            {/* Product search — always visible, like POS */}
                            <div>
                                <label className="label text-xs">Search &amp; add from inventory</label>
                                <div className="relative mb-2">
                                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                    <input
                                        className="input pl-9 text-sm"
                                        placeholder="Search products..."
                                        value={productSearch}
                                        onChange={e => setProductSearch(e.target.value)}
                                    />
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                                    {(productSearch ? filteredProducts : products.filter(p => p.stock > 0))
                                        .slice(0, 18)
                                        .map(p => {
                                            const inCart = orderItems.find(i => i.productId === p.id)
                                            return (
                                                <button
                                                    key={p.id}
                                                    onClick={() => {
                                                        const existingIdx = orderItems.findIndex(i => i.productId === p.id)
                                                        if (existingIdx >= 0) {
                                                            updateOrderItem(existingIdx, 'quantity', orderItems[existingIdx].quantity + 1)
                                                        } else {
                                                            setOrderItems(prev => [
                                                                ...prev.filter(i => i.name !== ''),
                                                                { productId: p.id, name: p.name, price: p.price, quantity: 1 },
                                                            ])
                                                        }
                                                    }}
                                                    className={`text-left text-xs border rounded-lg p-2 transition-colors ${
                                                        inCart
                                                            ? 'bg-blue-50 border-blue-400'
                                                            : 'bg-gray-50 hover:bg-blue-50 border-gray-200 hover:border-blue-300'
                                                    }`}
                                                >
                                                    <p className="font-medium text-gray-800 truncate">{p.name}</p>
                                                    <div className="flex items-center justify-between mt-0.5">
                                                        <p className="text-blue-600 font-semibold">NPR {p.price}</p>
                                                        {inCart && (
                                                            <span className="text-blue-700 font-bold">×{inCart.quantity}</span>
                                                        )}
                                                    </div>
                                                    <p className="text-gray-400 mt-0.5">Stock: {p.stock} {p.unit}</p>
                                                </button>
                                            )
                                        })}
                                </div>
                            </div>

                            {/* Item rows — like new-order.tsx with select + optional custom name */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="label text-xs mb-0">Order Items</label>
                                    <button
                                        onClick={addOrderItem}
                                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                    >
                                        <FiPlus size={12} /> Add custom item
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {orderItems.filter(i => i.name !== '' || i.productId).map((item, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                                            <div className="col-span-5">
                                                {idx === 0 && <p className="text-xs text-gray-400 mb-1">Product</p>}
                                                <select
                                                    className="input text-sm"
                                                    value={item.productId || ''}
                                                    onChange={e => updateOrderItem(
                                                        orderItems.indexOf(item), 'productId', Number(e.target.value)
                                                    )}
                                                >
                                                    <option value="">Custom item...</option>
                                                    {products.map(p => (
                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                    ))}
                                                </select>
                                                {!item.productId && (
                                                    <input
                                                        className="input text-sm mt-1"
                                                        placeholder="Item name"
                                                        value={item.name}
                                                        onChange={e => updateOrderItem(orderItems.indexOf(item), 'name', e.target.value)}
                                                    />
                                                )}
                                            </div>
                                            <div className="col-span-2">
                                                {idx === 0 && <p className="text-xs text-gray-400 mb-1">Qty</p>}
                                                <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                                                    <button
                                                        onClick={() => updateOrderItem(orderItems.indexOf(item), 'quantity', Math.max(1, item.quantity - 1))}
                                                        className="px-2 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600"
                                                    >
                                                        <FiMinus size={11} />
                                                    </button>
                                                    <input
                                                        type="number" min="1"
                                                        className="w-full text-center text-sm border-0 py-1.5 focus:ring-0"
                                                        value={item.quantity}
                                                        onChange={e => updateOrderItem(orderItems.indexOf(item), 'quantity', Number(e.target.value))}
                                                    />
                                                    <button
                                                        onClick={() => updateOrderItem(orderItems.indexOf(item), 'quantity', item.quantity + 1)}
                                                        className="px-2 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600"
                                                    >
                                                        <FiPlus size={11} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="col-span-3">
                                                {idx === 0 && <p className="text-xs text-gray-400 mb-1">Unit Price</p>}
                                                <input
                                                    type="number" min="0"
                                                    className="input text-sm"
                                                    value={item.price}
                                                    onChange={e => updateOrderItem(orderItems.indexOf(item), 'price', Number(e.target.value))}
                                                />
                                            </div>
                                            <div className="col-span-1 text-right">
                                                {idx === 0 && <p className="text-xs text-gray-400 mb-1">Total</p>}
                                                <p className="text-xs font-semibold text-gray-700 py-2">
                                                    {fmt(item.price * item.quantity)}
                                                </p>
                                            </div>
                                            <div className="col-span-1 flex justify-center">
                                                {idx === 0 && <div className="h-4 mb-1" />}
                                                <button
                                                    onClick={() => {
                                                        const realIdx = orderItems.indexOf(item)
                                                        removeOrderItem(realIdx)
                                                    }}
                                                    className="text-red-400 hover:text-red-600 py-2"
                                                >
                                                    <FiTrash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {orderItems.filter(i => i.name !== '' || i.productId).length === 0 && (
                                        <p className="text-sm text-gray-400 text-center py-4">
                                            Search and tap products above, or add a custom item
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Note */}
                            <div>
                                <label className="label text-xs">Note for kitchen (optional)</label>
                                <input
                                    className="input text-sm"
                                    placeholder="e.g. No onions, extra spicy..."
                                    value={orderNote}
                                    onChange={e => setOrderNote(e.target.value)}
                                />
                            </div>

                            {/* Round total */}
                            <div className="flex justify-between text-sm font-semibold border-t border-gray-200 pt-3">
                                <span>This round</span>
                                <span>NPR {fmt(orderItems.reduce((s, i) => s + i.price * i.quantity, 0))}</span>
                            </div>
                        </div>

                        <div className="p-5 border-t border-gray-200 flex gap-3">
                            <button
                                onClick={handleAddRound}
                                disabled={orderLoading}
                                className="btn-primary flex-1 py-3 disabled:opacity-50"
                            >
                                {orderLoading ? 'Sending...' : 'Send to Kitchen'}
                            </button>
                            <button onClick={() => setShowOrderPanel(false)} className="btn-secondary px-5">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Checkout Modal */}
            {showCheckout && session && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Settle Bill</h2>
                            <p className="text-sm text-gray-500">{session.table.name}</p>
                        </div>

                        {/* Totals */}
                        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Subtotal</span>
                                <span className="font-medium">NPR {fmt(sessionSubtotal)}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-600 shrink-0">Discount</span>
                                <input
                                    type="number" min="0"
                                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-right"
                                    value={checkoutDiscount}
                                    onChange={e => setCheckoutDiscount(Number(e.target.value))}
                                />
                            </div>
                            <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-2">
                                <span>Grand Total</span>
                                <span>NPR {fmt(sessionSubtotal - checkoutDiscount)}</span>
                            </div>
                        </div>

                        {/* Paid amount — enables credit */}
                        <div>
                            <label className="label text-sm">Amount Paid Now (NPR)</label>
                            <input
                                type="number" min="0"
                                max={sessionSubtotal - checkoutDiscount}
                                className="input"
                                value={checkoutPaidAmount}
                                onChange={e => setCheckoutPaidAmount(e.target.value)}
                                placeholder={`Full: ${sessionSubtotal - checkoutDiscount}`}
                            />
                            {/* Credit preview */}
                            {Number(checkoutPaidAmount) < sessionSubtotal - checkoutDiscount && Number(checkoutPaidAmount) >= 0 && (
                                <div className="mt-2 flex items-center justify-between text-sm px-1">
                  <span className="text-red-600 flex items-center gap-1">
                    <FiCreditCard size={13} /> On credit
                  </span>
                                    <span className="font-semibold text-red-700">
                    NPR {fmt((sessionSubtotal - checkoutDiscount) - Number(checkoutPaidAmount))}
                  </span>
                                </div>
                            )}
                            {session.customerId === null && Number(checkoutPaidAmount) < sessionSubtotal - checkoutDiscount && (
                                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                    <FiAlertCircle size={11} /> A linked customer is required to use credit
                                </p>
                            )}
                        </div>

                        {/* Payment method */}
                        <div>
                            <label className="label text-sm">Payment Method</label>
                            <div className="grid grid-cols-3 gap-2">
                                {['cash', 'card', 'digital'].map(m => (
                                    <button
                                        key={m}
                                        onClick={() => setCheckoutPayment(m)}
                                        className={`py-2 text-sm rounded-lg border capitalize transition-colors ${
                                            checkoutPayment === m
                                                ? 'bg-emerald-600 text-white border-emerald-600'
                                                : 'border-gray-300 text-gray-600 hover:border-gray-400'
                                        }`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <FiAlertCircle className="text-amber-500 shrink-0 mt-0.5" size={15} />
                            <p className="text-xs text-amber-700">
                                Settling will deduct inventory for all items and free the table.
                                {Number(checkoutPaidAmount) < sessionSubtotal - checkoutDiscount && (
                                    <strong className="block mt-0.5 text-red-700">
                                        Remaining balance will be recorded as customer credit.
                                    </strong>
                                )}
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleCheckout}
                                disabled={checkoutLoading}
                                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors disabled:opacity-50"
                            >
                                {checkoutLoading
                                    ? 'Processing...'
                                    : `Settle • NPR ${fmt(Number(checkoutPaidAmount) || sessionSubtotal - checkoutDiscount)}`}
                            </button>
                            <button onClick={() => setShowCheckout(false)} className="btn-secondary px-4">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}