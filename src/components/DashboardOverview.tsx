import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useStock } from '@/hooks/useStock'
import type { Sale } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowUpRight, Banknote, CalendarDays, CircleAlert, Package, Plus, ReceiptText, Users } from 'lucide-react'

interface Props {
  userId: string
  tenantId: string
  isAdmin: boolean
  onSwitchTab: (tab: 'record' | 'history' | 'stock' | 'credit' | 'analytics') => void
}

const money = (amount: number) => `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`
const saleTime = (sale: Sale) => new Date(sale.created_at || sale.sale_date)

export default function DashboardOverview({ userId, tenantId, isAdmin, onSwitchTab }: Props) {
  const { inventorySummary, isLoading: stockLoading } = useStock(tenantId)

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['dashboard-sales', tenantId, userId, isAdmin],
    queryFn: async () => {
      let query = supabase.from('sales').select('*').eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }).limit(300)
      if (!isAdmin) query = query.eq('user_id', userId)
      const { data, error } = await query
      if (error) throw error
      return (data || []) as Sale[]
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  })

  const { data: creditData } = useQuery({
    queryKey: ['dashboard-credit', tenantId],
    queryFn: async () => {
      const [{ data: creditSales, error: salesError }, { data: payments, error: paymentsError }] = await Promise.all([
        supabase.from('sales').select('id, customer_name, total_amount').eq('tenant_id', tenantId).eq('payment_method', 'credit'),
        supabase.from('credit_payments').select('sale_id, amount').eq('tenant_id', tenantId),
      ])
      if (salesError) throw salesError
      if (paymentsError) throw paymentsError
      const paidBySale = (payments || []).reduce((acc: Record<string, number>, row: { sale_id: string; amount: number }) => {
        acc[row.sale_id] = (acc[row.sale_id] || 0) + Number(row.amount)
        return acc
      }, {})
      const outstanding = (creditSales || []).reduce((sum, sale) =>
        sum + Math.max(0, Number(sale.total_amount) - (paidBySale[sale.id] || 0)), 0)
      const owingCustomers = new Set((creditSales || [])
        .filter(sale => Number(sale.total_amount) - (paidBySale[sale.id] || 0) > 0)
        .map(sale => sale.customer_name).filter(Boolean))
      return { outstanding, customerCount: owingCustomers.size }
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  })

  const now = new Date()
  const todayKey = now.toDateString()
  const startOfWeek = new Date(now)
  const mondayOffset = (now.getDay() + 6) % 7
  startOfWeek.setHours(0, 0, 0, 0)
  startOfWeek.setDate(now.getDate() - mondayOffset)
  const todaySales = sales.filter(sale => saleTime(sale).toDateString() === todayKey)
  const weekSales = sales.filter(sale => saleTime(sale) >= startOfWeek)
  const todayRevenue = todaySales.reduce((sum, sale) => sum + Number(sale.total_amount), 0)
  const weekRevenue = weekSales.reduce((sum, sale) => sum + Number(sale.total_amount), 0)
  const weekBars = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(startOfWeek)
    day.setDate(startOfWeek.getDate() + index)
    const amount = weekSales.filter(sale => saleTime(sale).toDateString() === day.toDateString())
      .reduce((sum, sale) => sum + Number(sale.total_amount), 0)
    return { label: day.toLocaleDateString('en-NG', { weekday: 'short' }), amount }
  })
  const maxBar = Math.max(1, ...weekBars.map(day => day.amount))
  const lowStock = Object.values(inventorySummary).filter(item => item.status !== 'in_stock')
    .sort((a, b) => a.availableBaseQuantity - b.availableBaseQuantity)
  const lowStockCount = lowStock.length
  const recentSales = sales.slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{now.toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onSwitchTab('stock')} className="gap-2">
            <Package className="h-4 w-4" /> Add stock
          </Button>
          <Button onClick={() => onSwitchTab('record')} className="gap-2">
            <Plus className="h-4 w-4" /> Record sale
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Banknote className="h-4 w-4" /> Today's sales</div>
          <p className="mt-3 text-2xl font-bold tabular-nums">{salesLoading ? '...' : money(todayRevenue)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{todaySales.length} sales recorded today</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="h-4 w-4" /> Sales this week</div>
          <p className="mt-3 text-2xl font-bold tabular-nums">{salesLoading ? '...' : money(weekRevenue)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{weekSales.length} sales this week</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4" /> Owed to you</div>
          <p className="mt-3 text-2xl font-bold tabular-nums">{money(creditData?.outstanding || 0)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{creditData?.customerCount || 0} customers</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><CircleAlert className="h-4 w-4" /> Low stock</div>
          <p className="mt-3 text-2xl font-bold tabular-nums">{stockLoading ? '...' : lowStockCount} items</p>
          <p className="mt-1 text-xs text-muted-foreground">Review stock levels</p>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-5">
              <div><h2 className="font-semibold">Sales this week</h2><p className="text-xs text-muted-foreground mt-1">Daily recorded sales</p></div>
              <span className="text-sm font-semibold">{money(weekRevenue)}</span>
            </div>
            <div className="h-44 flex items-end gap-3">
              {weekBars.map((day, index) => (
                <div key={day.label} className="flex-1 h-full flex flex-col items-center justify-end gap-2">
                  <span className="text-[10px] text-muted-foreground">{day.amount ? money(day.amount) : ''}</span>
                  <div className="w-full max-w-12 rounded-t-md bg-emerald-600/80 min-h-1 transition-all"
                    style={{ height: `${day.amount ? Math.max(5, day.amount / maxBar * 100) : 2}%` }} />
                  <span className="text-xs text-muted-foreground">{day.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div><h2 className="font-semibold">Low stock</h2><p className="text-xs text-muted-foreground mt-1">Products to review</p></div>
              <Button variant="ghost" size="sm" onClick={() => onSwitchTab('stock')} className="gap-1">View all <ArrowUpRight className="h-3 w-3" /></Button>
            </div>
            {stockLoading ? <p className="text-sm text-muted-foreground">Loading stock...</p> : lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground py-5">No low-stock products.</p>
            ) : <div className="space-y-3">
              {lowStock.slice(0, 4).map(item => (
                <div key={item.productId || item.itemName} className="flex items-center justify-between gap-3 border-b border-border last:border-0 pb-3 last:pb-0">
                  <div className="min-w-0"><p className="text-sm font-medium truncate">{item.itemName}</p><p className="text-xs text-muted-foreground">{item.availableBaseQuantity} units left</p></div>
                  <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-1 text-[10px] font-semibold dark:bg-amber-900/30 dark:text-amber-300">{item.status === 'out_of_stock' ? 'Out' : 'Low'}</span>
                </div>
              ))}
            </div>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div><h2 className="font-semibold">Recent sales</h2><p className="text-xs text-muted-foreground mt-1">Your latest transactions</p></div>
            <Button variant="ghost" size="sm" onClick={() => onSwitchTab('history')} className="gap-1">View all <ArrowUpRight className="h-3 w-3" /></Button>
          </div>
          {salesLoading ? <p className="text-sm text-muted-foreground">Loading sales...</p> : recentSales.length === 0 ? (
            <div className="py-8 text-center"><ReceiptText className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" /><p className="text-sm text-muted-foreground">No sales recorded yet.</p><Button size="sm" className="mt-3" onClick={() => onSwitchTab('record')}>Record your first sale</Button></div>
          ) : <div className="divide-y divide-border">
            {recentSales.map(sale => (
              <div key={sale.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0"><p className="text-sm font-medium truncate">{sale.customer_name || 'Walk-in customer'}</p><p className="text-xs text-muted-foreground truncate">{sale.quantity} {sale.unit_label} {sale.item_name}</p></div>
                <div className="text-right shrink-0"><p className="text-sm font-semibold">{money(Number(sale.total_amount))}</p><p className="text-xs text-muted-foreground capitalize">{sale.payment_method === 'credit' ? 'On credit' : sale.payment_method}</p></div>
              </div>
            ))}
          </div>}
        </CardContent>
      </Card>
    </div>
  )
}
