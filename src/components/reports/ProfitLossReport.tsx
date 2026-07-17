import { useMemo } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { Sale, StockRecord, Expense } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useDateRangeFilter, yearsFromDates } from '@/hooks/useDateRangeFilter'
import ReportFilterBar from './ReportFilterBar'
import { SkeletonAnalytics } from '@/components/ui/loading-skeletons'

interface Props {
  tenantId: string
}

export default function ProfitLossReport({ tenantId }: Props) {
  const {
    selectedMonth, setSelectedMonth, selectedYear, setSelectedYear,
    filterMode, setFilterMode, dateFrom, setDateFrom, dateTo, setDateTo,
    inRange, periodLabel,
  } = useDateRangeFilter()

  const { data: sales = [], isLoading: loadingSales } = useQuery({
    queryKey: ['pl-sales', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from('sales').select('*').eq('tenant_id', tenantId).not('paid_at', 'is', null)
      if (error) throw error
      return (data || []) as Sale[]
    },
    enabled: !!tenantId,
  })

  const { data: stockRecords = [], isLoading: loadingStock } = useQuery({
    queryKey: ['pl-stock', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from('stock_records').select('*').eq('tenant_id', tenantId)
      if (error) throw error
      return (data || []) as StockRecord[]
    },
    enabled: !!tenantId,
  })

  const { data: expenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ['pl-expenses', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from('expenses').select('*').eq('tenant_id', tenantId)
      if (error) throw error
      return (data || []) as Expense[]
    },
    enabled: !!tenantId,
  })

  const loading = loadingSales || loadingStock || loadingExpenses

  // Cash basis: revenue is recognized when it was actually paid, not when the sale happened.
  const periodSales = useMemo(
    () => sales.filter(s => s.paid_at && inRange(s.paid_at.split('T')[0])),
    [sales, filterMode, selectedMonth, selectedYear, dateFrom, dateTo]
  )
  const periodStock = useMemo(
    () => stockRecords.filter(s => inRange(s.stock_date)),
    [stockRecords, filterMode, selectedMonth, selectedYear, dateFrom, dateTo]
  )
  const periodExpenses = useMemo(
    () => expenses.filter(e => inRange(e.expense_date)),
    [expenses, filterMode, selectedMonth, selectedYear, dateFrom, dateTo]
  )

  const revenue = periodSales.reduce((sum, s) => sum + Number(s.total_amount), 0)
  const cogs = periodStock.reduce((sum, s) => sum + Number(s.total_cost), 0)
  const grossProfit = revenue - cogs
  const totalExpenses = periodExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const netProfit = grossProfit - totalExpenses

  const expensesByCategory = useMemo(() => {
    const byCat: Record<string, number> = {}
    periodExpenses.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount) })
    return Object.entries(byCat).sort((a, b) => b[1] - a[1])
  }, [periodExpenses])

  const years = yearsFromDates([
    sales.filter(s => s.paid_at).map(s => s.paid_at as string),
    stockRecords.map(s => s.stock_date),
    expenses.map(e => e.expense_date),
  ], selectedYear)

  if (loading) return <SkeletonAnalytics />

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-bold text-foreground text-lg">Profit &amp; Loss</h2>
        <p className="text-sm text-muted-foreground">Cash basis — {periodLabel}</p>
      </div>

      <ReportFilterBar
        filterMode={filterMode} setFilterMode={setFilterMode}
        selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
        selectedYear={selectedYear} setSelectedYear={setSelectedYear}
        dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo}
        years={years}
      />

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-5 space-y-3">
          <Row label="Revenue" value={revenue} />
          <Row label="Cost of goods sold" value={-cogs} muted />
          <div className="border-t border-border/60 pt-3">
            <Row label="Gross profit" value={grossProfit} bold />
          </div>

          {expensesByCategory.length > 0 && (
            <div className="pl-3 space-y-1.5 border-l-2 border-border/40 ml-1">
              {expensesByCategory.map(([cat, amt]) => (
                <Row key={cat} label={cat} value={-amt} small muted />
              ))}
            </div>
          )}
          <Row label="Total expenses" value={-totalExpenses} muted />

          <div className="border-t-2 border-border pt-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground">Net profit</span>
              <span className={`flex items-center gap-1.5 font-bold text-lg ${netProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                {netProfit >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                ₦{Math.abs(netProfit).toLocaleString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground px-1">
        Revenue counts money actually received in this period, including credit sales once paid. Credit sales still outstanding aren't counted yet.
      </p>
    </div>
  )
}

function Row({ label, value, bold, muted, small }: { label: string; value: number; bold?: boolean; muted?: boolean; small?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`${small ? 'text-xs' : 'text-sm'} ${muted ? 'text-muted-foreground' : 'text-foreground'} ${bold ? 'font-bold' : ''}`}>{label}</span>
      <span className={`${small ? 'text-xs' : 'text-sm'} font-mono ${value < 0 ? 'text-destructive' : 'text-foreground'} ${bold ? 'font-bold text-base' : ''}`}>
        {value < 0 ? '-' : ''}₦{Math.abs(value).toLocaleString()}
      </span>
    </div>
  )
}
