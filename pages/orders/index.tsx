import { useEffect, useState, useCallback } from 'react'
import Layout from '@/components/Layout'
import { useAuth, apiFetch } from '@/lib/AuthContext'
import { TableSkeleton } from '@/components/Skeleton'
import Link from 'next/link'
import { FiPlus, FiSearch, FiEdit2, FiEye } from 'react-icons/fi'
import toast from 'react-hot-toast'

interface Order {
  id: number; orderNumber: string; customerName: string; customerPhone?: string;
  status: string; paymentStatus: string; totalAmount: number; advancePaid: number;
  balanceDue: number; deliveryDate?: string; createdAt: string;
  user: { name: string }; items: Array<{ name: string; quantity: number; price: number }>
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'badge-pending', IN_PROGRESS: 'badge-in_progress',
  COMPLETED: 'badge-completed', CANCELLED: 'badge-cancelled',
}

export default function OrdersPage() {
  const { token, can, selectedOutlet } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [updateData, setUpdateData] = useState({ status: '', advancePaid: '' })
  const [showNewModal, setShowNewModal] = useState(false)
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [newOrderForm, setNewOrderForm] = useState({
    customerName: '',
    customerPhone: '',
    deliveryDate: '',
    advancePaid: '0',
    note: '',
  })
  const [newOrderItems, setNewOrderItems] = useState([{ name: '', quantity: '1', price: '0' }])

  const fetchOrders = useCallback(async () => {
    if (!token) return
    const params = new URLSearchParams({ page: page.toString(), limit: '15' })
    if (statusFilter) params.set('status', statusFilter)
    if (search) params.set('search', search)
    setLoading(true)
    try {
      const data = await apiFetch('/api/orders?' + params, {}, token)
      const list = Array.isArray(data) ? data : ((data && typeof data === 'object' && Array.isArray((data as any).orders)) ? (data as any).orders : [])
      setOrders(list)
      setTotal((data as any)?.total ?? list.length)
    } catch (e) {
      console.error(e)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [token, statusFilter, search, page, selectedOutlet?.id])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const openUpdate = (order: Order) => {
    setSelectedOrder(order)
    setUpdateData({ status: order.status, advancePaid: order.advancePaid.toString() })
    setShowUpdateModal(true)
  }

  const handleUpdate = async () => {
    if (!selectedOrder) return
    try {
      await apiFetch(`/api/orders/${selectedOrder.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: updateData.status, advancePaid: Number(updateData.advancePaid) }),
      }, token)
      toast.success('Order updated')
      setShowUpdateModal(false)
      fetchOrders()
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed') }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          {can('orders', 'edit') && (
            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <FiPlus /> New Order
            </button>
          )}
        </div>

        <div className="card">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input placeholder="Search by customer..." value={search} onChange={e => setSearch(e.target.value)} className="input pl-10" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input w-auto">
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Order #', 'Customer', 'Items', 'Total', 'Advance', 'Balance', 'Status', 'Delivery', 'Actions'].map(h => (
                    <th key={h} className="text-left px-3 py-3 text-gray-600 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(orders || []).map(order => (
                  <tr key={order.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-3 font-mono text-xs text-gray-600">{order.orderNumber}</td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-gray-800">{order.customerName}</p>
                      {order.customerPhone && <p className="text-xs text-gray-400">{order.customerPhone}</p>}
                    </td>
                    <td className="px-3 py-3 text-gray-500">{order.items.length} item(s)</td>
                    <td className="px-3 py-3 font-semibold">NPR {order.totalAmount.toLocaleString()}</td>
                    <td className="px-3 py-3 text-green-600">NPR {order.advancePaid.toLocaleString()}</td>
                    <td className={`px-3 py-3 font-semibold ${order.balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      NPR {order.balanceDue.toLocaleString()}
                    </td>
                    <td className="px-3 py-3">
                      <span className={STATUS_COLORS[order.status] || 'badge-pending'}>
                        {order.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-gray-500">
                      {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        {can('orders', 'edit') && (
                          <button onClick={() => openUpdate(order)} className="text-blue-600 hover:text-blue-800">
                            <FiEdit2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {loading ? (
              <div className="p-4"><TableSkeleton rows={5} /></div>
            ) : orders.length === 0 && (
              <p className="text-center py-8 text-gray-400">No orders found</p>
            )}
          </div>

          {total > 15 && (
            <div className="flex justify-between items-center mt-4">
              <p className="text-sm text-gray-500">Showing {orders.length} of {total}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary py-1 px-3 text-sm disabled:opacity-50">Prev</button>
                <button onClick={() => setPage(p => p + 1)} disabled={orders.length < 15} className="btn-secondary py-1 px-3 text-sm disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showUpdateModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold">Update Order: {selectedOrder.orderNumber}</h2>
            <p className="text-sm text-gray-600">Customer: {selectedOrder.customerName}</p>
            <p className="text-sm text-gray-600">Total: NPR {selectedOrder.totalAmount.toLocaleString()}</p>
            <div>
              <label className="label">Status</label>
              <select className="input" value={updateData.status} onChange={e => setUpdateData(d => ({ ...d, status: e.target.value }))}>
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="label">Advance Paid (NPR)</label>
              <input type="number" className="input" value={updateData.advancePaid}
                onChange={e => setUpdateData(d => ({ ...d, advancePaid: e.target.value }))} />
            </div>
            <div className="flex gap-3">
              <button onClick={handleUpdate} className="btn-primary flex-1">Update</button>
              <button onClick={() => setShowUpdateModal(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900">New Order</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  value={newOrderForm.customerName}
                  onChange={e => setNewOrderForm({ ...newOrderForm, customerName: e.target.value })}
                  className="input"
                  placeholder="Customer name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={newOrderForm.customerPhone}
                  onChange={e => setNewOrderForm({ ...newOrderForm, customerPhone: e.target.value })}
                  className="input"
                  placeholder="Phone number"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Delivery Date</label>
                <input
                  type="date"
                  value={newOrderForm.deliveryDate}
                  onChange={e => setNewOrderForm({ ...newOrderForm, deliveryDate: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Advance Paid (NPR)</label>
                <input
                  type="number"
                  min="0"
                  value={newOrderForm.advancePaid}
                  onChange={e => setNewOrderForm({ ...newOrderForm, advancePaid: e.target.value })}
                  className="input"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-700">Order Items *</label>
                <button
                  type="button"
                  onClick={() => setNewOrderItems([...newOrderItems, { name: '', quantity: '1', price: '0' }])}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  + Add Item
                </button>
              </div>
              <div className="space-y-2">
                {newOrderItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      type="text"
                      value={item.name}
                      onChange={e => {
                        const next = [...newOrderItems]
                        next[idx].name = e.target.value
                        setNewOrderItems(next)
                      }}
                      placeholder="Item name"
                      className="input col-span-6 text-xs"
                    />
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={e => {
                        const next = [...newOrderItems]
                        next[idx].quantity = e.target.value
                        setNewOrderItems(next)
                      }}
                      placeholder="Qty"
                      className="input col-span-2 text-xs"
                    />
                    <input
                      type="number"
                      min="0"
                      value={item.price}
                      onChange={e => {
                        const next = [...newOrderItems]
                        next[idx].price = e.target.value
                        setNewOrderItems(next)
                      }}
                      placeholder="Price"
                      className="input col-span-3 text-xs"
                    />
                    {newOrderItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setNewOrderItems(newOrderItems.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:text-red-700 text-xs col-span-1"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Note</label>
              <input
                type="text"
                value={newOrderForm.note}
                onChange={e => setNewOrderForm({ ...newOrderForm, note: e.target.value })}
                className="input"
                placeholder="Optional note"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowNewModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                disabled={creatingOrder}
                onClick={async () => {
                  const validItems = newOrderItems
                    .filter(i => i.name.trim())
                    .map(i => ({ name: i.name.trim(), quantity: Number(i.quantity) || 1, price: Number(i.price) || 0 }))
                  if (!newOrderForm.customerName.trim() || validItems.length === 0) {
                    toast.error('Customer name and at least one item are required')
                    return
                  }
                  setCreatingOrder(true)
                  try {
                    await apiFetch('/api/orders', {
                      method: 'POST',
                      body: JSON.stringify({
                        customerName: newOrderForm.customerName.trim(),
                        customerPhone: newOrderForm.customerPhone.trim() || undefined,
                        deliveryDate: newOrderForm.deliveryDate || undefined,
                        advancePaid: Number(newOrderForm.advancePaid) || 0,
                        note: newOrderForm.note.trim() || undefined,
                        items: validItems,
                      }),
                    }, token)
                    toast.success('Order created!')
                    setShowNewModal(false)
                    setNewOrderForm({ customerName: '', customerPhone: '', deliveryDate: '', advancePaid: '0', note: '' })
                    setNewOrderItems([{ name: '', quantity: '1', price: '0' }])
                    fetchOrders()
                  } catch (err: unknown) {
                    toast.error(err instanceof Error ? err.message : 'Failed to create order')
                  } finally {
                    setCreatingOrder(false)
                  }
                }}
                className="btn-primary"
              >
                {creatingOrder ? 'Creating...' : 'Create Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
