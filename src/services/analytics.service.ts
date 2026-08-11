import { supabase } from '@/integrations/supabase/client'

export interface AnalyticsSummary {
  totalRevenue: number
  totalSalesCount: number
  topProduct: string
  averageOrderValue: number
}

export class AnalyticsService {
  static async getTenantAnalytics(tenantId: string, startDate?: string, endDate?: string) {
    let query = supabase
      .from('sales')
      .select('*')
      .eq('tenant_id', tenantId)

    if (startDate) query = query.gte('sale_date', startDate)
    if (endDate) query = query.lte('sale_date', endDate)

    const { data, error } = await query
    if (error) throw new Error(error.message)
    const sales = data || []

    const totalRevenue = sales.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0)
    const totalSalesCount = sales.length
    const averageOrderValue = totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0

    // Top selling product
    const productCounts: Record<string, number> = {}
    sales.forEach(s => {
      productCounts[s.item_name] = (productCounts[s.item_name] || 0) + Number(s.quantity || 0)
    })
    const topProduct = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'

    return {
      sales,
      summary: {
        totalRevenue,
        totalSalesCount,
        topProduct,
        averageOrderValue,
      } as AnalyticsSummary
    }
  }

  static async getStaffLeaderboard(tenantId: string) {
    const { data: sales, error: salesErr } = await supabase
      .from('sales')
      .select('user_id, total_amount, quantity')
      .eq('tenant_id', tenantId)

    if (salesErr) throw new Error(salesErr.message)

    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('tenant_id', tenantId)

    if (profErr) throw new Error(profErr.message)

    const profileMap = new Map((profiles || []).map(p => [p.id, p.email]))
    const leaderboardMap: Record<string, { email: string; totalRevenue: number; totalCount: number }> = {}

    ;(sales || []).forEach(s => {
      const email = profileMap.get(s.user_id) || 'Unknown User'
      if (!leaderboardMap[s.user_id]) {
        leaderboardMap[s.user_id] = { email, totalRevenue: 0, totalCount: 0 }
      }
      leaderboardMap[s.user_id].totalRevenue += Number(s.total_amount || 0)
      leaderboardMap[s.user_id].totalCount += 1
    })

    return Object.values(leaderboardMap).sort((a, b) => b.totalRevenue - a.totalRevenue)
  }
}
