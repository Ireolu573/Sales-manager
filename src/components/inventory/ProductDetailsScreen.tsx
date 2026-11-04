import { useEffect, useState } from 'react'
import { ArrowLeft, CalendarClock, Package, RotateCcw, TrendingDown, TrendingUp } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type InventoryItem = {
  productId?: string
  itemName: string
  availableStock: number
  totalStock: number
  totalSold: number
  status: string
}

type Movement = {
  id: string
  kind: 'Restocked' | 'Sold'
  quantity: number
  unit: string
  date: string
  detail: string
}

interface Props {
  tenantId: string
  item: InventoryItem
  onBack: () => void
  onRestock: (productId: string) => void
}

export default function ProductDetailsScreen({ tenantId, item, onBack, onRestock }: Props) {
  const [product, setProduct] = useState<{ category: string; low_stock_threshold: number; unit_label: string | null; unit_price: number | null } | null>(null)
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      if (!item.productId) {
        setMovements([])
        setLoading(false)
        return
      }
      const [productResult, stockResult, salesResult] = await Promise.all([
        supabase.from('products').select('category, low_stock_threshold, product_units(unit_label, unit_price, base_unit_quantity)').eq('tenant_id', tenantId).eq('id', item.productId).maybeSingle(),
        supabase.from('stock_records').select('id, quantity, unit_label, stock_date, created_at, notes').eq('tenant_id', tenantId).eq('product_id', item.productId).order('stock_date', { ascending: false }).limit(8),
        supabase.from('sales').select('id, quantity, unit_label, sale_date, created_at, customer_name').eq('tenant_id', tenantId).eq('product_id', item.productId).order('sale_date', { ascending: false }).limit(8),
      ])
      if (!active) return
      if (productResult.data) {
        const primaryUnit = productResult.data.product_units?.[0]
        setProduct({
          category: productResult.data.category,
          low_stock_threshold: productResult.data.low_stock_threshold,
          unit_label: primaryUnit?.unit_label || null,
          unit_price: primaryUnit?.unit_price ?? null,
        })
      }
      const received: Movement[] = (stockResult.data || []).map(row => ({
        id: 'stock-' + row.id, kind: 'Restocked', quantity: Number(row.quantity || 0),
        unit: row.unit_label || 'units', date: row.stock_date || row.created_at || '',
        detail: row.notes || 'Stock received',
      }))
      const sold: Movement[] = (salesResult.data || []).map(row => ({
        id: 'sale-' + row.id, kind: 'Sold', quantity: Number(row.quantity || 0),
        unit: row.unit_label || 'units', date: row.sale_date || row.created_at || '',
        detail: row.customer_name || 'Sale recorded',
      }))
      setMovements([...received, ...sold].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8))
      setLoading(false)
    }
    load().catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [tenantId, item.productId])

  const statusLabel = item.status === 'out_of_stock' ? 'Out of stock' : item.status === 'low_stock' ? 'Low stock' : 'In stock'
  const statusVariant = item.status === 'out_of_stock' ? 'destructive' : 'secondary'

  return (
    <section className="mx-auto w-full max-w-5xl space-y-5 pb-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="outline" size="icon" onClick={onBack} aria-label="Back to inventory"><ArrowLeft className="h-4 w-4" /></Button>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Package className="h-5 w-5" /></div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Inventory / Product details</p>
            <h1 className="truncate text-xl font-bold text-foreground">{item.itemName}</h1>
          </div>
        </div>
        {item.productId && <Button onClick={() => onRestock(item.productId!)} className="gap-2"><RotateCcw className="h-4 w-4" /> Restock</Button>}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={statusVariant}>{statusLabel}</Badge>
        {product?.category && <Badge variant="outline">{product.category}</Badge>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Available stock</p><p className="mt-1 text-2xl font-bold tabular-nums">{Number(item.availableStock || 0).toLocaleString()} <span className="text-sm font-medium text-muted-foreground">{product?.unit_label || 'units'}</span></p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total received</p><p className="mt-1 text-2xl font-bold tabular-nums">{Number(item.totalStock || 0).toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total sold</p><p className="mt-1 text-2xl font-bold tabular-nums">{Number(item.totalSold || 0).toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Low-stock alert</p><p className="mt-1 text-2xl font-bold tabular-nums">{product?.low_stock_threshold ?? '—'}</p></CardContent></Card>
      </div>

      <Card><CardContent className="grid gap-4 p-4 sm:grid-cols-2">
        <div><p className="text-sm text-muted-foreground">Selling price</p><p className="mt-1 text-xl font-semibold">{product?.unit_price == null ? 'Not set' : '₦' + Number(product.unit_price).toLocaleString()}</p></div>
        <div><p className="text-sm text-muted-foreground">Stock status</p><p className="mt-1 text-sm font-medium">{statusLabel}{product?.low_stock_threshold != null ? ' · Alert at ' + product.low_stock_threshold : ''}</p></div>
      </CardContent></Card>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between"><div><h2 className="font-semibold">Recent stock movement</h2><p className="text-sm text-muted-foreground">Latest receipts and sales for this product</p></div><CalendarClock className="h-5 w-5 text-muted-foreground" /></div>
          {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading product activity…</p> : movements.length ? movements.map(movement => (
            <div key={movement.id} className="flex items-center justify-between gap-3 border-t border-border py-3 first:border-0">
              <div className="flex min-w-0 items-center gap-3">
                <span className={movement.kind === 'Sold' ? 'rounded-lg bg-amber-500/10 p-2 text-amber-700' : 'rounded-lg bg-emerald-500/10 p-2 text-emerald-700'}>{movement.kind === 'Sold' ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}</span>
                <div className="min-w-0"><p className="truncate text-sm font-medium">{movement.kind} · {movement.detail}</p><p className="text-xs text-muted-foreground">{movement.date ? new Date(movement.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date unavailable'}</p></div>
              </div>
              <p className="shrink-0 text-sm font-semibold">{movement.kind === 'Sold' ? '−' : '+'}{movement.quantity.toLocaleString()} {movement.unit}</p>
            </div>
          )) : <p className="py-8 text-center text-sm text-muted-foreground">No recent movement found for this product.</p>}
        </CardContent></Card>
    </section>
  )
}
