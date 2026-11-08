import { useState, useEffect } from 'react'
import { getProductsForTenant, insertStockRecord, getStockRecordsForUser } from '@/lib/tenant-queries'
import { supabase } from '@/integrations/supabase/client'
import type { Product, ProductUnit, StockRecord } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Package, PlusCircle, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { SkeletonRowList } from '@/components/ui/loading-skeletons'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface Props {
  userId: string
  tenantId: string
  isAdmin: boolean
}

export default function StockForm({ userId, tenantId, isAdmin }: Props) {
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [records, setRecords] = useState<StockRecord[]>([])
  const [productId, setProductId] = useState('')
  const [selectedUnit, setSelectedUnit] = useState<ProductUnit | null>(null)
  const [quantity, setQuantity] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [stockDate, setStockDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [recordsLoading, setRecordsLoading] = useState(true)

  const totalCost = Number(quantity) * Number(costPrice) || 0
  const selectedProduct = products.find(p => p.id === productId)
  const units = selectedProduct?.product_units || []

  const fetchRecords = () => {
    setRecordsLoading(true)
    getStockRecordsForUser(userId, tenantId).then(({ data }) => {
      if (data) setRecords(data as unknown as StockRecord[])
      setRecordsLoading(false)
    })
  }

  useEffect(() => {
    getProductsForTenant(tenantId).then(({ data }) => { if (data) setProducts(data) })
    fetchRecords()
  }, [userId, tenantId])

  const handleProductChange = (id: string) => {
    setProductId(id)
    setSelectedUnit(null)
    const product = products.find(p => p.id === id)
    if (product?.product_units?.length) setSelectedUnit(product.product_units[0])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduct) return
    setLoading(true)

    const { error } = await insertStockRecord({
      product_id: productId,
      item_name: selectedProduct.name,
      unit_label: selectedUnit?.unit_label || null,
      quantity: Number(quantity),
      cost_price: Number(costPrice),
      stock_date: stockDate,
      notes: notes || null,
    }, tenantId, userId)

    setLoading(false)

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Stock recorded!', description: `${selectedProduct.name} — ₦${totalCost.toLocaleString()}` })
      setQuantity(''); setCostPrice(''); setNotes(''); setSelectedUnit(null); setProductId('')
      fetchRecords()
    }
  }

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const { error } = await supabase.from('stock_records').delete().eq('id', id)
    setDeletingId(null)
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      setRecords(prev => prev.filter(r => r.id !== id))
      toast({ title: 'Stock record deleted' })
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Inventory workspace</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Stock management</h1>
          <p className="mt-1 text-sm text-slate-500">Record incoming stock, track purchase costs and review recent entries.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
          <Package className="h-3.5 w-3.5 text-emerald-700" /> Inventory records
        </div>
      </div>

      {isAdmin && (
        <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4 md:p-7">
            <div className="mb-5 border-b border-slate-200 pb-4"><h2 className="text-lg font-bold text-slate-900">Record incoming stock</h2><p className="mt-1 text-sm text-slate-500">Enter the product, quantity and cost details for this delivery.</p></div><form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label>Product</Label>
                <Select value={productId} onValueChange={handleProductChange}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {productId && units.length > 0 && (
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <div className="flex flex-wrap gap-2">
                    {units.map(u => (
                      <button key={u.id} type="button" onClick={() => setSelectedUnit(u)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                          selectedUnit?.id === u.id
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                        }`}>
                        {u.unit_label}
                        {u.unit_price ? <span className="ml-1.5 opacity-70 text-xs">₦{Number(u.unit_price).toLocaleString()}</span> : null}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" required />
                </div>
                <div className="space-y-2">
                  <Label>Cost Price (₦)</Label>
                  <Input type="number" min="0" step="0.01" value={costPrice} onChange={e => setCostPrice(e.target.value)} placeholder="0.00" required />
                </div>
              </div>

              {totalCost > 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                  <span className="text-sm text-muted-foreground">Total Cost: </span>
                  <span className="text-xl font-bold text-primary">₦{totalCost.toLocaleString()}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={stockDate} onChange={e => setStockDate(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. supplier name, batch info" />
              </div>

              <Button type="submit" disabled={loading || !productId || !quantity || !costPrice} className="h-12 w-full gap-2 rounded-xl bg-emerald-700 font-semibold text-white hover:bg-emerald-800">
                <PlusCircle className="w-4 h-4" />
                {loading ? 'Recording...' : 'Add Stock'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Stock records as cards */}
      {recordsLoading ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Recent Stock Entries</p>
          <SkeletonRowList count={3} />
        </div>
      ) : records.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Recent Stock Entries</p>
          {records.map(r => (
            <Card key={r.id} className="border-border/50 shadow-sm">
              <CardContent className="p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-foreground truncate">{r.item_name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {r.quantity}{r.unit_label ? ` ${r.unit_label}` : ' units'} ·{' '}
                        {new Date(r.stock_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      {r.notes && <div className="text-xs text-muted-foreground/70 mt-0.5 truncate">{r.notes}</div>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="text-right">
                      <div className="font-bold text-sm text-foreground">₦{Number(r.total_cost).toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">₦{Number(r.cost_price).toLocaleString()}/unit</div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => setConfirmDeleteId(r.id)}
                        disabled={deletingId === r.id}
                        className="text-destructive/60 hover:text-destructive transition-colors p-1 rounded-lg hover:bg-destructive/10 disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!recordsLoading && records.length === 0 && !isAdmin && (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center text-muted-foreground text-sm">No stock records yet</CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete this stock record?"
        description="This removes the stock entry permanently. This can't be undone."
        confirmLabel="Delete record"
        onConfirm={() => { if (confirmDeleteId) handleDelete(confirmDeleteId); setConfirmDeleteId(null) }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}