import { useState, useMemo } from 'react'
import { SkeletonRowList } from '@/components/ui/loading-skeletons'
import { supabase } from '@/integrations/supabase/client'
import type { Sale } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Trash2, Search, FileText, TrendingUp, ChevronDown, ChevronUp, Calendar, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useQuery, useQueryClient } from '@tanstack/react-query'

interface Props {
  userId: string
  tenantId: string
  isAdmin: boolean
}

interface SaleWithStaff extends Sale {
  staff_email?: string
}

const PAYMENT_CONFIG: Record<string, { label: string; className: string; icon: string }> = {
  cash:     { label: 'Cash',     className: 'bg-success/10 text-success border-success/20',   icon: '💵' },
  transfer: { label: 'Transfer', className: 'bg-info/10 text-info border-info/20',             icon: '🏦' },
  pos:      { label: 'POS',      className: 'bg-primary/10 text-primary border-primary/20',   icon: '💳' },
  credit:   { label: 'Credit',   className: 'bg-warning/10 text-warning border-warning/20',   icon: '📋' },
}

const FILTER_OPTIONS = ['All', 'Cash', 'Transfer', 'POS', 'Credit'] as const
type FilterOption = typeof FILTER_OPTIONS[number]

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined })
}

function groupByDate(sales: SaleWithStaff[]) {
  const groups: Record<string, SaleWithStaff[]> = {}
  for (const sale of sales) {
    const ts = sale.created_at || sale.sale_date
    const key = new Date(ts).toDateString()
    if (!groups[key]) groups[key] = []
    groups[key].push(sale)
  }
  return Object.entries(groups).map(([key, sales]) => ({
    dateKey: key,
    label: formatDate(new Date(key).toISOString()),
    sales,
  }))
}

