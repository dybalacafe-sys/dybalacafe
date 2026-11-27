import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Layout from '@/components/Layout'
import { useAuth, apiFetch } from '@/lib/AuthContext'
import toast from 'react-hot-toast'
import {
  FiPlus, FiTrash2, FiDollarSign, FiCreditCard,
  FiTruck, FiAlertCircle, FiCheckCircle, FiUser
} from 'react-icons/fi'

interface Expense {
  id: number
  category: string
  amount: number
  description?: string
  date: string
  createdAt: string
}

interface Supplier {
  id: number
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  purchaseCount: number
  totalPurchased: number
  totalPaid: number
  totalDue: number
}

interface Purchase {
  id: number
  outletId: number
  supplierId: number
  supplier: { id: number; name: string; phone?: string | null }
  total: number
  paid: number
  due: number
  note?: string | null
  createdAt: string
}

const EXPENSE_CATEGORIES = [
  'Rent', 'Utilities', 'Salaries', 'Supplies',
  'Equipment', 'Marketing', 'Transport', 'Miscellaneous'
]

export default function ExpensesPage() {
  const { token, can, selectedOutlet } = useAuth()

  // Tabs: 'daily' (Operating expenses) or 'vendors' (Vendor purchases & credit)
  const [activeTab, setActiveTab] = useState<'daily' | 'vendors'>('daily')

  // Daily Expenses state
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    category: 'Rent',
    amount: '',
    description: '',
    date: new Date().toISOString().slice(0, 10),
  })
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 7) + '-01')
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))

  // Vendor & Purchase state

  // Modals for Vendor
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedSupplierForPayment, setSelectedSupplierForPayment] = useState<Supplier | null>(null)

  const [purchaseForm, setPurchaseForm] = useState({
    supplierId: '',
    total: '',
    paid: '',
    note: '',
    date: new Date().toISOString().slice(0, 10),
  })

  const [supplierForm, setSupplierForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
  })

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    note: '',
    date: new Date().toISOString().slice(0, 10),
  })

  const queryClient = useQueryClient()

  // Fetch daily expenses
  const { data: expensesData } = useQuery<{ expenses: Expense[]; total: number }>({
    queryKey: ['expenses', selectedOutlet?.id, startDate, endDate],
    queryFn: () =>
      apiFetch(
        `/api/expenses?startDate=${startDate}&endDate=${endDate}T23:59:59`,
        {},
        token!
      ) as Promise<{ expenses: Expense[]; total: number }>,
    enabled: !!token,
  })

  const expenses = expensesData?.expenses ?? []
  const total = expensesData?.total ?? 0
  const fetchExpenses = () => queryClient.invalidateQueries({ queryKey: ['expenses', selectedOutlet?.id] })

  // Fetch suppliers and purchases
  const { data: vendorsData, isFetching: vendorLoading } = useQuery<{ suppliers: Supplier[]; purchases: Purchase[] }>({
    queryKey: ['vendors', selectedOutlet?.id],
    queryFn: async () => {
      const [supData, purData] = await Promise.all([
        apiFetch('/api/suppliers', {}, token!) as Promise<Supplier[]>,
        apiFetch('/api/purchases', {}, token!) as Promise<Purchase[]>,
      ])
      return {
        suppliers: Array.isArray(supData) ? supData : [],
        purchases: Array.isArray(purData) ? purData : [],
      }
    },
    enabled: !!token && activeTab === 'vendors',
  })

  const suppliers = vendorsData?.suppliers ?? []
  const purchases = vendorsData?.purchases ?? []
  const fetchVendorsData = () => queryClient.invalidateQueries({ queryKey: ['vendors', selectedOutlet?.id] })

  // Save regular expense
  const handleSaveExpense = async () => {
    if (!form.amount) {
      toast.error('Amount required')
      return
    }
    try {
      await apiFetch('/api/expenses', { method: 'POST', body: JSON.stringify(form) }, token)
      toast.success('Expense added')
      setShowModal(false)
      setForm({
        category: 'Rent',
        amount: '',
        description: '',
        date: new Date().toISOString().slice(0, 10),
      })
      fetchExpenses()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    }
  }

  // Delete regular expense
  const handleDeleteExpense = async (id: number) => {
    if (!confirm('Delete this expense?')) return
    try {
      await apiFetch(`/api/expenses?id=${id}`, { method: 'DELETE' }, token)
      toast.success('Deleted')
      fetchExpenses()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    }
  }

  // Save new supplier
  const handleSaveSupplier = async () => {
    if (!supplierForm.name.trim()) {
      toast.error('Vendor name is required')
      return
    }
    try {
      await apiFetch('/api/suppliers', { method: 'POST', body: JSON.stringify(supplierForm) }, token)
      toast.success('Vendor added successfully')
      setShowSupplierModal(false)
      setSupplierForm({ name: '', phone: '', email: '', address: '' })
      fetchVendorsData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add vendor')
    }
  }

  // Save new purchase bill
  const handleSavePurchase = async () => {
    if (!purchaseForm.supplierId) {
      toast.error('Please select a vendor')
      return
    }
    if (!purchaseForm.total || Number(purchaseForm.total) <= 0) {
      toast.error('Valid bill total is required')
      return
    }
    try {
      await apiFetch('/api/purchases', {
        method: 'POST',
        body: JSON.stringify({
          supplierId: Number(purchaseForm.supplierId),
          total: Number(purchaseForm.total),
          paid: Number(purchaseForm.paid) || 0,
          note: purchaseForm.note,
          date: purchaseForm.date,
        }),
      }, token)
      toast.success('Vendor purchase recorded')
      setShowPurchaseModal(false)
      setPurchaseForm({
        supplierId: '',
        total: '',
        paid: '',
        note: '',
        date: new Date().toISOString().slice(0, 10),
      })
      fetchVendorsData()
      fetchExpenses()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to record purchase')
    }
  }

  // Open payment modal for a supplier
  const openPaymentModal = (supplier: Supplier) => {
    setSelectedSupplierForPayment(supplier)
    setPaymentForm({
      amount: String(supplier.totalDue),
      note: '',
      date: new Date().toISOString().slice(0, 10),
    })
    setShowPaymentModal(true)
  }

  // Save payment to vendor
  const handleRecordVendorPayment = async () => {
    if (!selectedSupplierForPayment) return
    const num = Number(paymentForm.amount)
    if (!num || num <= 0) {
      toast.error('Please enter a valid payment amount')
      return
    }
    try {
      await apiFetch('/api/purchases/payment', {
        method: 'POST',
        body: JSON.stringify({
          supplierId: selectedSupplierForPayment.id,
          amount: num,
          note: paymentForm.note,
          date: paymentForm.date,
        }),
      }, token)
      toast.success(`Payment of NPR ${num.toLocaleString()} recorded for ${selectedSupplierForPayment.name}`)
      setShowPaymentModal(false)
      setSelectedSupplierForPayment(null)
      fetchVendorsData()
      fetchExpenses()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to record payment')
    }
  }

  // Group daily expenses by category
  const byCategory: Record<string, number> = {}
  expenses.forEach((e) => {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount
  })

  // Computed Vendor Metrics for active outlet
  const totalVendorPurchased = suppliers.reduce((s, sup) => s + sup.totalPurchased, 0)
  const totalVendorPaid = suppliers.reduce((s, sup) => s + sup.totalPaid, 0)
  const totalVendorDue = suppliers.reduce((s, sup) => s + sup.totalDue, 0)

  // Live calculation for new purchase balance due
  const newPurchaseTotal = Number(purchaseForm.total) || 0
  const newPurchasePaid = Number(purchaseForm.paid) || 0
  const newPurchaseDue = Math.max(0, newPurchaseTotal - newPurchasePaid)

  return (
    <Layout>
      <>
      
      <div className="space-y-6">
        {/* Header with Title and Mode Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Expenses & Purchases</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Manage operating expenses and track supplier purchases & credit ledgers (साहुको खाता)
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex bg-gray-200/80 p-1 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab('daily')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'daily'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FiDollarSign size={14} /> Daily Operating Expenses
            </button>
            <button
              onClick={() => setActiveTab('vendors')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'vendors'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FiTruck size={14} /> Vendor Purchases & Khata
              {totalVendorDue > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1">
                  NPR {totalVendorDue.toLocaleString()} Due
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: DAILY OPERATING EXPENSES */}
        {/* ========================================================================= */}
        {activeTab === 'daily' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">Operating Expenses Log</span>
              {can('expenses', 'edit') && (
                <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
                  <FiPlus /> Add Operating Expense
                </button>
              )}
            </div>

            {/* Date filter & Total */}
            <div className="card flex flex-wrap gap-4 items-end">
              <div>
                <label className="label text-xs">From</label>
                <input
                  type="date"
                  className="input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="label text-xs">To</label>
                <input
                  type="date"
                  className="input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500">Total Operating Expenses</p>
                <p className="text-2xl font-bold text-red-600">NPR {total.toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Category Summary */}
              <div className="card">
                <h2 className="text-lg font-semibold mb-4">By Category</h2>
                <div className="space-y-2">
                  {Object.entries(byCategory)
                    .sort(([, a], [, b]) => b - a)
                    .map(([cat, amt]) => (
                      <div
                        key={cat}
                        className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0"
                      >
                        <span className="text-sm text-gray-700">{cat}</span>
                        <span className="text-sm font-semibold text-red-600">
                          NPR {amt.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  {Object.keys(byCategory).length === 0 && (
                    <p className="text-gray-400 text-sm">No expenses in this period</p>
                  )}
                </div>
              </div>

              {/* Expenses List */}
              <div className="card lg:col-span-2">
                <h2 className="text-lg font-semibold mb-4">Expense Log</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 text-gray-600">Date</th>
                        <th className="text-left px-3 py-2 text-gray-600">Category</th>
                        <th className="text-left px-3 py-2 text-gray-600">Description</th>
                        <th className="text-right px-3 py-2 text-gray-600">Amount</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((e) => (
                        <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-500">
                            {new Date(e.date).toLocaleDateString('en-NP', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="px-3 py-2">
                            <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs">
                              {e.category}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-600">{e.description || '-'}</td>
                          <td className="px-3 py-2 text-right font-semibold text-red-600">
                            NPR {e.amount.toLocaleString()}
                          </td>
                          <td className="px-3 py-2">
                            {can('expenses', 'delete') && (
                              <button
                                onClick={() => handleDeleteExpense(e.id)}
                                className="text-red-400 hover:text-red-600"
                              >
                                <FiTrash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {expenses.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-gray-400">
                            No expenses in this period
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: VENDOR PURCHASES & CREDIT LEDGER (साहुको खाता) */}
        {/* ========================================================================= */}
        {activeTab === 'vendors' && (
          <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 font-medium">Vendor & Supplier Ledger</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSupplierModal(true)}
                  className="btn-secondary text-xs flex items-center gap-1.5"
                >
                  <FiUser size={13} /> Add Vendor
                </button>
                <button
                  onClick={() => setShowPurchaseModal(true)}
                  className="btn-primary text-xs flex items-center gap-1.5"
                >
                  <FiPlus size={14} /> Record Purchase Bill
                </button>
              </div>
            </div>

            {/* Vendor Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="card bg-blue-50/40 border border-blue-100">
                <p className="text-xs font-medium text-blue-700 uppercase tracking-wider">
                  Total Purchases (Outlet)
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  NPR {totalVendorPurchased.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">Supplies & stock bills</p>
              </div>

              <div className="card bg-green-50/40 border border-green-100">
                <p className="text-xs font-medium text-green-700 uppercase tracking-wider">
                  Total Paid to Vendors
                </p>
                <p className="text-2xl font-bold text-green-700 mt-1">
                  NPR {totalVendorPaid.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">Settled payments</p>
              </div>

              <div className={`card ${totalVendorDue > 0 ? 'bg-red-50/60 border border-red-200' : 'bg-gray-50 border border-gray-100'}`}>
                <p className={`text-xs font-medium uppercase tracking-wider ${totalVendorDue > 0 ? 'text-red-700 font-bold' : 'text-gray-500'}`}>
                  Outstanding Vendor Credit (Due)
                </p>
                <p className={`text-2xl font-bold mt-1 ${totalVendorDue > 0 ? 'text-red-600' : 'text-gray-700'}`}>
                  NPR {totalVendorDue.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {totalVendorDue > 0 ? 'Payable balance to suppliers' : 'All vendor bills clear'}
                </p>
              </div>
            </div>

            {/* Vendor Directory & Outstanding Khata Table */}
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <FiTruck className="text-blue-600" /> Suppliers & Payable Ledgers (साहुको बाँकी)
                </h2>
                <span className="text-xs text-gray-500 font-medium">
                  {suppliers.length} vendor{suppliers.length === 1 ? '' : 's'} registered
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-3 py-2.5 text-xs text-gray-600 font-semibold">Vendor / Supplier</th>
                      <th className="text-left px-3 py-2.5 text-xs text-gray-600 font-semibold">Contact / Address</th>
                      <th className="text-right px-3 py-2.5 text-xs text-gray-600 font-semibold">Total Purchases</th>
                      <th className="text-right px-3 py-2.5 text-xs text-gray-600 font-semibold">Total Paid</th>
                      <th className="text-right px-3 py-2.5 text-xs text-gray-600 font-semibold">Outstanding Due</th>
                      <th className="text-center px-3 py-2.5 text-xs text-gray-600 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {suppliers.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-3 py-3">
                          <p className="font-semibold text-gray-900">{s.name}</p>
                          <p className="text-xs text-gray-400">{s.purchaseCount} bill(s) recorded</p>
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-600">
                          {s.phone && <p>📞 {s.phone}</p>}
                          {s.address && <p className="text-gray-400">📍 {s.address}</p>}
                          {!s.phone && !s.address && <span className="text-gray-400">-</span>}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-700 font-medium">
                          NPR {s.totalPurchased.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right text-green-700 font-medium">
                          NPR {s.totalPaid.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {s.totalDue > 0 ? (
                            <span className="font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full text-xs inline-flex items-center gap-1">
                              <FiAlertCircle size={11} /> NPR {s.totalDue.toLocaleString()}
                            </span>
                          ) : (
                            <span className="font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full text-xs inline-flex items-center gap-1">
                              <FiCheckCircle size={11} /> Clear
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {s.totalDue > 0 ? (
                            <button
                              onClick={() => openPaymentModal(s)}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-lg font-medium shadow-sm transition-colors"
                            >
                              Pay Vendor
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setPurchaseForm((f) => ({ ...f, supplierId: String(s.id) }))
                                setShowPurchaseModal(true)
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              + New Bill
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}

                    {suppliers.length === 0 && !vendorLoading && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-400">
                          No suppliers recorded yet. Click &quot;Add Vendor&quot; to add your suppliers.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Purchase Bills History */}
            <div className="card space-y-4">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <FiCreditCard className="text-indigo-600" /> Recent Purchase Bills
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs text-gray-600 font-semibold">Date</th>
                      <th className="text-left px-3 py-2 text-xs text-gray-600 font-semibold">Vendor</th>
                      <th className="text-left px-3 py-2 text-xs text-gray-600 font-semibold">Note / Remarks</th>
                      <th className="text-right px-3 py-2 text-xs text-gray-600 font-semibold">Bill Total</th>
                      <th className="text-right px-3 py-2 text-xs text-gray-600 font-semibold">Paid</th>
                      <th className="text-right px-3 py-2 text-xs text-gray-600 font-semibold">Balance Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {purchases.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-xs text-gray-500">
                          {new Date(p.createdAt).toLocaleDateString('en-NP', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-gray-800">
                          {p.supplier?.name || 'Unknown Vendor'}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-600 max-w-xs truncate">
                          {p.note || '-'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-gray-900">
                          NPR {p.total.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-green-700">
                          NPR {p.paid.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {p.due > 0 ? (
                            <span className="text-red-600 font-bold text-xs bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                              NPR {p.due.toLocaleString()} Due
                            </span>
                          ) : (
                            <span className="text-green-700 text-xs font-medium bg-green-50 px-2 py-0.5 rounded-full">
                              Paid
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}

                    {purchases.length === 0 && !vendorLoading && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-400">
                          No purchase bills recorded yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        </div>
        {/* ========================================================================= */}
        {/* MODAL 1: ADD OPERATING EXPENSE */}
        {/* ========================================================================= */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4 shadow-xl">
              <h2 className="text-lg font-bold text-gray-900">Add Operating Expense</h2>
              <div>
                <label className="label text-xs">Category</label>
                <select
                  className="input"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label text-xs">Amount (NPR) *</label>
                <input
                  type="number"
                  className="input"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="e.g. 2500"
                />
              </div>
              <div>
                <label className="label text-xs">Description</label>
                <input
                  className="input"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Electricity bill / cleaning supplies..."
                />
              </div>
              <div>
                <label className="label text-xs">Date</label>
                <input
                  type="date"
                  className="input"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSaveExpense} className="btn-primary flex-1">
                  Save Expense
                </button>
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 2: ADD VENDOR / SUPPLIER */}
        {/* ========================================================================= */}
        {showSupplierModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4 shadow-xl">
              <h2 className="text-lg font-bold text-gray-900">Add New Supplier / Vendor</h2>
              <div>
                <label className="label text-xs">Supplier / Vendor Name *</label>
                <input
                  type="text"
                  className="input"
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Himalayan Fresh Dairy"
                />
              </div>
              <div>
                <label className="label text-xs">Phone Number</label>
                <input
                  type="text"
                  className="input"
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="e.g. 9841000000"
                />
              </div>
              <div>
                <label className="label text-xs">Address / Location</label>
                <input
                  type="text"
                  className="input"
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="e.g. Kalimati / Balkhu"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSaveSupplier} className="btn-primary flex-1">
                  Save Vendor
                </button>
                <button onClick={() => setShowSupplierModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 3: RECORD PURCHASE BILL*/}
        {/* ========================================================================= */}
        {showPurchaseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4 shadow-xl">
              <h2 className="text-lg font-bold text-gray-900">Record Vendor Purchase Bill</h2>
              <div>
                <label className="label text-xs">Vendor / Supplier *</label>
                <select
                  className="input"
                  value={purchaseForm.supplierId}
                  onChange={(e) => setPurchaseForm((f) => ({ ...f, supplierId: e.target.value }))}
                >
                  <option value="">-- Select Vendor --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.totalDue > 0 ? `(NPR ${s.totalDue.toLocaleString()} due)` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Total Bill Amount (NPR) *</label>
                  <input
                    type="number"
                    className="input"
                    value={purchaseForm.total}
                    onChange={(e) => setPurchaseForm((f) => ({ ...f, total: e.target.value }))}
                    placeholder="e.g. 5000"
                  />
                </div>
                <div>
                  <label className="label text-xs">Paid Amount (NPR)</label>
                  <input
                    type="number"
                    className="input"
                    value={purchaseForm.paid}
                    onChange={(e) => setPurchaseForm((f) => ({ ...f, paid: e.target.value }))}
                    placeholder="0 if fully on credit"
                  />
                </div>
              </div>

              {/* Dynamic Due calculation */}
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs flex justify-between items-center">
                <span className="text-gray-500 font-medium">Remaining Due on Credit:</span>
                <span className={`font-bold ${newPurchaseDue > 0 ? 'text-red-600' : 'text-green-700'}`}>
                  NPR {newPurchaseDue.toLocaleString()}
                </span>
              </div>

              <div>
                <label className="label text-xs">Note / Items Description</label>
                <input
                  className="input"
                  value={purchaseForm.note}
                  onChange={(e) => setPurchaseForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="e.g. 20L milk, 5kg butter, packaging boxes..."
                />
              </div>

              <div>
                <label className="label text-xs">Date</label>
                <input
                  type="date"
                  className="input"
                  value={purchaseForm.date}
                  onChange={(e) => setPurchaseForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={handleSavePurchase} className="btn-primary flex-1">
                  Save Purchase Bill
                </button>
                <button onClick={() => setShowPurchaseModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 4: RECORD PAYMENT TO VENDOR (साहुलाई भुक्तानी) */}
        {/* ========================================================================= */}
        {showPaymentModal && selectedSupplierForPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4 shadow-xl">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Record Vendor Payment</h2>
                <p className="text-xs text-gray-500">
                  Paying supplier: <strong>{selectedSupplierForPayment.name}</strong>
                </p>
              </div>

              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs flex justify-between items-center">
                <span className="text-red-800 font-medium">Current Outstanding Due:</span>
                <span className="text-red-700 font-bold text-sm">
                  NPR {selectedSupplierForPayment.totalDue.toLocaleString()}
                </span>
              </div>

              <div>
                <label className="label text-xs">Payment Amount (NPR) *</label>
                <input
                  type="number"
                  className="input font-semibold text-gray-900"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="Amount to pay..."
                />
              </div>

              <div>
                <label className="label text-xs">Payment Remarks / Note</label>
                <input
                  className="input"
                  value={paymentForm.note}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="e.g. Partial cash clearance / Cheque / eSewa"
                />
              </div>

              <div>
                <label className="label text-xs">Payment Date</label>
                <input
                  type="date"
                  className="input"
                  value={paymentForm.date}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={handleRecordVendorPayment} className="btn-primary flex-1">
                  Confirm Payment
                </button>
                <button onClick={() => setShowPaymentModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    </Layout>
  )
}
