import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { Permissions, Sale } from '@/lib/types'
import { useStock } from '@/hooks/useStock'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowUpRight, Banknote, CalendarDays, CircleAlert, Package, Plus, ReceiptText, Users } from 'lucide-react'

interface Props {
  userId: string
  tenantId: string
  permissions: Permissions
  onSwitchTab: (tab: 'record' | 'history' | 'stock' | 'credit' | 'analytics') => void
}

const money = (amount: number) => `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`
const saleTime = (sale: Sale) => new Date(sale.created_at || sale.sale_date)

function SectionError({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="space-y-2 py-4 text-center" role="alert">
      <p className="text-sm text-destructive">Could not load {label}.</p>
      <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>
    </div>
  )
}

export default function DashboardOverview({ userId, tenantId, permissions, onSwitchTab }: Props) {
  // Inventory is intentionally scoped to the tenant, since stock belongs to the business.
  const {
    inventorySummary,
    isLoading: stockLoading,
    isError: stockError,
    refetch: refetchStock,
  } = useStock(tenantId)


  // Sales dashboard metrics are personal, including for administrators.
  const {
    data: sales = [],
    isLoading: salesLoading,
    isError: salesError,
    refetch: refetchSales,
  } = useQuery({
    queryKey: ['dashboard-sales', tenantId, userId],
    queryFn: async () => {
      const rows: Sale[] = []
      const pageSize = 1000
      let from = 0

      // The dashboard only needs this week's transactions. Fetch every page
      // so high-volume weeks never silently lose sales after the first 300 rows.
      while (true) {
        const { data, error } = await supabase.from('sales').select('*')
          .eq('tenant_id', tenantId)
          .eq('user_id', userId)
          .gte('created_at', startOfWeek.toISOString())
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1)
        if (error) throw error

        const page = (data || []) as Sale[]
        rows.push(...page)
        if (page.length < pageSize) break
        from += pageSize
      }

      return rows
    },
    enabled: !!tenantId && !!userId,
    staleTime: 30_000,
  })

  const {
    data: creditData,
    isLoading: creditLoading,
    isError: creditError,
    refetch: refetchCredit,
  } = useQuery({
    queryKey: ['dashboard-credit', tenantId, userId],
    queryFn: async () => {
      const [{ data: creditSales, error: salesError }, { data: payments, error: paymentsError }] = await Promise.all([
        supabase.from('sales').select('id, customer_name, total_amount')
          .eq('tenant_id', tenantId)
          .eq('user_id', userId)
          .eq('payment_method', 'credit'),
        (supabase as any).from('credit_payments').select('sale_id, amount').eq('tenant_id', tenantId),
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
      const topOwing = (creditSales || []).map(sale => ({
        customer: sale.customer_name || 'Walk-in customer',
        balance: Math.max(0, Number(sale.total_amount) - (paidBySale[sale.id] || 0)),
      })).filter(item => item.balance > 0).reduce((acc, item) => {
        const existing = acc.find(entry => entry.customer === item.customer)
        if (existing) existing.balance += item.balance
        else acc.push({ ...item })
        return acc
      }, [] as { customer: string; balance: number }[]).sort((a, b) => b.balance - a.balance).slice(0, 4)
      return { outstanding, customerCount: owingCustomers.size, topOwing }
    },
    enabled: !!tenantId && !!userId,
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
          {permissions.can_add_stock && (
            <Button variant="outline" onClick={() => onSwitchTab('stock')} className="gap-2">
              <Package className="h-4 w-4" /> Add stock
            </Button>
          )}
          {permissions.can_record_sales && (
            <Button onClick={() => onSwitchTab('record')} className="gap-2">
              <Plus className="h-4 w-4" /> Record sale
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Banknote className="h-4 w-4" /> Today's sales</div>
          {salesLoading ? <p className="mt-3 text-sm text-muted-foreground">Loading sales...</p> : salesError ? (
            <SectionError label="sales" onRetry={() => { void refetchSales() }} />
          ) : <><p className="mt-3 text-2xl font-bold tabular-nums">{money(todayRevenue)}</p><p className="mt-1 text-xs text-muted-foreground">{todaySales.length} sales recorded today</p></>}
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="h-4 w-4" /> Sales this week</div>
          {salesLoading ? <p className="mt-3 text-sm text-muted-foreground">Loading sales...</p> : salesError ? (
            <SectionError label="sales" onRetry={() => { void refetchSales() }} />
          ) : <><p className="mt-3 text-2xl font-bold tabular-nums">{money(weekRevenue)}</p><p className="mt-1 text-xs text-muted-foreground">{weekSales.length} sales this week</p></>}
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4" /> Owed to you</div>
          {creditLoading ? <p className="mt-3 text-sm text-muted-foreground">Loading credit...</p> : creditError ? (
            <SectionError label="credit balances" onRetry={() => { void refetchCredit() }} />
          ) : <><p className="mt-3 text-2xl font-bold tabular-nums">{money(creditData?.outstanding ?? 0)}</p><p className="mt-1 text-xs text-muted-foreground">{creditData?.customerCount ?? 0} customers</p></>}
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><CircleAlert className="h-4 w-4" /> Low stock</div>
          {stockLoading ? <p className="mt-3 text-sm text-muted-foreground">Loading stock...</p> : stockError ? (
            <SectionError label="stock" onRetry={() => { void refetchStock() }} />
          ) : <><p className="mt-3 text-2xl font-bold tabular-nums">{lowStockCount} items</p><p className="mt-1 text-xs text-muted-foreground">Review stock levels</p></>}
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-5">
              <div><h2 className="font-semibold">Sales this week</h2><p className="text-xs text-muted-foreground mt-1">Daily recorded sales</p></div>
              {!salesLoading && !salesError && <span className="text-sm font-semibold">{money(weekRevenue)}</span>}
            </div>
            {salesLoading ? <p className="text-sm text-muted-foreground">Loading sales chart...</p> : salesError ? (
              <SectionError label="sales chart" onRetry={() => { void refetchSales() }} />
            ) : <div className="h-44 flex items-end gap-3">
              {weekBars.map(day => (
                <div key={day.label} className="flex-1 h-full flex flex-col items-center justify-end gap-2">
                  <span className="text-[10px] text-muted-foreground">{day.amount ? money(day.amount) : ''}</span>
                  <div className="w-full max-w-12 rounded-t-md bg-emerald-600/80 min-h-1 transition-all"
                    style={{ height: `${day.amount ? Math.max(5, day.amount / maxBar * 100) : 2}%` }} />
                  <span className="text-xs text-muted-foreground">{day.label}</span>
                </div>
              ))}
            </div>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div><h2 className="font-semibold">Low stock</h2><p className="text-xs text-muted-foreground mt-1">Products to review</p></div>
              {(permissions.can_view_stock || permissions.can_add_stock) && (
                <Button variant="ghost" size="sm" onClick={() => onSwitchTab('stock')} className="gap-1">View all <ArrowUpRight className="h-3 w-3" /></Button>
              )}
            </div>
            {stockLoading ? <p className="text-sm text-muted-foreground">Loading stock...</p> : stockError ? (
              <SectionError label="stock" onRetry={() => { void refetchStock() }} />
            ) : lowStock.length === 0 ? (
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="mb-4"><h2 className="font-semibold">Customers who owe you</h2><p className="mt-1 text-xs text-muted-foreground">Largest outstanding balances</p></div>
            {creditLoading ? <p className="py-5 text-sm text-muted-foreground">Loading credit balances...</p> : creditError ? (
              <SectionError label="credit balances" onRetry={() => { void refetchCredit() }} />
            ) : !creditData?.topOwing.length ? <p className="py-5 text-sm text-muted-foreground">No outstanding customer balances.</p> : (
              <div className="divide-y divide-border">
                {creditData.topOwing.map(customer => (
                  <div key={customer.customer} className="flex items-center justify-between gap-3 py-3">
                    <span className="truncate text-sm font-medium">{customer.customer}</span>
                    <span className="shrink-0 text-sm font-semibold text-amber-700">₦{customer.balance.toLocaleString('en-NG')}</span>
                  </div>
                ))}
              </div>
            )}
            {permissions.can_manage_credit && (
              <Button variant="ghost" size="sm" onClick={() => onSwitchTab('credit')} className="mt-2 px-0">View customers <ArrowUpRight className="ml-1 h-3 w-3" /></Button>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="mb-4"><h2 className="font-semibold">Decision support</h2><p className="mt-1 text-xs text-muted-foreground">Items that need attention</p></div>
            <div className="space-y-3">
              <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Low or out of stock</span><span className="text-sm font-semibold">{stockLoading ? '...' : stockError ? 'Unavailable' : lowStockCount}</span></div>
              <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Customers with balances</span><span className="text-sm font-semibold">{creditLoading ? '...' : creditError ? 'Unavailable' : creditData?.customerCount ?? 0}</span></div>
              <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Sales recorded today</span><span className="text-sm font-semibold">{salesLoading ? '...' : salesError ? 'Unavailable' : todaySales.length}</span></div>
            </div>
            {(stockError || creditError || salesError) && (
              <p className="mt-3 text-xs text-destructive">Some decision-support figures could not be loaded.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div><h2 className="font-semibold">Recent sales</h2><p className="text-xs text-muted-foreground mt-1">Your latest transactions</p></div>
            {permissions.can_view_history && (
              <Button variant="ghost" size="sm" onClick={() => onSwitchTab('history')} className="gap-1">View all <ArrowUpRight className="h-3 w-3" /></Button>
            )}
          </div>
          {salesLoading ? <p className="text-sm text-muted-foreground">Loading sales...</p> : salesError ? (
            <SectionError label="recent sales" onRetry={() => { void refetchSales() }} />
          ) : recentSales.length === 0 ? (
            <div className="py-8 text-center">
              <ReceiptText className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No sales recorded yet.</p>
              {permissions.can_record_sales && <Button size="sm" className="mt-3" onClick={() => onSwitchTab('record')}>Record your first sale</Button>}
            </div>
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
