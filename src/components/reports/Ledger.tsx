import { useMemo } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { Sale, StockRecord, Expense } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowDownCircle, ArrowUpCircle, BookOpen } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useDateRangeFilter, yearsFromDates } from '@/hooks/useDateRangeFilter'
import ReportFilterBar from './ReportFilterBar'
import { SkeletonRowList } from '@/components/ui/loading-skeletons'

interface Props {
  tenantId: string
}

interface LedgerEntry {
  id: string
  date: string
  type: 'sale' | 'stock' | 'expense'
  label: string
  amount: number // positive = money in, negative = money out
}

export default function Ledger({ tenantId }: Props) {
  const {
    selectedMonth, setSelectedMonth, selectedYear, setSelectedYear,
    filterMode, setFilterMode, dateFrom, setDateFrom, dateTo, setDateTo,
    inRange, periodLabel,
  } = useDateRangeFilter()

  const { data: sales = [], isLoading: loadingSales } = useQuery({
    queryKey: ['ledger-sales', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from('sales').select('*').eq('tenant_id', tenantId).not('paid_at', 'is', null)
      if (error) throw error
      return (data || []) as Sale[]
    },
    enabled: !!tenantId,
  })

  const { data: stockRecords = [], isLoading: loadingStock } = useQuery({
    queryKey: ['ledger-stock', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from('stock_records').select('*').eq('tenant_id', tenantId)
      if (error) throw error
      return (data || []) as StockRecord[]
    },
    enabled: !!tenantId,
  })

  const { data: expenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ['ledger-expenses', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from('expenses').select('*').eq('tenant_id', tenantId)
      if (error) throw error
      return (data || []) as Expense[]
    },
    enabled: !!tenantId,
  })

  const loading = loadingSales || loadingStock || loadingExpenses

  const entries = useMemo(() => {
    const list: LedgerEntry[] = []

    sales.forEach(s => {
      const date = (s.paid_at as string).split('T')[0]
      if (!inRange(date)) return
      list.push({ id: `sale-${s.id}`, date, type: 'sale', label: `${s.item_name} — ${s.quantity}${s.unit_label ? ` ${s.unit_label}` : ''}`, amount: Number(s.total_amount) })
    })

    stockRecords.forEach(s => {
      if (!inRange(s.stock_date)) return
      list.push({ id: `stock-${s.id}`, date: s.stock_date, type: 'stock', label: `Stock: ${s.item_name}`, amount: -Number(s.total_cost) })
    })

    expenses.forEach(e => {
      if (!inRange(e.expense_date)) return
      list.push({ id: `expense-${e.id}`, date: e.expense_date, type: 'expense', label: e.description ? `${e.category}: ${e.description}` : e.category, amount: -Number(e.amount) })
    })

    return list.sort((a, b) => a.date.localeCompare(b.date))
  }, [sales, stockRecords, expenses, filterMode, selectedMonth, selectedYear, dateFrom, dateTo])

  let running = 0
  const withBalance = entries.map(e => { running += e.amount; return { ...e, balance: running } })

  const years = yearsFromDates([
    sales.filter(s => s.paid_at).map(s => s.paid_at as string),
    stockRecords.map(s => s.stock_date),
    expenses.map(e => e.expense_date),
  ], selectedYear)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-bold text-foreground text-lg">Ledger</h2>
          <p className="text-sm text-muted-foreground">{periodLabel}, every cash movement in order</p>
        </div>
      </div>

      <ReportFilterBar
        filterMode={filterMode} setFilterMode={setFilterMode}
        selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
        selectedYear={selectedYear} setSelectedYear={setSelectedYear}
        dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo}
        years={years}
      />

      {loading ? (
        <SkeletonRowList count={5} />
      ) : withBalance.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center text-muted-foreground text-sm">No transactions in this period</CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {withBalance.map(e => (
            <Card key={e.id} className="border-border/50 shadow-sm">
              <CardContent className="p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {e.amount >= 0
                      ? <ArrowDownCircle className="w-5 h-5 text-green-600 shrink-0" />
                      : <ArrowUpCircle className="w-5 h-5 text-destructive shrink-0" />}
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-foreground truncate">{e.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`font-bold text-sm ${e.amount >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                      {e.amount >= 0 ? '+' : '-'}₦{Math.abs(e.amount).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">Bal ₦{e.balance.toLocaleString()}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
