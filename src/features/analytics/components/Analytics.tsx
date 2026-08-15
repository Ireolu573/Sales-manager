import { useState, useMemo } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { Sale, StockRecord } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Download, BarChart3, FileText, FileSpreadsheet } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { exportSalesReport } from '@/lib/exportUtils'
import { exportPdfReport } from '@/lib/exportPdf'
import { useAuth } from '@/hooks/useAuth'

import AnalyticsCards from '@/components/analytics/AnalyticsCards'
import AnalyticsCharts from '@/components/analytics/AnalyticsCharts'
import { SkeletonAnalytics } from '@/components/ui/loading-skeletons'
import WeekOverWeek from '@/components/analytics/WeekOverWeek'

interface Props {
  userId: string
  tenantId: string
  isAdmin: boolean
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function Analytics({ userId, tenantId, isAdmin }: Props) {
  const { company } = useAuth()
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [filterMode, setFilterMode] = useState<'month' | 'range'>('month')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

  const { data: sales = [], isLoading: loadingSales } = useQuery({
    queryKey: ['sales', tenantId, userId, isAdmin],
    queryFn: async () => {
      const query = isAdmin
        ? supabase.from('sales').select('*').eq('tenant_id', tenantId).order('sale_date', { ascending: false })
        : supabase.from('sales').select('*').eq('user_id', userId).eq('tenant_id', tenantId).order('sale_date', { ascending: false })
      const { data, error } = await query
      if (error) throw error
      return (data || []) as Sale[]
    },
    enabled: !!tenantId,
  })

  const { data: stockRecords = [], isLoading: loadingStock } = useQuery({
    queryKey: ['stock', tenantId, userId, isAdmin],
    queryFn: async () => {
      const query = isAdmin
        ? supabase.from('stock_records').select('*').eq('tenant_id', tenantId).order('stock_date', { ascending: false })
        : supabase.from('stock_records').select('*').eq('user_id', userId).eq('tenant_id', tenantId).order('stock_date', { ascending: false })
      const { data, error } = await query
      if (error) throw error
      return (data || []) as StockRecord[]
    },
    enabled: !!tenantId,
  })

  const loading = loadingSales || loadingStock

  const inRange = (dateStr: string) => {
    if (filterMode === 'month') {
      const d = new Date(dateStr)
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear
    }
    const from = dateFrom || '2000-01-01'
    const to = dateTo || '2099-12-31'
    return dateStr >= from && dateStr <= to
  }

  const monthSales = useMemo(() => sales.filter(s => inRange(s.sale_date)), [sales, filterMode, selectedMonth, selectedYear, dateFrom, dateTo])
  const monthStock = useMemo(() => stockRecords.filter(s => inRange(s.stock_date)), [stockRecords, filterMode, selectedMonth, selectedYear, dateFrom, dateTo])

  const totalRevenue = monthSales.reduce((sum, s) => sum + Number(s.total_amount), 0)
  const totalQty = monthSales.reduce((sum, s) => sum + Number(s.quantity), 0)
  const totalStockCost = monthStock.reduce((sum, s) => sum + Number(s.total_cost), 0)

  // COGS is allocated at the moment a transaction is recorded, using the
  // server's weighted-average inventory cost. It must not be recalculated
  // from the current reporting window or historic reports will drift.
  const totalCOGS = monthSales.reduce((sum, sale) => sum + Number(sale.cogs_amount || 0), 0)

  const grossProfit = totalRevenue - totalCOGS
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

  const cashRevenue = monthSales.filter(s => s.payment_method === 'cash').reduce((s, c) => s + Number(c.total_amount), 0)
  const transferRevenue = monthSales.filter(s => s.payment_method === 'transfer').reduce((s, c) => s + Number(c.total_amount), 0)
  const posRevenue = monthSales.filter(s => s.payment_method === 'pos').reduce((s, c) => s + Number(c.total_amount), 0)
  const creditRevenue = monthSales.filter(s => s.payment_method === 'credit').reduce((s, c) => s + Number(c.total_amount), 0)
  const outstandingCredit = monthSales.filter(s => s.payment_method === 'credit' && !s.paid_at).reduce((s, c) => s + Number(c.total_amount), 0)

  const paymentPieData = [
    { name: 'Cash', value: cashRevenue, color: 'hsl(142, 71%, 45%)' },
    { name: 'Transfer', value: transferRevenue, color: 'hsl(217, 91%, 60%)' },
    { name: 'POS', value: posRevenue, color: 'hsl(280, 65%, 60%)' },
    { name: 'Credit', value: creditRevenue, color: 'hsl(38, 92%, 50%)' },
  ].filter(d => d.value > 0)

  const topProducts = useMemo(() => {
    const byItem: Record<string, { qty: number; revenue: number }> = {}
    monthSales.forEach(s => {
      if (!byItem[s.item_name]) byItem[s.item_name] = { qty: 0, revenue: 0 }
      byItem[s.item_name].qty += Number(s.quantity)
      byItem[s.item_name].revenue += Number(s.total_amount)
    })
    return Object.entries(byItem)
      .map(([name, v]) => ({ name, revenue: v.revenue, qty: v.qty }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [monthSales])

  const maxRevenue = topProducts[0]?.revenue || 1

  const dailyData = useMemo(() => {
    const byDay: Record<number, number> = {}
    monthSales.forEach(s => {
      const d = new Date(s.sale_date).getDate()
      byDay[d] = (byDay[d] || 0) + Number(s.total_amount)
    })
    return Object.entries(byDay)
      .map(([day, revenue]) => ({ day: `${day}`, revenue }))
      .sort((a, b) => Number(a.day) - Number(b.day))
  }, [monthSales])

  const periodLabel = filterMode === 'month'
    ? `${MONTHS[selectedMonth]} ${selectedYear}`
    : `${dateFrom || '…'} to ${dateTo || '…'}`

  const handleExportExcel = async (exportAll: boolean) => {
    setExporting(true)
    try {
      await exportSalesReport({
        sales, stockRecords, monthSales, monthStock,
        selectedMonth, selectedYear, filterMode, dateFrom, dateTo, exportAll,
      })
    } finally { setExporting(false) }
  }

  const handleExportPdf = async () => {
    setExportingPdf(true)
    try {
      await exportPdfReport({
        sales: monthSales,
        stockRecords: monthStock,
        periodLabel,
        companyName: company.company_name,
        appName: company.app_name,
        brandColor: company.brand_color,
      })
    } finally { setExportingPdf(false) }
  }

  const years = Array.from(new Set([
    ...sales.map(s => new Date(s.sale_date).getFullYear()),
    ...stockRecords.map(s => new Date(s.stock_date).getFullYear()),
    selectedYear,
  ])).sort().reverse()

  if (loading) {
    return <SkeletonAnalytics />
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-bold text-foreground text-lg">Analytics</h2>
          <p className="text-sm text-muted-foreground">Business performance insights</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex bg-muted rounded-lg p-0.5 w-fit">
            <button onClick={() => setFilterMode('month')}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-all ${filterMode === 'month' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}>
              By month
            </button>
            <button onClick={() => setFilterMode('range')}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-all ${filterMode === 'range' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}>
              Date range
            </button>
          </div>

          {filterMode === 'month' ? (
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-auto" />
              <span className="text-muted-foreground text-sm">to</span>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-auto" />
            </div>
          )}

          {/* Export row — Excel + PDF side by side */}
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => handleExportExcel(false)} size="sm" variant="outline" className="gap-1.5" disabled={exporting}>
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              {exporting ? 'Exporting…' : 'Excel'}
            </Button>
            <Button onClick={() => handleExportExcel(true)} size="sm" variant="outline" className="gap-1.5" disabled={exporting}>
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Full year
            </Button>
            <Button onClick={handleExportPdf} size="sm" className="gap-1.5 bg-red-600 hover:bg-red-700 text-white" disabled={exportingPdf}>
              <FileText className="w-3.5 h-3.5" />
              {exportingPdf ? 'Generating…' : `PDF Report`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Week-over-week (shows on any filter mode — always uses live sales data) ── */}
      <WeekOverWeek sales={sales} />

      <AnalyticsCards
        totalRevenue={totalRevenue} totalQty={totalQty}
        totalStockCost={totalStockCost} grossProfit={grossProfit}
        grossMargin={grossMargin} outstandingCredit={outstandingCredit}
      />

      <AnalyticsCharts
        topProducts={topProducts} maxRevenue={maxRevenue}
        dailyData={dailyData} paymentPieData={paymentPieData}
      />
    </div>
  )
}

export default Analytics
