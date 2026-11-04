import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStock } from '@/hooks/useStock'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowRight,
  Package,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Boxes,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Settings2,
  Plus,
  Search,
  CalendarClock,
  Eye,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

interface Props {
  tenantId: string
  isAdmin?: boolean
  onOpenSettings?: () => void
  onSwitchTab?: (tab: 'stock' | 'record' | 'history' | 'analytics' | 'credit' | 'leaderboard') => void
}

type StatusFilter = 'all' | 'out_of_stock' | 'low_stock' | 'in_stock'

export default function InventoryOverview({ tenantId, onOpenSettings, onSwitchTab }: Props) {
  const { inventorySummary, isLoading } = useStock(tenantId)
  const [unitsMap, setUnitsMap] = useState<Record<string, string>>({})
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedItem, setSelectedItem] = useState<any | null>(null)
  const [movements, setMovements] = useState<Array<{ id: string; kind: 'Restocked' | 'Sold'; quantity: number; unit: string; date: string; detail: string }>>([])
  const [movementLoading, setMovementLoading] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    setShowAll(false)
  }, [activeFilter])

  const entries = useMemo(() => {
    const unique = new Map<string, (typeof inventorySummary)[string]>()
    Object.values(inventorySummary || {}).forEach(item => {
      const key = item.productId || item.itemName.trim().toLowerCase()
      if (!unique.has(key)) unique.set(key, item)
    })
    return Array.from(unique.values())
  }, [inventorySummary])

  const handleGoToStock = () => {
    if (onSwitchTab) {
      onSwitchTab('stock')
    } else {
      navigate('/?tab=stock')
    }
  }

  useEffect(() => {
    const productIds = Object.values(inventorySummary || {})
      .map((r: any) => r.productId)
      .filter(Boolean)

    if (!productIds || productIds.length === 0) return

    const loadUnits = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, unit_label')
        .in('id', productIds)
      if (error) {
        console.error('[InventoryOverview] failed to load product units', error)
        return
      }
      const map: Record<string, string> = {}
      if (Array.isArray(data)) {
        for (const p of data as any[]) {
          map[p.id] = p.unit_label || ''
        }
      }
      setUnitsMap(map)
    }
    loadUnits()
  }, [inventorySummary])

  const totalProducts = entries.length
  const healthyCount = entries.filter(e => e.status === 'in_stock').length
  const lowCount = entries.filter(e => e.status === 'low_stock').length
  const outCount = entries.filter(e => e.status === 'out_of_stock').length

  const filteredAndSorted = useMemo(() => {
    const order: Record<string, number> = { out_of_stock: 0, low_stock: 1, in_stock: 2 }
    let list = [...entries]

    if (activeFilter !== 'all') {
      list = list.filter((e: any) => e.status === activeFilter)
    }
    const term = search.trim().toLowerCase()
    if (term) list = list.filter((e: any) => e.itemName.toLowerCase().includes(term))

    return list.sort((a: any, b: any) => {
      const byStatus = (order[a.status] ?? 3) - (order[b.status] ?? 3)
      if (byStatus !== 0) return byStatus
      return (a.itemName || '').localeCompare(b.itemName || '')
    })
  }, [entries, activeFilter, search])

  const visibleItems = showAll ? filteredAndSorted : filteredAndSorted.slice(0, 8)

  useEffect(() => {
    if (!selectedItem?.productId) { setMovements([]); return }
    let active = true
    setMovementLoading(true)
    Promise.all([
      supabase.from('stock_records').select('id, quantity, unit_label, stock_date, notes').eq('tenant_id', tenantId).eq('product_id', selectedItem.productId).order('stock_date', { ascending: false }).limit(5),
      supabase.from('sales').select('id, quantity, unit_label, sale_date, customer_name').eq('tenant_id', tenantId).eq('product_id', selectedItem.productId).order('sale_date', { ascending: false }).limit(5),
    ]).then(([stockResult, salesResult]) => {
      if (!active) return
      const stock = (stockResult.data || []).map(row => ({ id: row.id, kind: 'Restocked' as const, quantity: Number(row.quantity || 0), unit: row.unit_label || 'units', date: row.stock_date, detail: row.notes || 'Stock received' }))
      const sales = (salesResult.data || []).map(row => ({ id: row.id, kind: 'Sold' as const, quantity: Number(row.quantity || 0), unit: row.unit_label || 'units', date: row.sale_date, detail: row.customer_name || 'Sale recorded' }))
      setMovements([...stock, ...sales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6))
      setMovementLoading(false)
    }).catch(() => { if (active) setMovementLoading(false) })
    return () => { active = false }
  }, [selectedItem, tenantId])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-foreground text-lg tracking-tight">Inventory Overview</h2>
            <p className="text-xs text-muted-foreground">Real-time stock metrics and health monitoring</p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs font-medium h-9 border-border/70 hover:bg-accent hover:border-border transition-all duration-200"
          onClick={handleGoToStock}
        >
          View Inventory <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Interactive Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Total Items */}
        <button
          type="button"
          onClick={() => setActiveFilter('all')}
          className={`text-left transition-all duration-200 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            activeFilter === 'all' ? 'ring-2 ring-primary scale-[1.02]' : 'hover:scale-[1.01]'
          }`}
        >
          <Card className={`border-border/50 shadow-xs transition-colors duration-200 ${activeFilter === 'all' ? 'bg-primary/5 border-primary/30' : 'bg-card/60 hover:bg-accent/50'}`}>
            <CardContent className="p-3 flex items-center gap-2.5">
              <div className="w-8.5 h-8.5 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground shrink-0">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-muted-foreground">Total Items</div>
                <div className="text-base font-bold text-foreground leading-tight">{totalProducts}</div>
              </div>
            </CardContent>
          </Card>
        </button>

        {/* Healthy */}
        <button
          type="button"
          onClick={() => setActiveFilter('in_stock')}
          className={`text-left transition-all duration-200 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
            activeFilter === 'in_stock' ? 'ring-2 ring-emerald-500 scale-[1.02]' : 'hover:scale-[1.01]'
          }`}
        >
          <Card className={`border-border/50 shadow-xs transition-colors duration-200 ${activeFilter === 'in_stock' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-card/60 hover:bg-accent/50'}`}>
            <CardContent className="p-3 flex items-center gap-2.5">
              <div className="w-8.5 h-8.5 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-muted-foreground">Healthy</div>
                <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 leading-tight">{healthyCount}</div>
              </div>
            </CardContent>
          </Card>
        </button>

        {/* Low Stock */}
        <button
          type="button"
          onClick={() => setActiveFilter('low_stock')}
          className={`text-left transition-all duration-200 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
            activeFilter === 'low_stock' ? 'ring-2 ring-amber-500 scale-[1.02]' : 'hover:scale-[1.01]'
          }`}
        >
          <Card className={`border-border/50 shadow-xs transition-colors duration-200 ${activeFilter === 'low_stock' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-card/60 hover:bg-accent/50'}`}>
            <CardContent className="p-3 flex items-center gap-2.5">
              <div className="w-8.5 h-8.5 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-muted-foreground">Low Stock</div>
                <div className="text-base font-bold text-amber-600 dark:text-amber-400 leading-tight">{lowCount}</div>
              </div>
            </CardContent>
          </Card>
        </button>

        {/* Out of Stock */}
        <button
          type="button"
          onClick={() => setActiveFilter('out_of_stock')}
          className={`text-left transition-all duration-200 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive ${
            activeFilter === 'out_of_stock' ? 'ring-2 ring-destructive scale-[1.02]' : 'hover:scale-[1.01]'
          }`}
        >
          <Card className={`border-border/50 shadow-xs transition-colors duration-200 ${activeFilter === 'out_of_stock' ? 'bg-destructive/10 border-destructive/30' : 'bg-card/60 hover:bg-accent/50'}`}>
            <CardContent className="p-3 flex items-center gap-2.5">
              <div className="w-8.5 h-8.5 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive shrink-0">
                <XCircle className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-muted-foreground">Out of Stock</div>
                <div className="text-base font-bold text-destructive leading-tight">{outCount}</div>
              </div>
            </CardContent>
          </Card>
        </button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search feeds, chicks, drugs..."
          aria-label="Search inventory"
          className="h-11 rounded-xl border-border bg-card pl-9"
        />
      </div>

      {/* Product List Header & Filter Indicator */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          Showing {visibleItems.length} of {filteredAndSorted.length} {activeFilter !== 'all' ? activeFilter.replace(/_/g, ' ') : 'total'} items
        </span>
        {activeFilter !== 'all' && (
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className="text-primary font-medium hover:underline text-xs transition-colors duration-150"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Product List */}
      {isLoading ? (
        <Card className="border-border/50">
          <CardContent className="py-10 text-center text-xs text-muted-foreground">Loading inventory overview…</CardContent>
        </Card>
      ) : entries.length === 0 ? (
        /* Empty state: no products exist for this tenant */
        <Card className="border-border/50 bg-card/60">
          <CardContent className="py-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-muted/80 flex items-center justify-center mx-auto text-muted-foreground">
              <Package className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold text-foreground">No products in your catalog</div>
              <div className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Add products in your Product Catalog & Unit Pricing panel first, then add stock to start tracking inventory.
              </div>
            </div>
            <div className="flex items-center justify-center gap-2.5 flex-wrap pt-1">
              {onOpenSettings && (
                <Button
                  size="sm"
                  variant="default"
                  className="gap-2 text-xs font-medium transition-transform duration-150 active:scale-95 shadow-xs"
                  onClick={onOpenSettings}
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  Product Catalog & Unit Pricing
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="gap-2 text-xs font-medium transition-transform duration-150 active:scale-95"
                onClick={handleGoToStock}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Stock
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : filteredAndSorted.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-8 text-center text-xs text-muted-foreground">
            No products match the selected filter ({activeFilter.replace(/_/g, ' ')}).
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {visibleItems.map((row: any) => {
            const unit = unitsMap[row.productId] || ''
            const total = Number(row.totalStock || 0)
            const available = Number(row.availableStock || 0)
            const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((available / total) * 100))) : 0
            const isOut = row.status === 'out_of_stock'
            const isLow = row.status === 'low_stock'

            return (
              <Card
                key={row.productId || row.itemName}
                className={`border-border/50 hover:border-border/80 transition-all duration-200 hover:shadow-xs ${
                  isOut ? 'border-destructive/20 bg-destructive/5' : isLow ? 'border-amber-500/20 bg-amber-500/5' : 'bg-card/80'
                }`}
              >
                <CardContent className="p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    {/* Item Name & Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground truncate">{row.itemName}</span>
                        {isOut && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-destructive/30 bg-destructive/10 text-destructive font-medium shrink-0">
                            Out of stock
                          </Badge>
                        )}
                        {isLow && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium shrink-0">
                            Low stock
                          </Badge>
                        )}
                        {row.status === 'in_stock' && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium shrink-0">
                            In stock
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Total: {total.toLocaleString()} {unit} • Sold: {Number(row.totalSold || 0).toLocaleString()} {unit}
                      </div>
                    </div>

                    {/* Primary Focus: Remaining Available Quantity */}
                    <div className="text-right shrink-0">
                      <div className={`text-lg font-bold tracking-tight leading-none ${
                        isOut
                          ? 'text-destructive'
                          : isLow
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-foreground'
                      }`}>
                        {available.toLocaleString()}
                      </div>
                      <div className="text-[10px] font-medium text-muted-foreground mt-0.5 uppercase tracking-wider">
                        {unit || 'units'} left
                      </div>
                    </div>
                  </div>

                  {/* Stock Health Progress Bar */}
                  <div className="space-y-1">
                    <div className="h-1.5 bg-muted/80 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${
                          isOut
                            ? 'bg-destructive'
                            : isLow
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Product details action */}
                  <div className="flex justify-end pt-0.5">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setSelectedItem(row)}>
                      <Eye className="mr-1 h-3 w-3" /> Details
                    </Button>
                  </div>

                  {/* Restock Button: shown on out_of_stock and low_stock products */}
                  {(isOut || isLow) && (
                    <div className="pt-0.5 flex justify-end">
                      <Button
                        variant={isOut ? 'default' : 'outline'}
                        size="sm"
                        className={`h-7 px-3 gap-1.5 text-xs font-medium transition-all duration-200 active:scale-95 ${
                          isOut
                            ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xs'
                            : 'border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
                        }`}
                        onClick={handleGoToStock}
                      >
                        <RotateCcw className="w-3 h-3" />
                        Restock Product
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}

          {/* Toggle Expand / Collapse */}
          {filteredAndSorted.length > 8 && (
            <div className="pt-2 text-center">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors duration-200"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? (
                  <>Show top 8 items <ChevronUp className="w-3.5 h-3.5" /></>
                ) : (
                  <>Show all {filteredAndSorted.length} items <ChevronDown className="w-3.5 h-3.5" /></>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
      <Dialog open={Boolean(selectedItem)} onOpenChange={open => { if (!open) setSelectedItem(null) }}>
        <DialogContent className="max-h-[88vh] w-[calc(100%-1rem)] overflow-y-auto rounded-2xl sm:max-w-lg">
          {selectedItem && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">{selectedItem.itemName}</DialogTitle>
                <DialogDescription>Current stock position and recent inventory activity</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-muted/60 p-3"><p className="text-xs text-muted-foreground">Available</p><p className="mt-1 text-lg font-bold">{Number(selectedItem.availableStock || 0).toLocaleString()}</p></div>
                <div className="rounded-xl bg-muted/60 p-3"><p className="text-xs text-muted-foreground">Received</p><p className="mt-1 text-lg font-bold">{Number(selectedItem.totalStock || 0).toLocaleString()}</p></div>
                <div className="rounded-xl bg-muted/60 p-3"><p className="text-xs text-muted-foreground">Sold</p><p className="mt-1 text-lg font-bold">{Number(selectedItem.totalSold || 0).toLocaleString()}</p></div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between"><h3 className="font-semibold">Recent movement</h3><CalendarClock className="h-4 w-4 text-muted-foreground" /></div>
                {movementLoading ? <p className="py-5 text-center text-sm text-muted-foreground">Loading activity…</p> : movements.length ? movements.map(movement => (
                  <div key={movement.id} className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-0">
                    <div className="min-w-0"><p className="text-sm font-medium">{movement.kind} · {movement.detail}</p><p className="text-xs text-muted-foreground">{new Date(movement.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p></div>
                    <p className="shrink-0 text-sm font-semibold">{movement.kind === 'Sold' ? '−' : '+'}{movement.quantity} {movement.unit}</p>
                  </div>
                )) : <p className="py-4 text-sm text-muted-foreground">No recent movement found for this product.</p>}
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => setSelectedItem(null)}>Close</Button>
                <Button onClick={() => { setSelectedItem(null); handleGoToStock() }}><RotateCcw className="mr-2 h-4 w-4" /> Record restock</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
