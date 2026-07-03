import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Trophy, TrendingUp, ShoppingCart, Crown, Medal } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { SkeletonLeaderboard } from '@/components/ui/loading-skeletons'

interface Props {
  tenantId: string
  isAdmin: boolean
}

interface StaffStat {
  userId: string
  email: string
  revenue: number
  salesCount: number
  rank: number
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function Leaderboard({ tenantId, isAdmin }: Props) {
  const [metric, setMetric] = useState<'revenue' | 'count'>('revenue')
  const [month, setMonth] = useState(new Date().getMonth())
  const [year, setYear] = useState(new Date().getFullYear())

  const { data: stats = [], isLoading: loading } = useQuery({
    queryKey: ['leaderboard', tenantId, month, year],
    queryFn: async () => {
      const startDate = new Date(year, month, 1).toISOString().split('T')[0]
      const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0]

      const [salesRes, profilesRes] = await Promise.all([
        supabase
          .from('sales')
          .select('user_id, total_amount')
          .eq('tenant_id', tenantId)
          .gte('sale_date', startDate)
          .lte('sale_date', endDate),
        supabase
          .from('profiles')
          .select('id, email')
          .eq('tenant_id', tenantId),
      ])

      if (!salesRes.data || !profilesRes.data) return []

      const profileMap: Record<string, string> = {}
      for (const p of profilesRes.data as any[]) {
        profileMap[p.id] = p.email
      }

      const aggregated: Record<string, { revenue: number; count: number }> = {}
      for (const sale of salesRes.data as any[]) {
        if (!sale.user_id) continue
        if (!aggregated[sale.user_id]) aggregated[sale.user_id] = { revenue: 0, count: 0 }
        aggregated[sale.user_id].revenue += Number(sale.total_amount) || 0
        aggregated[sale.user_id].count += 1
      }

      const result: StaffStat[] = Object.entries(aggregated).map(([userId, data]) => ({
        userId,
        email: profileMap[userId] || 'Unknown',
        revenue: data.revenue,
        salesCount: data.count,
        rank: 0,
      }))

      // Sort by revenue for ranking purposes; metric toggle is client-side only
      result.sort((a, b) => b.revenue - a.revenue)
      result.forEach((s, i) => s.rank = i + 1)

      return result
    },
    enabled: !!tenantId,
  })

  // Client-side sort by selected metric (no extra fetch needed)
  const sorted = [...stats].sort((a, b) =>
    metric === 'revenue' ? b.revenue - a.revenue : b.salesCount - a.salesCount
  ).map((s, i) => ({ ...s, rank: i + 1 }))

  const topRevenue = sorted[0]?.revenue || 1
  const topCount = sorted[0]?.salesCount || 1

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Trophy className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-bold text-foreground text-lg">Staff Leaderboard</h2>
          <p className="text-sm text-muted-foreground">Rankings for this month</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex items-center bg-muted rounded-xl p-1 gap-1">
          <button
            onClick={() => setMetric('revenue')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              metric === 'revenue' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" /> Revenue
          </button>
          <button
            onClick={() => setMetric('count')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              metric === 'count' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" /> Sales
          </button>
        </div>

        <select
          value={`${year}-${month}`}
          onChange={e => {
            const [y, m] = e.target.value.split('-').map(Number)
            setYear(y); setMonth(m)
          }}
          className="flex-1 min-w-0 bg-muted border-0 rounded-xl px-3 py-2 text-sm text-foreground font-medium outline-none cursor-pointer"
        >
          {Array.from({ length: 12 }, (_, i) => {
            const d = new Date()
            d.setMonth(d.getMonth() - i)
            const y = d.getFullYear()
            const m = d.getMonth()
            return (
              <option key={i} value={`${y}-${m}`}>
                {MONTHS[m]} {y}
              </option>
            )
          })}
        </select>
      </div>

      {loading ? (
        <SkeletonLeaderboard />
      ) : sorted.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <Trophy className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground font-medium">No sales this month yet</p>
            <p className="text-xs text-muted-foreground mt-1">Get recording!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Top 3 podium cards */}
          {sorted.length >= 1 && (
            <div className="grid grid-cols-3 gap-2 mb-2">
              {sorted[1] ? (
                <div className="flex flex-col items-center pt-4">
                  <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mb-1.5">
                    <Medal className="w-5 h-5 text-gray-500" />
                  </div>
                  <div className="bg-card border border-border rounded-xl p-2 text-center w-full">
                    <p className="text-xs font-bold text-foreground truncate">{sorted[1].email.split('@')[0]}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {metric === 'revenue' ? `₦${(sorted[1].revenue / 1000).toFixed(0)}k` : `${sorted[1].salesCount} sales`}
                    </p>
                    <div className="mt-1.5 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg" />
                  </div>
                </div>
              ) : <div />}

              <div className="flex flex-col items-center">
                <Crown className="w-6 h-6 text-yellow-500 mb-1" />
                <div className="bg-primary/10 border-2 border-primary/30 rounded-xl p-2 text-center w-full">
                  <p className="text-xs font-bold text-primary truncate">{sorted[0].email.split('@')[0]}</p>
                  <p className="text-xs text-primary/70 mt-0.5">
                    {metric === 'revenue' ? `₦${(sorted[0].revenue / 1000).toFixed(0)}k` : `${sorted[0].salesCount} sales`}
                  </p>
                  <div className="mt-1.5 h-16 bg-primary/20 rounded-lg" />
                </div>
              </div>

              {sorted[2] ? (
                <div className="flex flex-col items-center pt-6">
                  <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-1.5">
                    <span className="text-sm">🥉</span>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-2 text-center w-full">
                    <p className="text-xs font-bold text-foreground truncate">{sorted[2].email.split('@')[0]}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {metric === 'revenue' ? `₦${(sorted[2].revenue / 1000).toFixed(0)}k` : `${sorted[2].salesCount} sales`}
                    </p>
                    <div className="mt-1.5 h-8 bg-amber-100 dark:bg-amber-900/20 rounded-lg" />
                  </div>
                </div>
              ) : <div />}
            </div>
          )}

          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-0">
              {sorted.map((s, idx) => {
                const barWidth = metric === 'revenue'
                  ? Math.max(8, (s.revenue / topRevenue) * 100)
                  : Math.max(8, (s.salesCount / topCount) * 100)

                const rankBadge = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${s.rank}`

                return (
                  <div
                    key={s.userId}
                    className={`flex items-center gap-3 px-4 py-3 ${idx < sorted.length - 1 ? 'border-b border-border/50' : ''} ${idx === 0 ? 'bg-primary/3' : ''}`}
                  >
                    <span className="text-base w-8 text-center flex-shrink-0">{rankBadge}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-foreground truncate">{s.email.split('@')[0]}</p>
                        <div className="text-right flex-shrink-0 ml-2">
                          <p className="text-sm font-bold text-primary">
                            {metric === 'revenue' ? `₦${s.revenue.toLocaleString()}` : `${s.salesCount}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {metric === 'revenue' ? `${s.salesCount} sales` : 'transactions'}
                          </p>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${idx === 0 ? 'bg-primary' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-amber-500' : 'bg-muted-foreground/40'}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
