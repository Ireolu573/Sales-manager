import { useState } from 'react'
import type { Product } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Package, Plus, Trash2, Pencil, Save, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { TenantService } from '@/services/tenant.service'

interface Props {
  tenantId: string
  products: Product[]
  onProductsChanged: () => void
}

const UNIT_OPTIONS = ['bag','kg','paint','sachet','small','medium','large','big','bird','pack','crate','bottle','litre','unit']
const emptyUnit = () => ({ unit_label: 'bag', unit_price: '' })

export function ProductManagementTable({ tenantId, products, onProductsChanged }: Props) {
  const { toast } = useToast()
  const [newProductName, setNewProductName] = useState('')
  const [units, setUnits] = useState<{ unit_label: string; unit_price: string }[]>([emptyUnit()])
  const [addingProduct, setAddingProduct] = useState(false)
  const [productError, setProductError] = useState('')

  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [editPrices, setEditPrices] = useState<Record<string, string>>({})
  const [savingPrices, setSavingPrices] = useState(false)

  const addProduct = async () => {
    if (!newProductName.trim()) return
    const validUnits = units.filter(u => u.unit_label && u.unit_price)
    if (validUnits.length === 0) {
      setProductError('Add at least one unit with a price.')
      return
    }
    setProductError('')
    setAddingProduct(true)

    try {
      await TenantService.addProduct(
        newProductName.trim(),
        tenantId,
        validUnits.map(u => ({ unit_label: u.unit_label, unit_price: Number(u.unit_price) }))
      )
      setNewProductName('')
      setUnits([emptyUnit()])
      onProductsChanged()
      toast({ title: 'Product added successfully!' })
    } catch (err: any) {
      toast({ title: 'Error adding product', description: err.message, variant: 'destructive' })
    } finally {
      setAddingProduct(false)
    }
  }

  const startEditPrices = (product: Product) => {
    setEditingProductId(product.id)
    const initial: Record<string, string> = {}
    product.product_units?.forEach(u => { initial[u.id] = String(u.unit_price) })
    setEditPrices(initial)
  }

  const saveEditedPrices = async (product: Product) => {
    setSavingPrices(true)
    try {
      const updates = product.product_units.map(u => ({
        id: u.id,
        unit_price: Number(editPrices[u.id] ?? u.unit_price)
      }))
      await TenantService.updateProductUnitPrices(updates)
      setEditingProductId(null)
      onProductsChanged()
      toast({ title: 'Prices updated!' })
    } catch (err: any) {
      toast({ title: 'Error updating prices', description: err.message, variant: 'destructive' })
    } finally {
      setSavingPrices(false)
    }
  }

  return (
    <Card className="border shadow-sm">
      <CardContent className="pt-6 space-y-6">
        <div className="flex items-center gap-2 font-semibold text-lg border-b pb-2">
          <Package className="h-5 w-5 text-amber-600" />
          <span>Product Catalog & Unit Pricing</span>
        </div>

        {/* Add Product Form */}
        <div className="bg-muted/40 p-4 rounded-lg space-y-4 border">
          <h4 className="font-medium text-sm text-foreground">Add New Catalog Product</h4>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="newProdName">Product Name</Label>
              <Input
                id="newProdName"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                placeholder="e.g. Rice (50kg)"
              />
            </div>

            <div className="space-y-2">
              <Label>Units & Standard Pricing</Label>
              {units.map((unit, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select
                    value={unit.unit_label}
                    onChange={(e) => {
                      const copy = [...units]
                      copy[idx].unit_label = e.target.value
                      setUnits(copy)
                    }}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {UNIT_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    placeholder="Price (₦)"
                    value={unit.unit_price}
                    onChange={(e) => {
                      const copy = [...units]
                      copy[idx].unit_price = e.target.value
                      setUnits(copy)
                    }}
                  />
                  {units.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setUnits(units.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4 text-rose-500" />
                    </Button>
                  )}
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1"
                onClick={() => setUnits([...units, emptyUnit()])}
              >
                <Plus className="h-4 w-4 mr-1" /> Add Unit Pricing
              </Button>
            </div>

            {productError && <p className="text-xs text-rose-500">{productError}</p>}

            <Button
              onClick={addProduct}
              disabled={addingProduct}
              className="bg-amber-600 hover:bg-amber-700 text-white w-full md:w-auto"
            >
              {addingProduct ? 'Adding...' : 'Save Product to Catalog'}
            </Button>
          </div>
        </div>

        {/* Existing Products List */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-foreground">Catalog Products ({products.length})</h4>
          <div className="divide-y border rounded-lg overflow-hidden">
            {products.map(prod => {
              const isEditing = editingProductId === prod.id
              return (
                <div key={prod.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card">
                  <div>
                    <span className="font-semibold text-foreground">{prod.name}</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {prod.product_units?.map(u => (
                        <span key={u.id} className="text-xs bg-muted px-2.5 py-1 rounded-md text-muted-foreground border">
                          {u.unit_label}: {isEditing ? (
                            <Input
                              type="number"
                              className="w-20 h-6 inline-block text-xs ml-1"
                              value={editPrices[u.id] ?? u.unit_price}
                              onChange={(e) => setEditPrices({ ...editPrices, [u.id]: e.target.value })}
                            />
                          ) : (
                            `₦${Number(u.unit_price).toLocaleString()}`
                          )}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 self-end md:self-auto">
                    {isEditing ? (
                      <>
                        <Button size="sm" onClick={() => saveEditedPrices(prod)} disabled={savingPrices}>
                          <Save className="h-4 w-4 mr-1" /> Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingProductId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => startEditPrices(prod)}>
                        <Pencil className="h-4 w-4 mr-1" /> Edit Prices
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
