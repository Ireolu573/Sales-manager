/**
 * WeekOverWeek.tsx
 * Shows this week vs last week: revenue, transaction count, avg order value.
 * Includes a small sparkline bar chart comparing day-by-day.
 */
import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { Sale } from '@/lib/types'

interface Props { sales: Sale[] }

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getWeekBounds(weeksAgo: number) {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const startOfThisWeek = new Date(now)
  startOfThisWeek.setDate(now.getDate() - dayOfWeek)
  startOfThisWeek.setHours(0, 0, 0, 0)

  const start = new Date(startOfThisWeek)
  start.setDate(startOfThisWeek.getDate() - weeksAgo * 7)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function filterByWeek(sales: Sale[], weeksAgo: number) {
  const { start, end } = getWeekBounds(weeksAgo)
  return sales.filter(s => {
    const d = new Date(s.sale_date)
    return d >= start && d <= end
  })
}

function weekRevenue(sales: Sale[]) {
  return sales.reduce((s, r) => s + Number(r.total_amount), 0)
}

function weekDayData(sales: Sale[], weeksAgo: number) {
  const { start } = getWeekBounds(weeksAgo)
  const byDay = Array(7).fill(0)
  for (const s of sales) {
    const d = new Date(s.sale_date)
    const dow = d.getDay()
    byDay[dow] += Number(s.total_amount)
  }
  return DAYS.map((day, i) => {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    return { day, revenue: byDay[i], date: date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) }
  })
}

interface StatPillProps {
  label: string
  thisWeek: number | string
  lastWeek: number | string
  format?: (v: number) => string
  raw: { this: number; last: number }
}

function StatPill({ label, thisWeek, lastWeek, raw }: StatPillProps) {
  const delta = raw.last === 0 ? (raw.this > 0 ? 100 : 0) : ((raw.this - raw.last) / raw.last) * 100
  const up = delta > 0
  const flat = Math.abs(delta) < 0.5

  return (
    <div className="flex-1 min-w-0 bg-muted/50 rounded-xl p-3">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-base font-bold text-foreground tabular-nums truncate">{thisWeek}</p>
      <div className={`flex items-center gap-1 mt-1 ${flat ? 'text-muted-foreground' : up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
        {flat ? <Minus className="w-3 h-3" /> : up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        <span className="text-[11px] font-semibold">
          {flat ? 'No change' : `${up ? '+' : ''}${delta.toFixed(1)}%`}
        </span>
        <span className="text-[10px] text-muted-foreground">vs last wk ({lastWeek})</span>
      </div>
    </div>
  )
}

export default function WeekOverWeek({ sales }: Props) {
  const thisWeekSales = useMemo(() => filterByWeek(sales, 0), [sales])
  const lastWeekSales = useMemo(() => filterByWeek(sales, 1), [sales])

  const thisRev = weekRevenue(thisWeekSales)
  const lastRev = weekRevenue(lastWeekSales)
  const thisCount = thisWeekSales.length
  const lastCount = lastWeekSales.length
  const thisAvg = thisCount > 0 ? thisRev / thisCount : 0
  const lastAvg = lastCount > 0 ? lastRev / lastCount : 0

  const thisData = useMemo(() => weekDayData(thisWeekSales, 0), [thisWeekSales])
  const lastData = useMemo(() => weekDayData(lastWeekSales, 1), [lastWeekSales])

  // Merge for comparison chart
  const chartData = DAYS.map((day, i) => ({
    day,
    'This week': thisData[i].revenue,
    'Last week': lastData[i].revenue,
  }))

  const maxVal = Math.max(...chartData.map(d => Math.max(d['This week'], d['Last week'])), 1)

  if (thisCount === 0 && lastCount === 0) {
    return null // Don't render if no data at all
  }

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Calendar className="w-4 h-4" />Week-over-Week
          <span className="text-xs font-normal text-muted-foreground">This week vs last week</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        {/* KPI pills */}
        <div className="flex gap-2">
          <StatPill
            label="Revenue"
            thisWeek={`₦${thisRev.toLocaleString()}`}
            lastWeek={`₦${lastRev.toLocaleString()}`}
            raw={{ this: thisRev, last: lastRev }}
          />
          <StatPill
            label="Transactions"
            thisWeek={thisCount}
            lastWeek={lastCount}
            raw={{ this: thisCount, last: lastCount }}
          />
          <StatPill
            label="Avg Order"
            thisWeek={`₦${Math.round(thisAvg).toLocaleString()}`}
            lastWeek={`₦${Math.round(lastAvg).toLocaleString()}`}
            raw={{ this: thisAvg, last: lastAvg }}
          />
        </div>

        {/* Side-by-side daily bars */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Daily revenue comparison</p>
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={chartData} barCategoryGap="25%" barGap={2}>
              <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number, name: string) => [`₦${v.toLocaleString()}`, name]}
                contentStyle={{ fontSize: 11, borderRadius: 8 }}
              />
              <Bar dataKey="Last week" radius={[3, 3, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill="hsl(var(--muted-foreground) / 0.25)" />
                ))}
              </Bar>
              <Bar dataKey="This week" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, i) => {
                  const better = entry['This week'] >= entry['Last week']
                  return <Cell key={i} fill={better ? 'hsl(var(--primary))' : 'hsl(0, 72%, 51%)'} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-1">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-primary" />
              <span className="text-[11px] text-muted-foreground">This week</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-muted-foreground/25" />
              <span className="text-[11px] text-muted-foreground">Last week</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
