import { useEffect, useState, useCallback, useRef } from 'react'
import Layout from '@/components/Layout'
import { useAuth, apiFetch } from '@/lib/AuthContext'
import { printReceiptHtml } from '@/lib/printReceipt'
import toast from 'react-hot-toast'
import {
  FiSearch, FiTrash2, FiPlus, FiMinus, FiCheck,
  FiShoppingBag, FiClock, FiUser, FiPhone, FiCheckCircle, FiAlertCircle, FiPrinter
} from 'react-icons/fi'

interface Product {
  id: number
  name: string
  price: number
  stock: number
  unit: string
  category?: { name: string }
}

interface CartItem extends Product {
  quantity: number
  subtotal: number
}

interface SaleItem {
  id: number
  product: { name: string }
  quantity: number
  price: number
  subtotal: number
}

interface CustomerInfo {
  id: number
  name: string
  phone: string
  points: number
  creditLimit: number
  creditUsed: number
}

interface Sale {
  id: number
  total: number
  discount: number
  paymentMethod: string
  pointsEarned: number
  createdAt: string
  customer: { name: string; phone: string; points: number } | null
  items: SaleItem[]
}

function printSaleReceipt(sale: Sale) {
  const itemsHtml = sale.items
    .map(i => `<tr><td>${i.product.name} × ${i.quantity}</td><td class="right">${(i.price * i.quantity).toLocaleString()}</td></tr>`)
    .join('')
  const html = `
    <div class="center bold large">RECEIPT #${String(sale.id).padStart(6, '0')}</div>
    <div class="center small muted">${new Date(sale.createdAt).toLocaleString('en-NP')}</div>
    ${sale.customer ? `<div class="center small">${sale.customer.name} (${sale.customer.phone})</div>` : ''}
    <div class="divider"></div>
    <table>
      <thead><tr><th>Item</th><th class="right">Amt</th></tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div class="divider"></div>
    ${sale.discount > 0 ? `<div class="row"><span>Discount</span><span>-NPR ${sale.discount.toLocaleString()}</span></div>` : ''}
    <div class="row-bold large"><span>TOTAL</span><span>NPR ${sale.total.toLocaleString()}</span></div>
    <div class="row small"><span>Payment</span><span style="text-transform:capitalize">${sale.paymentMethod}</span></div>
    <div class="divider"></div>
    <div class="center small muted">Thank you!</div>
  `
  printReceiptHtml(html)
}

