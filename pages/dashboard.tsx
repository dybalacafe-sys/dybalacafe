import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import { useAuth, apiFetch } from '@/lib/AuthContext'
import Link from 'next/link'
import {
  FiShoppingCart, FiPackage, FiAlertTriangle, FiBox,
  FiTrendingUp, FiClock, FiGrid, FiTruck, FiUser
} from 'react-icons/fi'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  color: string
}

function StatCard({ title, value, subtitle, icon, color }: StatCardProps) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

interface LowStockProduct {
  id: number
  name: string
  stock: number
  minStock: number
  unit: string
}

interface RecentOrder {
  id: number
  orderNumber: string
  customerName: string
  totalAmount: number
  status: string
  deliveryDate: string
}

interface RecentSale {
  id: number
  total: number
  createdAt: string
  items: Array<{ product: { name: string }; quantity: number }>
  user: { name: string }
}

interface DashboardData {
  todaySales: { total: number; count: number }
  pendingOrders: number
  lowStockCount: number
  totalProducts: number
  lowStockProducts: LowStockProduct[]
  recentOrders: RecentOrder[]
  recentSales: RecentSale[]
}

export default function DashboardPage() {
  const { token, can, selectedOutlet } = useAuth()
  const isCafe = selectedOutlet?.code === 'CAF' || selectedOutlet?.type?.code === 'CAFE' || selectedOutlet?.name?.toLowerCase().includes('cafe')

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    apiFetch('/api/dashboard', {}, token)
      .then((d) => setData(d as DashboardData))
      .catch((err) => console.error('Dashboard fetch error:', err))
      .finally(() => setLoading(false))
  }, [token, selectedOutlet?.id])

  if (loading || !data) return (
    <Layout>
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    </Layout>
  )

  const lowStockList = data.lowStockProducts || []
  const recentOrdersList = data.recentOrders || []
  const recentSalesList = data.recentSales || []

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isCafe ? 'Dybala Cafe Dashboard' : 'Dashboard'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {new Date().toLocaleDateString('en-NP', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            {selectedOutlet && <> · <span className="font-semibold text-blue-600">{selectedOutlet.name}</span></>}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Today's Sales"
            value={`NPR ${(data.todaySales?.total || 0).toLocaleString()}`}
            subtitle={`${data.todaySales?.count || 0} transactions`}
            icon={<FiShoppingCart />}
            color="bg-blue-600"
          />
          <StatCard
            title={isCafe ? "Active Tables / Orders" : "Pending Orders"}
            value={data.pendingOrders || 0}
            subtitle={isCafe ? "In-progress dine-in" : "Awaiting completion"}
            icon={<FiPackage />}
            color="bg-orange-500"
          />
          <StatCard
            title="Low Stock Items"
            value={data.lowStockCount || 0}
            subtitle="Need restocking"
            icon={<FiAlertTriangle />}
            color="bg-red-500"
          />
          <StatCard
            title="Total Products"
            value={data.totalProducts || 0}
            subtitle="Active in this outlet"
            icon={<FiBox />}
            color="bg-green-600"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Low Stock Alerts */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">⚠️ Low Stock Alerts</h2>
              <Link href="/inventory" className="text-sm text-blue-600 hover:underline">View All</Link>
            </div>
            {lowStockList.length === 0 ? (
              <p className="text-gray-400 text-sm">All items are well-stocked ✓</p>
            ) : (
              <div className="space-y-2">
                {lowStockList.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm font-medium text-gray-800">{p.name}</span>
                    <span className="text-xs text-red-600 font-semibold bg-red-50 px-2.5 py-1 rounded-full">
                      {p.stock} {p.unit} left
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending / Active Orders */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {isCafe ? '🍽️ Dine-in Sessions' : '📦 Pending Orders'}
              </h2>
              <Link href={isCafe ? "/table-orders" : "/orders"} className="text-sm text-blue-600 hover:underline">View All</Link>
            </div>
            {recentOrdersList.length === 0 ? (
              <p className="text-gray-400 text-sm">No pending orders</p>
            ) : (
              <div className="space-y-2">
                {recentOrdersList.map((order) => (
                  <div key={order.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{order.customerName}</p>
                      <p className="text-xs text-gray-400">{order.orderNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">NPR {order.totalAmount.toLocaleString()}</p>
                      <span className="text-xs text-gray-400">
                        {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('en-NP') : '-'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Sales */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">🧾 Recent Sales</h2>
            <Link href={isCafe ? "/table-orders" : "/reports"} className="text-sm text-blue-600 hover:underline">
              {isCafe ? 'View Tables' : 'View Reports'}
            </Link>
          </div>
          {recentSalesList.length === 0 ? (
            <p className="text-gray-400 text-sm">No sales today</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 text-gray-500 font-medium">Time</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Items</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Staff</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSalesList.map((sale) => (
                    <tr key={sale.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 text-gray-500">
                        {new Date(sale.createdAt).toLocaleTimeString('en-NP', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2 text-gray-700">
                        {(sale.items || []).map(i => `${i.product?.name || 'Item'} x${i.quantity}`).join(', ').substring(0, 40)}...
                      </td>
                      <td className="py-2 text-gray-500">{sale.user?.name || 'Staff'}</td>
                      <td className="py-2 text-right font-semibold">NPR {sale.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">⚡ Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {isCafe ? (
              <>
                <Link href="/table-orders" className="btn-primary text-center py-3 font-semibold flex items-center justify-center gap-2">
                  <FiGrid /> Tables & Dine-in
                </Link>
                <Link href="/expenses" className="btn-secondary text-center py-3 font-semibold flex items-center justify-center gap-2">
                  <FiTruck /> Vendor & Expenses
                </Link>
                <Link href="/inventory" className="btn-secondary text-center py-3 font-semibold flex items-center justify-center gap-2">
                  <FiBox /> Stock Update
                </Link>
                <Link href="/customers" className="btn-secondary text-center py-3 font-semibold flex items-center justify-center gap-2">
                  <FiUser /> Customer Khata
                </Link>
              </>
            ) : (
              <>
                {can('pos', 'edit') && <Link href="/pos" className="btn-primary text-center py-3">New Sale</Link>}
                {can('orders', 'edit') && <Link href="/orders/new" className="btn-success text-center py-3">New Order</Link>}
                {can('inventory', 'edit') && <Link href="/inventory" className="btn-secondary text-center py-3">Stock Update</Link>}
                {can('reports', 'view') && <Link href="/reports" className="btn-secondary text-center py-3">Analytics</Link>}
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
