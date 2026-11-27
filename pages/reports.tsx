import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Layout from '@/components/Layout'
import { useAuth, apiFetch } from '@/lib/AuthContext'
import { Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  ArcElement,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement)

export default function ReportsPage() {
  const { token, can, selectedOutlet } = useAuth()
  const [tab, setTab] = useState<'sales' | 'stock' | 'orders' | 'product-sales'>('sales')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))
  const { data: reportResult, isFetching: loading, refetch } = useQuery<{
    report: unknown
    chart: Array<{ date: string; total: number }>
  }>({
    queryKey: ['reports', selectedOutlet?.id, tab, startDate, endDate],
    queryFn: async () => {
      const [report, chart] = await Promise.all([
        apiFetch(`/api/reports?type=${tab}&startDate=${startDate}T00:00:00&endDate=${endDate}T23:59:59`, {}, token!),
        tab === 'sales' ? apiFetch('/api/reports?type=daily-chart', {}, token!) : Promise.resolve([]),
      ])
      return {
        report,
        chart: tab === 'sales' ? (chart as Array<{ date: string; total: number }>) : [],
      }
    },
    enabled: !!token,
  })

  const data = reportResult?.report ?? null
  const chartData = reportResult?.chart ?? []

  const tabs = [
    { key: 'sales', label: '📊 Sales Report' },
    { key: 'stock', label: '📦 Stock Report' },
    { key: 'orders', label: '📋 Orders Report' },
    { key: 'product-sales', label: '🏆 Top Products' },
  ]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const salesData = data as any

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as typeof tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Date Range */}
        <div className="card flex flex-wrap gap-4 items-end">
          <div>
            <label className="label text-xs">Start Date</label>
            <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="label text-xs">End Date</label>
            <input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <button onClick={() => refetch()} className="btn-primary">Apply</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {/* Sales Report */}
            {tab === 'sales' && salesData && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Total Revenue', value: `NPR ${(salesData.totalRevenue || 0).toLocaleString()}`, color: 'text-blue-600' },
                    { label: 'Total Cost', value: `NPR ${(salesData.totalCost || 0).toLocaleString()}`, color: 'text-red-600' },
                    { label: 'Gross Profit', value: `NPR ${(salesData.totalProfit || 0).toLocaleString()}`, color: 'text-green-600' },
                  ].map(stat => (
                    <div key={stat.label} className="card text-center">
                      <p className="text-sm text-gray-500">{stat.label}</p>
                      <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                {chartData.length > 0 && (
                  <div className="card">
                    <h2 className="text-lg font-semibold mb-4">Daily Sales (Last 30 Days)</h2>
                    <Bar
                      data={{
                        labels: chartData.map(d => new Date(d.date).toLocaleDateString('en-NP', { month: 'short', day: 'numeric' })),
                        datasets: [{
                          label: 'Revenue (NPR)',
                          data: chartData.map(d => d.total),
                          backgroundColor: 'rgba(59, 130, 246, 0.7)',
                          borderRadius: 4,
                        }],
                      }}
                      options={{ responsive: true, plugins: { legend: { display: false } } }}
                    />
                  </div>
                )}

                <div className="card">
                  <h2 className="text-lg font-semibold mb-4">Sales Transactions</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2 text-gray-600">Date/Time</th>
                          <th className="text-left px-3 py-2 text-gray-600">Items</th>
                          <th className="text-left px-3 py-2 text-gray-600">Payment</th>
                          <th className="text-right px-3 py-2 text-gray-600">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesData.sales?.slice(0, 50).map((sale: { id: number; createdAt: string; items: Array<{ product: { name: string }; quantity: number }>; paymentMethod: string; total: number }) => (
                          <tr key={sale.id} className="border-t border-gray-100">
                            <td className="px-3 py-2 text-gray-500">
                              {new Date(sale.createdAt).toLocaleString('en-NP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-3 py-2 text-gray-700">
                              {sale.items.map((i: { product: { name: string }; quantity: number }) => `${i.product.name} x${i.quantity}`).join(', ').substring(0, 50)}
                            </td>
                            <td className="px-3 py-2 text-gray-500 capitalize">{sale.paymentMethod}</td>
                            <td className="px-3 py-2 text-right font-semibold">NPR {sale.total.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!salesData.sales?.length && <p className="text-center py-6 text-gray-400">No sales in this period</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Stock Report */}
            {tab === 'stock' && salesData && (
              <div className="space-y-4">
                <div className="card flex items-center justify-between">
                  <p className="text-gray-600">Total Inventory Value</p>
                  <p className="text-2xl font-bold text-blue-600">NPR {(salesData.totalValue || 0).toLocaleString()}</p>
                </div>
                <div className="card">
                  <h2 className="text-lg font-semibold mb-4">Stock Levels</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2 text-gray-600">Product</th>
                          <th className="text-left px-3 py-2 text-gray-600">Category</th>
                          <th className="text-left px-3 py-2 text-gray-600">Type</th>
                          <th className="text-right px-3 py-2 text-gray-600">Stock</th>
                          <th className="text-right px-3 py-2 text-gray-600">Cost Price</th>
                          <th className="text-right px-3 py-2 text-gray-600">Stock Value</th>
                          <th className="text-center px-3 py-2 text-gray-600">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesData.products?.map((p: { id: number; name: string; category?: { name: string }; type: string; stock: number; unit: string; costPrice: number; minStock: number }) => (
                          <tr key={p.id} className="border-t border-gray-100">
                            <td className="px-3 py-2 font-medium text-gray-800">{p.name}</td>
                            <td className="px-3 py-2 text-gray-500">{p.category?.name || '-'}</td>
                            <td className="px-3 py-2 text-gray-500 capitalize">{p.type}</td>
                            <td className="px-3 py-2 text-right">{p.stock} {p.unit}</td>
                            <td className="px-3 py-2 text-right">NPR {p.costPrice}</td>
                            <td className="px-3 py-2 text-right font-semibold">NPR {(p.stock * p.costPrice).toLocaleString()}</td>
                            <td className="px-3 py-2 text-center">
                              {p.stock <= p.minStock ? (
                                <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs">Low Stock</span>
                              ) : (
                                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs">OK</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Orders Report */}
            {tab === 'orders' && salesData && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Total Order Value', value: `NPR ${(salesData.totalAmount || 0).toLocaleString()}` },
                    { label: 'Amount Received', value: `NPR ${(salesData.totalPaid || 0).toLocaleString()}` },
                    { label: 'Outstanding Due', value: `NPR ${(salesData.totalDue || 0).toLocaleString()}` },
                  ].map(s => (
                    <div key={s.label} className="card text-center">
                      <p className="text-xs text-gray-500">{s.label}</p>
                      <p className="text-xl font-bold text-gray-900 mt-1">{s.value}</p>
                    </div>
                  ))}
                </div>
                <div className="card">
                  <h2 className="text-lg font-semibold mb-4">Orders List</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2">Order #</th>
                          <th className="text-left px-3 py-2">Customer</th>
                          <th className="text-left px-3 py-2">Status</th>
                          <th className="text-right px-3 py-2">Total</th>
                          <th className="text-right px-3 py-2">Paid</th>
                          <th className="text-right px-3 py-2">Due</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesData.orders?.map((o: { id: number; orderNumber: string; customerName: string; status: string; totalAmount: number; advancePaid: number; balanceDue: number }) => (
                          <tr key={o.id} className="border-t border-gray-100">
                            <td className="px-3 py-2 font-mono text-xs">{o.orderNumber}</td>
                            <td className="px-3 py-2">{o.customerName}</td>
                            <td className="px-3 py-2 capitalize">{o.status.replace('_', ' ')}</td>
                            <td className="px-3 py-2 text-right">NPR {o.totalAmount.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right text-green-600">NPR {o.advancePaid.toLocaleString()}</td>
                            <td className={`px-3 py-2 text-right ${o.balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              NPR {o.balanceDue.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Top Products */}
            {tab === 'product-sales' && Array.isArray(data) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {data.length > 0 && (
                  <div className="card">
                    <h2 className="text-lg font-semibold mb-4">Revenue by Product</h2>
                    <Doughnut
                      data={{
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        labels: (data as any[]).slice(0, 8).map((d: any) => d.name),
                        datasets: [{
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          data: (data as any[]).slice(0, 8).map((d: any) => d.quantity),
                          backgroundColor: [
                            '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
                            '#ec4899', '#06b6d4', '#84cc16',
                          ],
                        }],
                      }}
                    />
                  </div>
                )}
                <div className="card">
                  <h2 className="text-lg font-semibold mb-4">Best Sellers</h2>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2">#</th>
                        <th className="text-left px-3 py-2">Product</th>
                        <th className="text-right px-3 py-2">Qty Sold</th>
                        <th className="text-right px-3 py-2">Revenue</th>
                        <th className="text-right px-3 py-2">Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {(data as any[]).map((item: any, idx: number) => (
                        <tr key={item.name} className="border-t border-gray-100">
                          <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                          <td className="px-3 py-2 font-medium">{item.name}</td>
                          <td className="px-3 py-2 text-right">{item.quantity}</td>
                          <td className="px-3 py-2 text-right">NPR {item.revenue.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right text-green-600">NPR {(item.revenue - item.cost).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!(data as unknown[]).length && <p className="text-center py-6 text-gray-400">No sales data</p>}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
