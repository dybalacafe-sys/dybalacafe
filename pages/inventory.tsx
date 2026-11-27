import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Layout from '@/components/Layout'
import { useAuth, apiFetch } from '@/lib/AuthContext'
import { TableSkeleton } from '@/components/Skeleton'
import toast from 'react-hot-toast'
import { FiPlus, FiEdit2, FiSearch, FiAlertTriangle, FiRefreshCw, FiTrash2, FiLink, FiChevronDown, FiChevronUp } from 'react-icons/fi'

interface RecipeIngredient { id: number; name: string; unit: string; stock: number }
interface RecipeItem { id: number; ingredientId: number; quantity: number; unit: string; ingredient: RecipeIngredient }

interface Product {
  id: number; name: string; sku?: string; price: number; costPrice: number;
  stock: number; minStock: number; unit: string; type: string; active: boolean;
  category?: { id: number; name: string }
  recipeItems: RecipeItem[]
}

interface Category { id: number; name: string; type: string }

interface RecipeRow { ingredientId: number; quantity: number; unit: string }

export default function InventoryPage() {
  const { token, can, selectedOutlet } = useAuth()
  const isCafe = selectedOutlet?.code === 'CAF' || selectedOutlet?.type?.code === 'CAFE' || selectedOutlet?.name?.toLowerCase().includes('cafe')

  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showStockModal, setShowStockModal] = useState(false)
  const [showRecipeSection, setShowRecipeSection] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [form, setForm] = useState({ name: '', sku: '', categoryId: '', type: 'finished', price: '', costPrice: '', unit: 'piece', stock: '', minStock: '5' })
  const [recipe, setRecipe] = useState<RecipeRow[]>([])
  const [stockAdjust, setStockAdjust] = useState({ type: 'IN', quantity: '', note: '' })

  const { data: inventoryData, isLoading: inventoryLoading } = useQuery<{ products: Product[]; categories: Category[] }>({
    queryKey: ['inventory', selectedOutlet?.id],
    queryFn: async () => {
      const [prods, cats] = await Promise.all([
        apiFetch('/api/products', {}, token!),
        apiFetch('/api/categories', {}, token!),
      ])
      return {
        products: Array.isArray(prods) ? (prods as Product[]) : [],
        categories: Array.isArray(cats) ? (cats as Category[]) : [],
      }
    },
    enabled: !!token,
  })

  const products = inventoryData?.products ?? []
  const categories = inventoryData?.categories ?? []
  const rawMaterials = products.filter(p => p.type === 'raw_material')
  const fetchData = () => queryClient.invalidateQueries({ queryKey: ['inventory', selectedOutlet?.id] })

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchType = !typeFilter || p.type === typeFilter
    return matchSearch && matchType
  })

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', sku: '', categoryId: '', type: 'finished', price: '', costPrice: '', unit: 'piece', stock: '', minStock: '5' })
    setRecipe([])
    setShowRecipeSection(!isCafe)
    setShowModal(true)
  }

  const openEdit = (p: Product) => {
    setEditing(p)
    setForm({
      name: p.name, sku: p.sku || '', categoryId: p.category?.id?.toString() || '',
      type: p.type, price: p.price.toString(), costPrice: p.costPrice.toString(),
      unit: p.unit, stock: p.stock.toString(), minStock: p.minStock.toString(),
    })
    setRecipe(p.recipeItems.map(r => ({ ingredientId: r.ingredientId, quantity: r.quantity, unit: r.unit })))
    setShowRecipeSection(p.recipeItems.length > 0)
    setShowModal(true)
  }

  const handleSave = async () => {
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        costPrice: Number(form.costPrice),
        minStock: Number(form.minStock),
        recipeItems: form.type === 'finished' && showRecipeSection ? recipe.filter(r => r.ingredientId && r.quantity > 0) : [],
      }
      if (editing) {
        await apiFetch(`/api/products/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) }, token)
        toast.success('Product updated')
      } else {
        await apiFetch('/api/products', {
          method: 'POST',
          body: JSON.stringify({ ...payload, stock: Number(form.stock) }),
        }, token)
        toast.success(`Product added to ${selectedOutlet?.name || 'inventory'}`)
      }
      setShowModal(false)
      fetchData()
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed') }
  }

  const handleDeleteFromOutlet = async (p: Product) => {
    if (!confirm(`Remove "${p.name}" from ${selectedOutlet?.name || 'this outlet'}?`)) return
    try {
      await apiFetch(`/api/products/${p.id}`, { method: 'DELETE' }, token)
      toast.success(`Removed from ${selectedOutlet?.name || 'outlet'}`)
      fetchData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove product')
    }
  }

  const handleStockAdjust = async () => {
    if (!selectedProduct) return
    try {
      await apiFetch('/api/products/stock-adjust', {
        method: 'POST',
        body: JSON.stringify({ productId: selectedProduct.id, ...stockAdjust, quantity: Number(stockAdjust.quantity) }),
      }, token)
      toast.success('Stock updated')
      setShowStockModal(false)
      fetchData()
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed') }
  }

  const addRecipeRow = () => setRecipe(r => [...r, { ingredientId: 0, quantity: 1, unit: '' }])
  const removeRecipeRow = (i: number) => setRecipe(r => r.filter((_, idx) => idx !== i))
  const updateRecipeRow = (i: number, field: keyof RecipeRow, value: number | string) => {
    setRecipe(prev => {
      const updated = [...prev]
      updated[i] = { ...updated[i], [field]: value }
      if (field === 'ingredientId') {
        const mat = rawMaterials.find(m => m.id === Number(value))
        if (mat) updated[i].unit = mat.unit
      }
      return updated
    })
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isCafe ? 'Cafe Inventory & Supplies' : 'Inventory'}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {selectedOutlet ? (
                <>Stock isolated to: <span className="font-semibold text-blue-600">{selectedOutlet.name} ({selectedOutlet.code})</span></>
              ) : 'Manage products and stock levels'}
            </p>
          </div>
          {can('inventory', 'edit') && (
            <button onClick={openAdd} className="btn-primary flex items-center gap-2">
              <FiPlus /> Add Product
            </button>
          )}
        </div>

        <div className="card">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                placeholder="Search products..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input pl-10"
              />
            </div>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input w-auto">
              <option value="">All Types</option>
              <option value="finished">Finished Products</option>
              <option value="raw_material">Raw Materials</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Name', 'Category', 'Type', 'Price', 'Cost', 'Stock', 'Min Stock', 'Actions'].map(h => (
                    <th key={h} className="text-left px-3 py-3 text-gray-600 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-3 font-medium text-gray-800">
                      {p.name}
                      {p.stock <= p.minStock && (
                        <FiAlertTriangle className="inline ml-1 text-red-500" size={14} title="Low stock" />
                      )}
                      {p.type === 'finished' && p.recipeItems.length > 0 && (
                        <FiLink className="inline ml-1 text-blue-400" size={13} title={`${p.recipeItems.length} ingredient(s)`} />
                      )}
                    </td>
                    <td className="px-3 py-3 text-gray-500">{p.category?.name || '-'}</td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${p.type === 'finished' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                        {p.type === 'finished' ? 'Finished' : 'Raw Material'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-gray-700">NPR {p.price}</td>
                    <td className="px-3 py-3 text-gray-500">NPR {p.costPrice}</td>
                    <td className={`px-3 py-3 font-semibold ${p.stock <= p.minStock ? 'text-red-600' : 'text-green-600'}`}>
                      {p.stock} {p.unit}
                    </td>
                    <td className="px-3 py-3 text-gray-500">{p.minStock} {p.unit}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        {can('inventory', 'edit') && (
                          <button onClick={() => openEdit(p)} className="text-blue-600 hover:text-blue-800" title="Edit">
                            <FiEdit2 size={16} />
                          </button>
                        )}
                        {can('inventory', 'edit') && (
                          <button
                            onClick={() => { setSelectedProduct(p); setStockAdjust({ type: 'IN', quantity: '', note: '' }); setShowStockModal(true) }}
                            className="text-green-600 hover:text-green-800"
                            title="Stock In / Adjust"
                          >
                            <FiRefreshCw size={16} />
                          </button>
                        )}
                        {can('inventory', 'delete') && (
                          <button
                            onClick={() => handleDeleteFromOutlet(p)}
                            className="text-red-400 hover:text-red-600"
                            title="Remove from outlet"
                          >
                            <FiTrash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {inventoryLoading ? (
              <div className="p-4"><TableSkeleton rows={6} /></div>
            ) : filtered.length === 0 && (
              <p className="text-center py-8 text-gray-400">No products found in this outlet</p>
            )}
          </div>
        </div>
      </div>

      {/* Product Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-xl">
            <h2 className="text-lg font-bold">{editing ? 'Edit Product' : 'Add Product'}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Product Name *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">SKU</label>
                <input className="input" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} />
              </div>
              <div>
                <label className="label">Type</label>
                <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="finished">Finished Product</option>
                  <option value="raw_material">Raw Material</option>
                </select>
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input" value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}>
                  <option value="">No Category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Unit</label>
                <input className="input" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="piece, kg, cup..." />
              </div>
              <div>
                <label className="label">Selling Price (NPR)</label>
                <input type="number" className="input" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
              </div>
              <div>
                <label className="label">Cost Price (NPR)</label>
                <input type="number" className="input" value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))} />
              </div>
              {!editing && (
                <div>
                  <label className="label">Initial Stock</label>
                  <input type="number" className="input" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} />
                </div>
              )}
              <div>
                <label className="label">Min Stock Alert</label>
                <input type="number" className="input" value={form.minStock} onChange={e => setForm(f => ({ ...f, minStock: e.target.value }))} />
              </div>
            </div>

            {/* Recipe section — toggleable for Cafe to avoid clutter */}
            {form.type === 'finished' && (
              <div className="border-t border-gray-200 pt-3 space-y-2">
                <button
                  type="button"
                  onClick={() => setShowRecipeSection(!showRecipeSection)}
                  className="flex items-center justify-between w-full text-xs font-semibold text-gray-700 hover:text-blue-600 py-1"
                >
                  <span className="flex items-center gap-1.5">
                    <FiLink size={13} /> Raw Material Recipe Deductions ({recipe.length} item{recipe.length === 1 ? '' : 's'})
                  </span>
                  {showRecipeSection ? <FiChevronUp size={15} /> : <FiChevronDown size={15} />}
                </button>

                {showRecipeSection && (
                  <div className="space-y-3 pt-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">Auto-deducted when product is sold</p>
                      <button type="button" onClick={addRecipeRow} className="btn-secondary text-xs py-1 px-2 flex items-center gap-1">
                        <FiPlus size={12} /> Add Ingredient
                      </button>
                    </div>

                    {recipe.map((row, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-5">
                          <select
                            className="input text-xs"
                            value={row.ingredientId || ''}
                            onChange={e => updateRecipeRow(i, 'ingredientId', Number(e.target.value))}
                          >
                            <option value="">Select ingredient...</option>
                            {rawMaterials.map(m => (
                              <option key={m.id} value={m.id}>{m.name} ({m.stock} {m.unit})</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-3">
                          <input
                            type="number" min="0.001" step="any"
                            className="input text-xs"
                            placeholder="Qty"
                            value={row.quantity}
                            onChange={e => updateRecipeRow(i, 'quantity', Number(e.target.value))}
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            className="input text-xs"
                            placeholder="Unit"
                            value={row.unit}
                            onChange={e => updateRecipeRow(i, 'unit', e.target.value)}
                          />
                        </div>
                        <div className="col-span-1">
                          <button type="button" onClick={() => removeRecipeRow(i)} className="text-red-400 hover:text-red-600">
                            <FiTrash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} className="btn-primary flex-1">Save Product</button>
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjust Modal */}
      {showStockModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 space-y-4 shadow-xl">
            <div>
              <h2 className="text-lg font-bold">Stock Adjust</h2>
              <p className="text-sm text-gray-500">{selectedProduct.name} (Current: <strong>{selectedProduct.stock} {selectedProduct.unit}</strong>)</p>
            </div>
            <div>
              <label className="label">Adjustment Type</label>
              <select className="input" value={stockAdjust.type} onChange={e => setStockAdjust(a => ({ ...a, type: e.target.value }))}>
                <option value="IN">Stock IN (Receive new supplies)</option>
                <option value="OUT">Stock OUT (Wastage / Spoilage / Expired)</option>
                <option value="ADJUSTMENT">Direct Reset (Set absolute count)</option>
              </select>
            </div>
            <div>
              <label className="label">Quantity ({selectedProduct.unit}) *</label>
              <input
                type="number" className="input"
                value={stockAdjust.quantity}
                onChange={e => setStockAdjust(a => ({ ...a, quantity: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <label className="label">Reason / Note</label>
              <input
                className="input"
                value={stockAdjust.note}
                onChange={e => setStockAdjust(a => ({ ...a, note: e.target.value }))}
                placeholder="e.g. Daily delivery / spilled milk..."
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleStockAdjust} className="btn-primary flex-1">Update Stock</button>
              <button onClick={() => setShowStockModal(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