export default function SalesTable({ userId, tenantId, isAdmin }: Props) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterOption>('All')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [timeFrom, setTimeFrom] = useState('')
  const [timeTo, setTimeTo] = useState('')

  const hasDateFilter = !!(dateFrom || dateTo || timeFrom || timeTo)

  const { data: sales = [], isLoading: loading } = useQuery({
    queryKey: ['sales', tenantId],
    queryFn: async () => {
      const query = isAdmin
        ? supabase.from('sales').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(500)
        : supabase.from('sales').select('*').eq('user_id', userId).eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(500)

      const { data: salesData } = await query
      if (!salesData) return []

      if (isAdmin) {
        const { data: profiles } = await supabase.from('profiles').select('id, email').eq('tenant_id', tenantId)
        const emailMap: Record<string, string> = {}
        profiles?.forEach(p => { if (p.id && p.email) emailMap[p.id] = p.email })
        return (salesData as unknown as SaleWithStaff[]).map(s => ({ ...s, staff_email: emailMap[s.user_id || ''] || undefined }))
      }
      return salesData as unknown as SaleWithStaff[]
    }
  })

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this sale record?')) return
    setDeletingId(id)
    const { error } = await supabase.from('sales').delete().eq('id', id)
    setDeletingId(null)
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      queryClient.invalidateQueries({ queryKey: ['sales', tenantId] })
      setExpandedId(null)
      toast({ title: 'Sale deleted' })
    }
  }

  const clearDateFilter = () => { setDateFrom(''); setDateTo(''); setTimeFrom(''); setTimeTo('') }

  const filtered = useMemo(() => {
    return sales.filter(s => {
      const matchesSearch =
        s.item_name.toLowerCase().includes(search.toLowerCase()) ||
        s.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        s.staff_email?.toLowerCase().includes(search.toLowerCase()) ||
        s.payment_method.toLowerCase().includes(search.toLowerCase())

      const matchesPayment = filter === 'All' || s.payment_method.toLowerCase() === filter.toLowerCase()

      let matchesDate = true
      if (hasDateFilter) {
        const ts = new Date(s.created_at || s.sale_date)
        const dateStr = ts.toISOString().split('T')[0]
        const timeStr = ts.toTimeString().slice(0, 5)
        if (dateFrom && dateStr < dateFrom) matchesDate = false
        if (dateTo && dateStr > dateTo) matchesDate = false
        if (timeFrom && timeStr < timeFrom) matchesDate = false
        if (timeTo && timeStr > timeTo) matchesDate = false
      }

      return matchesSearch && matchesPayment && matchesDate
    })
  }, [sales, search, filter, dateFrom, dateTo, timeFrom, timeTo, hasDateFilter])

  const totalRevenue = useMemo(() => filtered.reduce((sum, s) => sum + Number(s.total_amount), 0), [filtered])
  const todayRevenue = useMemo(() => {
    const today = new Date().toDateString()
    return sales.filter(s => new Date(s.created_at || s.sale_date).toDateString() === today).reduce((sum, s) => sum + Number(s.total_amount), 0)
  }, [sales])

  const grouped = useMemo(() => groupByDate(filtered), [filtered])

  return (
    <div className="space-y-4">

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-bold text-foreground text-lg">Sales History</h2>
          <p className="text-sm text-muted-foreground">{sales.length} records total</p>
        </div>
      </div>

      {!loading && sales.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-primary/5 border border-primary/15 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs text-muted-foreground font-medium">Today</span>
            </div>
            <div className="font-bold text-foreground text-base">₦{todayRevenue.toLocaleString()}</div>
          </div>
          <div className="bg-muted/60 border border-border/50 rounded-xl p-3">
            <div className="mb-1">
              <span className="text-xs text-muted-foreground font-medium">
                {hasDateFilter ? 'Filtered' : filter === 'All' ? 'Showing' : filter} total
              </span>
            </div>
            <div className="font-bold text-foreground text-base">₦{totalRevenue.toLocaleString()}</div>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={isAdmin ? 'Search item, customer, or staff…' : 'Search item or customer…'}
          className="pl-10" />
      </div>

      {/* Payment pills + date filter button */}
      <div className="flex items-center gap-2">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-1">
          {FILTER_OPTIONS.map(opt => (
            <button key={opt} onClick={() => setFilter(opt)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                filter === opt ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-background text-muted-foreground border-border hover:border-primary/40'
              }`}>
              {opt !== 'All' && PAYMENT_CONFIG[opt.toLowerCase()]?.icon + ' '}{opt}
            </button>
          ))}
        </div>
        <button onClick={() => setShowDateFilter(v => !v)}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
            hasDateFilter ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/40'
          }`}>
          <Calendar className="w-3.5 h-3.5" />
          {hasDateFilter ? 'Filtered' : 'Date'}
        </button>
      </div>

      {/* Date/time filter panel */}
      {showDateFilter && (
        <div className="bg-muted/40 border border-border/60 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filter by Date & Time</span>
            {hasDateFilter && (
              <button onClick={clearDateFilter} className="text-xs text-primary flex items-center gap-1">
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">From date</label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">To date</label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">From time</label>
              <Input type="time" value={timeFrom} onChange={e => setTimeFrom(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">To time</label>
              <Input type="time" value={timeTo} onChange={e => setTimeTo(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          {hasDateFilter && (
            <p className="text-xs text-muted-foreground">Showing {filtered.length} sale{filtered.length !== 1 ? 's' : ''} in range</p>
          )}
        </div>
      )}

      {loading ? (
        <SkeletonRowList count={5} />
      ) : filtered.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-14 text-center">
            <div className="text-3xl mb-3">🔍</div>
            <p className="text-muted-foreground text-sm">No sales found</p>
            {(search || filter !== 'All' || hasDateFilter) && (
              <button onClick={() => { setSearch(''); setFilter('All'); clearDateFilter() }} className="text-primary text-sm mt-2 underline underline-offset-2">
                Clear all filters
              </button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {grouped.map(group => (
            <div key={group.dateKey}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group.label}</span>
                <div className="flex-1 h-px bg-border/60" />
                <span className="text-xs text-muted-foreground">₦{group.sales.reduce((s, r) => s + Number(r.total_amount), 0).toLocaleString()}</span>
              </div>

              <div className="space-y-2">
                {group.sales.map(sale => {
                  const isExpanded = expandedId === sale.id
                  const payConfig = PAYMENT_CONFIG[sale.payment_method] || PAYMENT_CONFIG.cash
                  const isCredit = sale.payment_method === 'credit'
                  const isPaid = !!sale.paid_at
                  const recordedTime = formatTime(sale.created_at || sale.sale_date)

                  return (
                    <Card key={sale.id} className={`border-border/50 shadow-sm overflow-hidden transition-all ${isCredit && !isPaid ? 'border-warning/30 bg-warning/[0.03]' : ''}`}>
                      <button className="w-full text-left" onClick={() => setExpandedId(isExpanded ? null : sale.id)}>
                        <CardContent className="p-3.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0 ${
                                payConfig.className.includes('success') ? 'bg-success/10' :
                                payConfig.className.includes('info') ? 'bg-info/10' :
                                payConfig.className.includes('warning') ? 'bg-warning/10' : 'bg-primary/10'
                              }`}>{payConfig.icon}</div>
                              <div className="min-w-0">
                                <div className="font-semibold text-foreground text-sm truncate">{sale.item_name}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {sale.quantity} {sale.unit_label}{sale.customer_name && <span> · {sale.customer_name}</span>}
                                </div>
                                <div className="text-xs text-muted-foreground/60 mt-0.5">{recordedTime}</div>
                                {isAdmin && sale.staff_email && (
                                  <div className="text-xs text-muted-foreground/70 mt-0.5 truncate">by {sale.staff_email}</div>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end shrink-0 gap-1">
                              <div className="font-bold text-foreground text-sm">₦{Number(sale.total_amount).toLocaleString()}</div>
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className={`text-xs py-0 px-1.5 ${payConfig.className}`}>{payConfig.label}</Badge>
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                              </div>
                            </div>
                          </div>

                          {isCredit && !isPaid && (
                            <div className="mt-2.5 flex items-center gap-1.5 text-warning">
                              <div className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                              <span className="text-xs font-medium">Unpaid credit</span>
                            </div>
                          )}
                          {isCredit && isPaid && (
                            <div className="mt-2.5 flex items-center gap-1.5 text-success">
                              <div className="w-1.5 h-1.5 rounded-full bg-success" />
                              <span className="text-xs font-medium">
                                Paid {sale.paid_at ? new Date(sale.paid_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                                {sale.paid_via ? ` via ${sale.paid_via}` : ''}
                              </span>
                            </div>
                          )}
                        </CardContent>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-border/50 bg-muted/30 px-3.5 py-3 space-y-3">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            <div>
                              <div className="text-xs text-muted-foreground">Unit price</div>
                              <div className="text-sm font-medium">₦{Number(sale.unit_price).toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Quantity</div>
                              <div className="text-sm font-medium">{sale.quantity} {sale.unit_label}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Payment</div>
                              <div className="text-sm font-medium capitalize">{sale.payment_method}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Recorded</div>
                              <div className="text-sm font-medium">
                                {new Date(sale.created_at || sale.sale_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {recordedTime}
                              </div>
                            </div>
                            {sale.customer_name && (
                              <div className="col-span-2">
                                <div className="text-xs text-muted-foreground">Customer</div>
                                <div className="text-sm font-medium">{sale.customer_name}</div>
                              </div>
                            )}
                            {isAdmin && sale.staff_email && (
                              <div className="col-span-2">
                                <div className="text-xs text-muted-foreground">Recorded by</div>
                                <div className="text-sm font-medium">{sale.staff_email}</div>
                              </div>
                            )}
                            {sale.notes && (
                              <div className="col-span-2">
                                <div className="text-xs text-muted-foreground">Notes</div>
                                <div className="text-sm">{sale.notes}</div>
                              </div>
                            )}
                          </div>
                          {isAdmin && (
                            <Button variant="destructive" size="sm" className="w-full h-8 text-xs gap-1.5"
                              disabled={deletingId === sale.id} onClick={() => handleDelete(sale.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                              {deletingId === sale.id ? 'Deleting…' : 'Delete this sale'}
                            </Button>
                          )}
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
