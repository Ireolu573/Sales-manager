import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Search, History } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface Props { tenantId: string; onBack: () => void }
type Movement = { id: string; kind: 'Restocked' | 'Sold' | 'Adjusted'; name: string; quantity: number; unit: string; date: string; detail: string }
type Filter = 'All' | 'Restocked' | 'Sold' | 'Adjusted'

export default function StockHistoryScreen({ tenantId, onBack }: Props) {
  const [rows, setRows] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('All')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true); setError('')
      const [stock, sales] = await Promise.all([
        supabase.from('stock_records').select('id,item_name,quantity,unit_label,stock_date,notes,created_at').eq('tenant_id', tenantId).order('stock_date', { ascending: false }).limit(300),
        supabase.from('sales').select('id,item_name,quantity,unit_label,sale_date,customer_name,created_at').eq('tenant_id', tenantId).order('sale_date', { ascending: false }).limit(300),
      ])
      if (!active) return
      if (stock.error || sales.error) {
        setError(stock.error?.message || sales.error?.message || 'Unable to load stock history.')
        setLoading(false); return
      }
      const received: Movement[] = (stock.data || []).map(row => { const detail = row.notes || 'Stock received'; const adjusted = /\b(adjust|adjusted|adjustment)\b/i.test(detail); return { id: 'stock-' + row.id, kind: adjusted ? 'Adjusted' as const : 'Restocked' as const, name: row.item_name, quantity: Number(row.quantity || 0), unit: row.unit_label || 'units', date: row.stock_date || row.created_at || new Date(0).toISOString(), detail } })
      const sold: Movement[] = (sales.data || []).map(row => ({ id: 'sale-' + row.id, kind: 'Sold', name: row.item_name, quantity: Number(row.quantity || 0), unit: row.unit_label || 'units', date: row.sale_date || row.created_at || new Date(0).toISOString(), detail: row.customer_name || 'Sale recorded' }))
      setRows([...received, ...sold].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [tenantId])

  const visible = useMemo(() => rows.filter(row => (filter === 'All' || row.kind === filter) && (row.name + ' ' + row.detail).toLowerCase().includes(search.trim().toLowerCase())), [rows, filter, search])

  return <div className="mx-auto w-full max-w-5xl space-y-5">
    <div className="flex items-center gap-3"><Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to inventory"><ArrowLeft className="h-5 w-5" /></Button><div><h1 className="text-xl font-bold">Stock history</h1><p className="text-sm text-muted-foreground">A record of stock received and products sold</p></div></div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {(['All', 'Restocked', 'Sold', 'Adjusted'] as Filter[]).map(value => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-xl border px-3 py-3 text-left transition-colors ${filter === value ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/50'}`}><span className="block text-xs text-muted-foreground">{value === 'All' ? 'All movements' : value}</span><span className="text-xl font-bold">{value === 'All' ? rows.length : rows.filter(row => row.kind === value).length}</span></button>)}
    </div>
    <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search products or notes..." className="h-11 bg-card pl-9" /></div>
    {loading ? <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Loading stock history…</CardContent></Card> : error ? <Card><CardContent className="py-8 text-sm text-destructive">{error}</CardContent></Card> : visible.length === 0 ? <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-center"><History className="h-8 w-8 text-muted-foreground" /><p className="font-medium">No matching movements</p><p className="text-sm text-muted-foreground">Stock receipts and completed sales will appear here.</p></CardContent></Card> : <div className="space-y-2">{visible.map(row => <Card key={row.id}><CardContent className="flex items-center gap-3 p-3 sm:p-4"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${row.kind === 'Restocked' ? 'bg-emerald-500/10 text-emerald-600' : row.kind === 'Adjusted' ? 'bg-amber-500/10 text-amber-700' : 'bg-primary/10 text-primary'}`}>{row.kind === 'Restocked' ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-semibold">{row.name}</span><Badge variant="outline" className={row.kind === 'Restocked' ? 'border-emerald-500/30 text-emerald-700' : row.kind === 'Adjusted' ? 'border-amber-500/30 text-amber-700' : ''}>{row.kind}</Badge></div><p className="mt-0.5 truncate text-xs text-muted-foreground">{row.detail}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(row.date).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p></div><div className={`shrink-0 text-right text-sm font-bold ${row.kind === 'Restocked' ? 'text-emerald-600' : row.kind === 'Adjusted' ? 'text-amber-700' : 'text-foreground'}`}>{row.kind === 'Restocked' ? '+' : row.kind === 'Adjusted' ? '±' : '−'}{row.quantity.toLocaleString()}<div className="text-[11px] font-normal text-muted-foreground">{row.unit}</div></div></CardContent></Card>)}</div>}
  </div>
}
