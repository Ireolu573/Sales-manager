import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { Sale, StockRecord } from '@/lib/types'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Download, TrendingUp, Package, Banknote, ShoppingCart, TrendingDown, BarChart3 } from 'lucide-react'

interface Props {
  userId: string
  tenantId: string
  isAdmin: boolean
  refreshKey: number
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function Analytics({ userId, tenantId, isAdmin, refreshKey }: Props) {
  const [sales, setSales] = useState<Sale[]>([])
  const [stockRecords, setStockRecords] = useState<StockRecord[]>([])
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [filterMode, setFilterMode] = useState<'month' | 'range'>('month')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    setLoading(true)
    const salesQuery = isAdmin
      ? supabase.from('sales').select('*').eq('tenant_id', tenantId).order('sale_date', { ascending: false })
      : supabase.from('sales').select('*').eq('user_id', userId).eq('tenant_id', tenantId).order('sale_date', { ascending: false })
    const stockQuery = isAdmin
      ? supabase.from('stock_records').select('*').eq('tenant_id', tenantId).order('stock_date', { ascending: false })
      : supabase.from('stock_records').select('*').eq('user_id', userId).eq('tenant_id', tenantId).order('stock_date', { ascending: false })

    Promise.all([salesQuery, stockQuery]).then(([salesRes, stockRes]) => {
      if (salesRes.data) setSales(salesRes.data as unknown as Sale[])
      if (stockRes.data) setStockRecords(stockRes.data as unknown as StockRecord[])
      setLoading(false)
    })
  }, [userId, tenantId, isAdmin, refreshKey])

  const inRange = (dateStr: string) => {
    if (filterMode === 'month') {
      const d = new Date(dateStr)
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear
    }
    const from = dateFrom || '2000-01-01'
    const to = dateTo || '2099-12-31'
    return dateStr >= from && dateStr <= to
  }

  const monthSales = sales.filter(s => inRange(s.sale_date))
  const monthStock = stockRecords.filter(s => inRange(s.stock_date))

  const totalRevenue = monthSales.reduce((sum, s) => sum + Number(s.total_amount), 0)
  const totalQty = monthSales.reduce((sum, s) => sum + Number(s.quantity), 0)
  const totalStockCost = monthStock.reduce((sum, s) => sum + Number(s.total_cost), 0)
  const estimatedProfit = totalRevenue - totalStockCost

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

  const byItem: Record<string, { qty: number; revenue: number }> = {}
  monthSales.forEach(s => {
    if (!byItem[s.item_name]) byItem[s.item_name] = { qty: 0, revenue: 0 }
    byItem[s.item_name].qty += Number(s.quantity)
    byItem[s.item_name].revenue += Number(s.total_amount)
  })
  const topProducts = Object.entries(byItem)
    .map(([name, v]) => ({ name, revenue: v.revenue, qty: v.qty }))
    .sort((a, b) => b.revenue - a.revenue)

  const maxRevenue = topProducts[0]?.revenue || 1

  const byDay: Record<number, number> = {}
  monthSales.forEach(s => {
    const d = new Date(s.sale_date).getDate()
    byDay[d] = (byDay[d] || 0) + Number(s.total_amount)
  })
  const dailyData = Object.entries(byDay)
    .map(([day, revenue]) => ({ day: `${day}`, revenue }))
    .sort((a, b) => Number(a.day) - Number(b.day))

  const exportXLSX = async (all = false) => {
    setExporting(true)
    try {
      // Dynamically load SheetJS from CDN
      const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs' as any)

      const salesData = all ? sales : monthSales
      const stockData = all ? stockRecords : monthStock
      const period = all
        ? `${selectedYear}`
        : filterMode === 'month'
          ? `${MONTHS[selectedMonth]}-${selectedYear}`
          : `${dateFrom}-to-${dateTo}`

      // Sales sheet rows
      const salesRows = [
        ['Date', 'Time', 'Item', 'Unit', 'Quantity', 'Unit Price (N)', 'Total (N)', 'Payment', 'Customer', 'Paid At', 'Paid Via', 'Notes'],
        ...salesData.map(s => [
          s.sale_date,
          s.created_at ? new Date(s.created_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: true }) : '',
          s.item_name,
          s.unit_label || '',
          Number(s.quantity),
          Number(s.unit_price),
          Number(s.total_amount),
          s.payment_method,
          s.customer_name || '',
          s.paid_at ? new Date(s.paid_at).toLocaleDateString('en-GB') : '',
          s.paid_via || '',
          s.notes || '',
        ])
      ]

      // Stock sheet rows
      const stockRows = [
        ['Date', 'Item', 'Unit', 'Quantity', 'Cost Price (N)', 'Total Cost (N)', 'Notes'],
        ...stockData.map(s => [
          s.stock_date,
          s.item_name,
          s.unit_label || '',
          Number(s.quantity),
          Number(s.cost_price),
          Number(s.total_cost),
          s.notes || '',
        ])
      ]

      const wb = XLSX.utils.book_new()
      const salesSheet = XLSX.utils.aoa_to_sheet(salesRows)
      const stockSheet = XLSX.utils.aoa_to_sheet(stockRows)

      // Column widths
      salesSheet['!cols'] = [12, 10, 22, 8, 10, 16, 14, 12, 18, 12, 10, 22].map(w => ({ wch: w }))
      stockSheet['!cols'] = [12, 22, 8, 10, 16, 14, 22].map(w => ({ wch: w }))

      XLSX.utils.book_append_sheet(wb, salesSheet, 'Sales')
      XLSX.utils.book_append_sheet(wb, stockSheet, 'Stock Records')

      XLSX.writeFile(wb, `report-${period}.xlsx`)
    } catch (err) {
      console.error('Export failed:', err)
      alert('Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const years = Array.from(new Set([
    ...sales.map(s => new Date(s.sale_date).getFullYear()),
    ...stockRecords.map(s => new Date(s.stock_date).getFullYear()),
    selectedYear,
  ])).sort().reverse()

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 rounded-full border-4 border-muted animate-spin border-t-primary" />
      </div>
    )
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

          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => exportXLSX(false)} size="sm" className="gap-1.5" disabled={exporting}>
              <Download className="w-3.5 h-3.5" />
              {exporting ? 'Exporting...' : 'Export Period (.xlsx)'}
            </Button>
            <Button onClick={() => exportXLSX(true)} size="sm" variant="secondary" className="gap-1.5" disabled={exporting}>
              <Download className="w-3.5 h-3.5" />
              {exporting ? 'Exporting...' : 'Full Year (.xlsx)'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Banknote className="w-4 h-4 text-success" />
              <span className="text-xs text-muted-foreground">Revenue</span>
            </div>
            <p className="text-xl font-bold text-foreground">₦{totalRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="w-4 h-4 text-info" />
              <span className="text-xs text-muted-foreground">Items Sold</span>
            </div>
            <p className="text-xl font-bold text-foreground">{totalQty.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Stock Cost</span>
            </div>
            <p className="text-xl font-bold text-foreground">₦{totalStockCost.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className={`border-border/50 shadow-sm ${estimatedProfit >= 0 ? '' : 'border-destructive/20'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              {estimatedProfit >= 0
                ? <TrendingUp className="w-4 h-4 text-success" />
                : <TrendingDown className="w-4 h-4 text-destructive" />}
              <span className="text-xs text-muted-foreground">Est. Profit</span>
            </div>
            <p className={`text-xl font-bold ${estimatedProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
              ₦{Math.abs(estimatedProfit).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {outstandingCredit > 0 && (
        <Card className="border-warning/20 bg-warning/5 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Outstanding Credit</p>
            <p className="text-lg font-bold text-warning">₦{outstandingCredit.toLocaleString()}</p>
          </CardContent>
        </Card>
      )}

      {/* Top Products ranked list */}
      {topProducts.length > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">Top Products by Revenue</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {topProducts.map((product, index) => {
              const barWidth = Math.max((product.revenue / maxRevenue) * 100, 2)
              return (
                <div key={product.name}>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold w-5 text-right shrink-0 ${
                      index === 0 ? 'text-primary' :
                      index === 1 ? 'text-muted-foreground' :
                      index === 2 ? 'text-muted-foreground/70' :
                      'text-muted-foreground/50'
                    }`}>
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <span className="text-sm text-foreground truncate">{product.name}</span>
                        <span className="text-sm font-semibold text-primary shrink-0">
                          ₦{product.revenue.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-primary/10 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Daily Revenue chart */}
      {dailyData.length > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Daily Revenue</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(36, 20%, 90%)" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₦${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => `₦${v.toLocaleString()}`} />
                <Bar dataKey="revenue" fill="hsl(142, 71%, 45%)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Payment Methods pie */}
      {paymentPieData.length > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Payment Methods</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={paymentPieData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {paymentPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Legend />
                <Tooltip formatter={(v: number) => `₦${v.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}