import { useEffect, useState, useCallback } from 'react'
import Layout from '@/components/Layout'
import { useAuth, apiFetch } from '@/lib/AuthContext'
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
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [updateData, setUpdateData] = useState({ status: '', advancePaid: '' })

  const fetchOrders = useCallback(async () => {
    if (!token) return
    const params = new URLSearchParams({ page: page.toString(), limit: '15' })
    if (statusFilter) params.set('status', statusFilter)
    if (search) params.set('search', search)
    try {
      const data = await apiFetch('/api/orders?' + params, {}, token)
      const list = Array.isArray(data) ? data : ((data && typeof data === 'object' && Array.isArray((data as any).orders)) ? (data as any).orders : [])
      setOrders(list)
      setTotal((data as any)?.total ?? list.length)
    } catch (e) {
      console.error(e)
      setOrders([])
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
            <Link href="/orders/new" className="btn-primary flex items-center gap-2">
              <FiPlus /> New Order
            </Link>
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
            {orders.length === 0 && <p className="text-center py-8 text-gray-400">No orders found</p>}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
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
    </Layout>
  )
}
