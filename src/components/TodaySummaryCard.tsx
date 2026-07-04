/**
 * TodaySummaryCard.tsx
 * Shown at the top of the Record tab.
 * Gives salespeople instant context: today's running total, count, top item.
 * Fetches from React Query cache (sales query) — no extra network call.
 */
import { useMemo } from 'react'
import { TrendingUp, ShoppingCart, Package, Zap, Trophy } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { Sale } from '@/lib/types'

interface Props {
  userId: string
  tenantId: string
  isAdmin: boolean
}

export default function TodaySummaryCard({ userId, tenantId, isAdmin }: Props) {
  const today = new Date().toISOString().split('T')[0]

  // Re-uses the same cache key as Analytics / SalesTable — zero extra requests
  const { data: sales = [], isLoading } = useQuery<Sale[]>({
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

  const todaySales = useMemo(() => sales.filter(s => s.sale_date === today), [sales, today])

  const totalRevenue = todaySales.reduce((s, r) => s + Number(r.total_amount), 0)
  const totalCount = todaySales.length
  const totalQty = todaySales.reduce((s, r) => s + Number(r.quantity), 0)

  // Top item today by revenue
  const byItem: Record<string, number> = {}
  todaySales.forEach(s => { byItem[s.item_name] = (byItem[s.item_name] || 0) + Number(s.total_amount) })
  const topItem = Object.entries(byItem).sort((a, b) => b[1] - a[1])[0]

  const dayName = new Date().toLocaleDateString('en-NG', { weekday: 'long' })

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/50 bg-primary/5 p-4 animate-pulse">
        <div className="h-4 bg-primary/10 rounded w-32 mb-3" />
        <div className="grid grid-cols-3 gap-3">
          {[1,2,3].map(i => <div key={i} className="h-12 bg-primary/10 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-primary">
          {totalCount === 0 ? `Good ${getTimeOfDay()}! Let's start recording` : `${dayName}'s progress`}
        </span>
      </div>

      {totalCount === 0 ? (
        <p className="text-xs text-muted-foreground">No sales recorded today yet — yours could be the first! 🚀</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-card rounded-xl p-2.5 text-center border border-border/50">
              <TrendingUp className="w-4 h-4 text-primary mx-auto mb-1" />
              <p className="text-xs text-muted-foreground leading-tight">Revenue</p>
              <p className="text-sm font-bold text-foreground tabular-nums">
                ₦{totalRevenue >= 1000 ? `${(totalRevenue/1000).toFixed(1)}k` : totalRevenue.toLocaleString()}
              </p>
            </div>
            <div className="bg-card rounded-xl p-2.5 text-center border border-border/50">
              <ShoppingCart className="w-4 h-4 text-primary mx-auto mb-1" />
              <p className="text-xs text-muted-foreground leading-tight">Sales</p>
              <p className="text-sm font-bold text-foreground tabular-nums">{totalCount}</p>
            </div>
            <div className="bg-card rounded-xl p-2.5 text-center border border-border/50">
              <Package className="w-4 h-4 text-primary mx-auto mb-1" />
              <p className="text-xs text-muted-foreground leading-tight">Items</p>
              <p className="text-sm font-bold text-foreground tabular-nums">{totalQty}</p>
            </div>
          </div>

          {topItem && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Trophy className="w-3 h-3" />Top today:
              </span>
              <span className="text-xs font-semibold text-foreground truncate">{topItem[0]}</span>
              <span className="text-xs text-primary font-bold ml-auto shrink-0">
                ₦{topItem[1].toLocaleString()}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function getTimeOfDay(): string {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
