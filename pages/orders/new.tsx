import { useEffect, useState, useCallback, useRef } from 'react'
import Layout from '@/components/Layout'
import { useAuth, apiFetch } from '@/lib/AuthContext'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'
import { FiPlus, FiTrash2, FiUser, FiStar } from 'react-icons/fi'

interface Product { id: number; name: string; price: number }
interface FoundCustomer { id: number; name: string; phone: string; points: number; type: string }

interface OrderItem {
  productId?: number
  name: string
  quantity: number
  price: number
}

export default function NewOrderPage() {
  const { token, selectedOutlet } = useAuth()
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [form, setForm] = useState({
    customerName: '', customerPhone: '', deliveryDate: '', note: '', advancePaid: '0',
  })
  const [items, setItems] = useState<OrderItem[]>([
    { name: '', quantity: 1, price: 0 },
  ])
  const [loading, setLoading] = useState(false)
  const [foundCustomer, setFoundCustomer] = useState<FoundCustomer | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchProducts = useCallback(async () => {
    if (!token) return
    const data = await apiFetch('/api/products?type=finished', {}, token)
    setProducts(data as Product[])
  }, [token])

  useEffect(() => { fetchProducts() }, [fetchProducts, selectedOutlet?.id])

  // Debounced phone lookup
  const handlePhoneChange = (phone: string) => {
    setForm(f => ({ ...f, customerPhone: phone }))
    setFoundCustomer(null)
    if (lookupTimer.current) clearTimeout(lookupTimer.current)
    if (phone.length >= 7) {
      setLookingUp(true)
      lookupTimer.current = setTimeout(async () => {
        try {
          const data = await apiFetch(`/api/customers/lookup?phone=${encodeURIComponent(phone)}`, {}, token)
          const customer = data as FoundCustomer | null
          if (!customer) throw new Error('not found')
          setFoundCustomer(customer)
          setForm(f => ({ ...f, customerName: customer.name }))
        } catch {
          setFoundCustomer(null)
        } finally { setLookingUp(false) }
      }, 500)
    } else {
      setLookingUp(false)
    }
  }

  const addItem = () => setItems(prev => [...prev, { name: '', quantity: 1, price: 0 }])
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))

  const updateItem = (i: number, field: keyof OrderItem, value: string | number) => {
    setItems(prev => {
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

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const advance = Number(form.advancePaid) || 0
  const balance = total - advance

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.customerName) { toast.error('Customer name required'); return }
    if (items.some(i => !i.name || i.quantity <= 0 || i.price < 0)) {
      toast.error('Please fill all item details'); return
    }
    setLoading(true)
    try {
      await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          items,
          customerId: foundCustomer?.id ?? null,
        }),
      }, token)
      toast.success('Order created!')
      router.push('/orders')
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed') }
    finally { setLoading(false) }
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Order</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Info */}
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Customer Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Phone Number</label>
                <input
                  className="input"
                  value={form.customerPhone}
                  onChange={e => handlePhoneChange(e.target.value)}
                  placeholder="+977 98..."
                />
                {lookingUp && (
                  <p className="text-xs text-gray-400 mt-1">Looking up customer...</p>
                )}
                {!lookingUp && foundCustomer && (
                  <div className="mt-2 p-2.5 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                    <FiUser size={14} className="text-green-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-800">{foundCustomer.name}</p>
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <FiStar size={11} className="fill-amber-400 text-amber-400" />
                        {foundCustomer.points} pts
                        <span className={`ml-1 px-1.5 rounded-full capitalize ${
                          foundCustomer.type === 'vip' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'
                        }`}>{foundCustomer.type}</span>
                      </p>
                    </div>
                  </div>
                )}
                {!lookingUp && !foundCustomer && form.customerPhone.length >= 7 && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-700">New customer — enter name below</p>
                  </div>
                )}
              </div>
              <div>
                <label className="label">Customer Name *</label>
                <input
                  className="input" required
                  value={form.customerName}
                  onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="label">Delivery Date</label>
                <input
                  type="date" className="input"
                  value={form.deliveryDate}
                  onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <label className="label">Note</label>
                <input
                  className="input"
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="Special instructions..."
                />
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Order Items</h2>
              <button type="button" onClick={addItem} className="btn-secondary flex items-center gap-1 text-sm py-1.5">
                <FiPlus size={14} /> Add Item
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    {idx === 0 && <label className="label text-xs">Product / Description</label>}
                    <select
                      className="input text-sm"
                      value={item.productId || ''}
                      onChange={e => updateItem(idx, 'productId', Number(e.target.value))}
                    >
                      <option value="">Custom item...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    {!item.productId && (
                      <input
                        className="input text-sm mt-1"
                        placeholder="Item name"
                        value={item.name}
                        onChange={e => updateItem(idx, 'name', e.target.value)}
                      />
                    )}
                  </div>
                  <div className="col-span-2">
                    {idx === 0 && <label className="label text-xs">Qty</label>}
                    <input
                      type="number" min="1" className="input text-sm"
                      value={item.quantity}
                      onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                    />
                  </div>
                  <div className="col-span-3">
                    {idx === 0 && <label className="label text-xs">Unit Price (NPR)</label>}
                    <input
                      type="number" min="0" className="input text-sm"
                      value={item.price}
                      onChange={e => updateItem(idx, 'price', Number(e.target.value))}
                    />
                  </div>
                  <div className="col-span-1">
                    {idx === 0 && <div className="h-5" />}
                    <p className="text-sm font-semibold text-gray-700 py-2 text-center">
                      {(item.price * item.quantity).toLocaleString()}
                    </p>
                  </div>
                  <div className="col-span-1">
                    {idx === 0 && <div className="h-5" />}
                    <button type="button" onClick={() => removeItem(idx)} disabled={items.length === 1}
                      className="text-red-400 hover:text-red-600 disabled:opacity-30 py-2">
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-lg font-bold text-gray-900">
                <span>Order Total</span>
                <span>NPR {total.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-4">
                <label className="label mb-0">Advance Payment (NPR)</label>
                <input
                  type="number" min="0" max={total}
                  className="input w-40 text-right"
                  value={form.advancePaid}
                  onChange={e => setForm(f => ({ ...f, advancePaid: e.target.value }))}
                />
              </div>
              <div className={`flex justify-between text-sm font-medium ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                <span>Balance Due</span>
                <span>NPR {balance.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="btn-primary flex-1 py-3 text-base disabled:opacity-50">
              {loading ? 'Creating...' : 'Create Order'}
            </button>
            <button type="button" onClick={() => router.back()} className="btn-secondary px-6">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </Layout>
  )
}
