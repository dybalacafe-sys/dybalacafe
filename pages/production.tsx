import { useEffect, useState, useCallback } from 'react'
import Layout from '@/components/Layout'
import { useAuth, apiFetch } from '@/lib/AuthContext'
import toast from 'react-hot-toast'
import { FiAlertTriangle, FiCheckCircle } from 'react-icons/fi'

interface RecipeIngredient {
  id: number; name: string; unit: string; stock: number
}

interface RecipeItem {
  id: number; quantity: number; unit: string; ingredient: RecipeIngredient
}

interface FinishedProduct {
  id: number; name: string; unit: string; stock: number; recipeItems: RecipeItem[]
}

export default function ProductionPage() {
  const { token, selectedOutlet } = useAuth()
  const [products, setProducts] = useState<FinishedProduct[]>([])
  const [selectedId, setSelectedId] = useState<number | ''>('')
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(false)

  const fetchProducts = useCallback(async () => {
    if (!token) return
    const data = await apiFetch('/api/production', {}, token)
    setProducts(data as FinishedProduct[])
  }, [token])

  useEffect(() => { fetchProducts() }, [fetchProducts, selectedOutlet?.id])

  const selected = products.find(p => p.id === selectedId)

  const canProduce = selected
    ? selected.recipeItems.every(r => r.ingredient.stock >= r.quantity * quantity)
    : false

  const handleProduce = async () => {
    if (!selectedId || quantity <= 0) { toast.error('Select a product and quantity'); return }
    setLoading(true)
    try {
      await apiFetch('/api/production', {
        method: 'POST',
        body: JSON.stringify({ productId: selectedId, quantity }),
      }, token)
      toast.success(`Produced ${quantity} × ${selected?.name}`)
      setQuantity(1)
      fetchProducts()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Production failed')
    } finally { setLoading(false) }
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Production</h1>
          <p className="text-sm text-gray-500 mt-1">Convert raw materials into finished products using defined recipes.</p>
        </div>

        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Record Production Run</h2>

          <div>
            <label className="label">Finished Product</label>
            <select
              className="input"
              value={selectedId}
              onChange={e => { setSelectedId(Number(e.target.value)); setQuantity(1) }}
            >
              <option value="">Select product to produce...</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} (current stock: {p.stock} {p.unit})</option>
              ))}
            </select>
            {products.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">
                No finished products with recipes found. Add recipes to products in Inventory.
              </p>
            )}
          </div>

          {selected && (
            <>
              <div>
                <label className="label">Quantity to Produce ({selected.unit})</label>
                <input
                  type="number" min="1" className="input w-32"
                  value={quantity}
                  onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                />
              </div>

              {/* Required raw materials */}
              <div>
                <p className="label mb-2">Required Raw Materials</p>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Ingredient</th>
                        <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">Required</th>
                        <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">In Stock</th>
                        <th className="text-center px-4 py-2 text-xs text-gray-500 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selected.recipeItems.map(r => {
                        const required = r.quantity * quantity
                        const ok = r.ingredient.stock >= required
                        return (
                          <tr key={r.id} className={ok ? '' : 'bg-red-50'}>
                            <td className="px-4 py-2 font-medium text-gray-800">{r.ingredient.name}</td>
                            <td className="px-4 py-2 text-right text-gray-600">{required} {r.unit}</td>
                            <td className="px-4 py-2 text-right text-gray-600">{r.ingredient.stock} {r.ingredient.unit}</td>
                            <td className="px-4 py-2 text-center">
                              {ok
                                ? <FiCheckCircle className="inline text-green-500" size={16} />
                                : <FiAlertTriangle className="inline text-red-500" size={16} />
                              }
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {!canProduce && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <FiAlertTriangle size={16} />
                  Not enough raw materials to produce {quantity} × {selected.name}.
                </div>
              )}

              <button
                onClick={handleProduce}
                disabled={loading || !canProduce}
                className="btn-primary w-full py-3 disabled:opacity-50"
              >
                {loading ? 'Processing...' : `Produce ${quantity} × ${selected.name}`}
              </button>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