export default function POSPage() {
  const { token, selectedOutlet } = useAuth()
  const isCafe = selectedOutlet?.code === 'CAF' || selectedOutlet?.type?.code === 'CAFE' || selectedOutlet?.name?.toLowerCase().includes('cafe')

  const [terminalId, setTerminalId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'pos' | 'history'>('pos')

  // POS state
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    if (selectedOutlet?.terminals && selectedOutlet.terminals.length > 0) {
      setTerminalId(selectedOutlet.terminals[0].id)
    } else {
      setTerminalId(null)
    }
  }, [selectedOutlet])
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [discount, setDiscount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [loading, setLoading] = useState(false)
  const [lastReceipt, setLastReceipt] = useState<Sale | null>(null)

  // Customer state
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null)
  const [customerLookupState, setCustomerLookupState] = useState<'idle' | 'found' | 'new'>('idle')
  const lookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sales history state
  const [sales, setSales] = useState<Sale[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historySearch, setHistorySearch] = useState('')
  const [historySort, setHistorySort] = useState<'desc' | 'asc'>('desc')
  const HISTORY_LIMIT = 15

  const fetchProducts = useCallback(async () => {
    if (!token) return
    const data = await apiFetch('/api/products?type=finished', {}, token)
    setProducts(data as Product[])
  }, [token])

  const fetchSalesHistory = useCallback(async (page = 1, search = '', sortOrder = historySort) => {
    if (!token) return
    setHistoryLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(HISTORY_LIMIT),
        sortOrder,
      })
      if (search.trim()) params.set('search', search.trim())
      const data = await apiFetch(`/api/sales?${params.toString()}`, {}, token)
      const list = Array.isArray(data) ? data : ((data && typeof data === 'object' && Array.isArray((data as any).sales)) ? (data as any).sales : [])
      setSales(list)
      setHistoryTotal((data as any)?.total ?? list.length)
      setHistoryPage(page)
    } catch (e) {
      console.error(e)
      setSales([])
    } finally {
      setHistoryLoading(false)
    }
  }, [token, historySort])

  useEffect(() => { fetchProducts() }, [fetchProducts, selectedOutlet?.id])

  useEffect(() => {
    if (activeTab === 'history') fetchSalesHistory(1)
  }, [activeTab, fetchSalesHistory, selectedOutlet?.id])

  // Customer phone lookup with debounce
  useEffect(() => {
    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current)

    if (!customerPhone || customerPhone.length < 7) {
      setCustomerInfo(null)
      setCustomerLookupState('idle')
      return
    }

    lookupTimerRef.current = setTimeout(async () => {
      if (!token) return
      try {
        const res = await apiFetch(`/api/customers/lookup?phone=${encodeURIComponent(customerPhone)}`, {}, token)
        const cust = res as CustomerInfo | null
        if (cust) {
          setCustomerInfo(cust)
          setCustomerName(cust.name)
          setCustomerLookupState('found')
        } else {
          setCustomerInfo(null)
          setCustomerLookupState('new')
        }
      } catch {
        setCustomerInfo(null)
        setCustomerLookupState('idle')
      }
    }, 400)

    return () => {
      if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current)
    }
  }, [customerPhone, token])

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id)
      if (existing) {
        return prev.map(i =>
          i.id === product.id
            ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.price }
            : i
        )
      }
      return [...prev, { ...product, quantity: 1, subtotal: product.price }]
    })
  }

  const updateQuantity = (id: number, delta: number) => {
    setCart(prev =>
      prev
        .map(i => {
          if (i.id === id) {
            const newQty = i.quantity + delta
            return newQty > 0 ? { ...i, quantity: newQty, subtotal: newQty * i.price } : null
          }
          return i
        })
        .filter(Boolean) as CartItem[]
    )
  }

  const subtotal = cart.reduce((s, i) => s + i.subtotal, 0)
  const grandTotal = Math.max(0, subtotal - discount)

  const handleCheckout = async () => {
    if (cart.length === 0) return
    setLoading(true)
    try {
      const res = await apiFetch('/api/sales', {
        method: 'POST',
        body: JSON.stringify({
          items: cart.map(i => ({ productId: i.id, quantity: i.quantity, price: i.price })),
          discount,
          paymentMethod,
          customerPhone: customerPhone || undefined,
          customerName: customerName || undefined,
          terminalId: terminalId || undefined,
        }),
      }, token)
      const completedSale = res as Sale
      setLastReceipt(completedSale)
      printSaleReceipt(completedSale)
      setCart([])
      setDiscount(0)
      setCustomerPhone('')
      setCustomerName('')
      setCustomerInfo(null)
      setCustomerLookupState('idle')
      toast.success('Sale completed!')
      fetchProducts()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Checkout failed')
    } finally {
      setLoading(false)
    }
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Layout>
      {/* Tab bar */}
      <div className="flex gap-2 mb-4 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('pos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === 'pos'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <FiShoppingBag size={15} /> {isCafe ? 'Cafe Counter' : 'Point of Sale'}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === 'history'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <FiClock size={15} /> Sales History
        </button>
      </div>

      {/* ── POS TAB ── */}
      {activeTab === 'pos' && (
        <div className="flex flex-col lg:flex-row gap-6 h-full">
          {/* Products panel */}
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{isCafe ? 'Cafe POS & Counter' : 'Point of Sale'}</h1>
                <p className="text-xs text-gray-500">
                  {selectedOutlet ? (
                    <>Outlet: <span className="font-semibold text-blue-600">{selectedOutlet.name}</span> · Terminal: <span className="font-semibold text-gray-700">{selectedOutlet.terminals?.find(t => t.id === terminalId)?.name || 'Main Counter'}</span></>
                  ) : ''}
                </p>
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input pl-10"
              />
            </div>

            {/* Product grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map(product => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-blue-400 hover:shadow-md transition-all"
                >
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                    <span className="text-blue-600 font-bold text-sm">{product.name.charAt(0)}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-800 line-clamp-2">{product.name}</p>
                  <p className="text-blue-600 font-bold mt-1">NPR {product.price}</p>
                  <p className="text-xs text-gray-400">Stock: {product.stock} {product.unit}</p>
                </button>
              ))}
            </div>
            {filtered.length === 0 && (
              <p className="text-center py-8 text-gray-400">No products available in this outlet</p>
            )}
          </div>

          {/* Cart panel */}
          <div className="w-full lg:w-96 bg-white rounded-xl border border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Cart ({cart.length} items)</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[160px] max-h-72">
              {cart.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-2 py-1 border-b border-gray-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">NPR {item.price} each</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-7 h-7 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100"
                    >
                      <FiMinus size={12} />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-7 h-7 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100"
                    >
                      <FiPlus size={12} />
                    </button>
                    <button
                      onClick={() => setCart(cart.filter(i => i.id !== item.id))}
                      className="w-7 h-7 rounded-lg text-red-400 hover:text-red-600 flex items-center justify-center ml-1"
                    >
                      <FiTrash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
              {cart.length === 0 && (
                <p className="text-center text-gray-400 py-8 text-sm">Cart is empty</p>
              )}
            </div>

            {/* Customer loyalty block */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/50 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <FiUser size={12} /> Customer Loyalty
              </p>
              <div className="relative">
                <FiPhone className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                <input
                  type="text"
                  placeholder="Customer mobile number..."
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  className="input pl-8 text-xs py-1.5"
                />
              </div>

              {customerLookupState === 'found' && customerInfo && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-green-800 flex items-center gap-1">
                      <FiCheckCircle size={12} /> {customerInfo.name}
                    </span>
                    <span className="text-gray-500">Points balance: </span>
                    <span className="font-bold text-green-700">{customerInfo.points} pts</span>
                  </div>
                  <span className="text-gray-400 text-[10px]">Will earn +{Math.floor(grandTotal / 100)} pts</span>
                </div>
              )}

              {customerLookupState === 'new' && (
                <div className="space-y-1.5">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs flex items-center gap-1.5 text-blue-700">
                    <FiAlertCircle size={13} className="shrink-0" />
                    <span>New customer! Enter name to register:</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Customer Name *"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="input text-xs py-1.5"
                  />
                </div>
              )}
            </div>

            {/* Checkout block */}
            <div className="p-4 border-t border-gray-200 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium">NPR {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-gray-500">Discount (NPR)</span>
                <input
                  type="number"
                  min="0"
                  max={subtotal}
                  value={discount || ''}
                  onChange={e => setDiscount(Math.min(subtotal, Math.max(0, Number(e.target.value))))}
                  className="input w-24 text-right text-xs py-1"
                  placeholder="0"
                />
              </div>
              <div className="flex justify-between text-base font-bold border-t border-gray-100 pt-2">
                <span>Grand Total</span>
                <span className="text-blue-600">NPR {grandTotal.toLocaleString()}</span>
              </div>

              <div>
                <label className="label text-xs">Payment Method</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {['cash', 'qr', 'card'].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`py-1.5 text-xs font-semibold rounded-lg border capitalize transition-colors ${
                        paymentMethod === m
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={loading || cart.length === 0}
                className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 font-bold disabled:opacity-50"
              >
                {loading ? 'Processing...' : (
                  <>
                    <FiCheck size={16} /> Complete Sale (NPR {grandTotal.toLocaleString()})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SALES HISTORY TAB ── */}
      {activeTab === 'history' && (
        <div className="card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-gray-900">Recent Sales History ({selectedOutlet?.name || 'All Outlets'})</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <FiSearch className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') fetchSalesHistory(1, historySearch, historySort)
                  }}
                  placeholder="Receipt #, customer, item..."
                  className="input pl-8 py-1.5 text-xs w-48"
                />
              </div>
              <select
                value={historySort}
                onChange={e => {
                  const nextSort = e.target.value as 'asc' | 'desc'
                  setHistorySort(nextSort)
                  fetchSalesHistory(1, historySearch, nextSort)
                }}
                className="input py-1.5 text-xs w-auto"
              >
                <option value="desc">Newest First (DESC)</option>
                <option value="asc">Oldest First (ASC)</option>
              </select>
              <button
                onClick={() => fetchSalesHistory(1, historySearch, historySort)}
                className="btn-secondary text-xs"
              >
                Search / Refresh
              </button>
            </div>
          </div>

          {historyLoading ? (
            <div className="text-center py-12 text-gray-400">Loading sales...</div>
          ) : sales.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No sales recorded yet for this outlet</div>
          ) : (
            <>
              <div className="divide-y divide-gray-100">
                {sales.map(sale => (
                  <div key={sale.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800 text-sm">Receipt #{String(sale.id).padStart(6, '0')}</span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">
                          {sale.paymentMethod}
                        </span>
                        {sale.customer && (
                          <span className="text-xs text-blue-600 font-medium">
                            · {sale.customer.name} ({sale.customer.phone})
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(sale.createdAt).toLocaleDateString('en-NP', {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {sale.items.map(i => `${i.product.name} × ${i.quantity}`).join(', ')}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-base font-bold text-gray-900">NPR {sale.total.toLocaleString()}</p>
                        {sale.discount > 0 && (
                          <p className="text-xs text-gray-400">-NPR {sale.discount.toLocaleString()} disc.</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => printSaleReceipt(sale)}
                        className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Print Receipt"
                      >
                        <FiPrinter className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {historyTotal > HISTORY_LIMIT && (
                <div className="flex items-center justify-center gap-3 mt-6">
                  <button
                    onClick={() => fetchSalesHistory(historyPage - 1)}
                    disabled={historyPage === 1}
                    className="btn-secondary text-sm disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {historyPage} of {Math.ceil(historyTotal / HISTORY_LIMIT)}
                  </span>
                  <button
                    onClick={() => fetchSalesHistory(historyPage + 1)}
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
    </Layout>
  )
}
