import { StatCard } from '@/components/ui/StatCard'
import { TrendingUp, Package, Banknote, ShoppingCart, TrendingDown } from 'lucide-react'

interface AnalyticsCardsProps {
  totalRevenue: number
  totalQty: number
  totalStockCost: number
  grossProfit: number
  grossMargin: number
  outstandingCredit: number
  isLoading?: boolean
}

export default function AnalyticsCards({
  totalRevenue,
  totalQty,
  totalStockCost,
  grossProfit,
  grossMargin,
  outstandingCredit,
  isLoading
}: AnalyticsCardsProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard 
          title="Revenue" 
          value={`₦${totalRevenue.toLocaleString()}`} 
          icon={<Banknote className="w-5 h-5" />}
          isLoading={isLoading}
        />
        <StatCard 
          title="Items Sold" 
          value={totalQty.toLocaleString()} 
          icon={<ShoppingCart className="w-5 h-5" />}
          isLoading={isLoading}
        />
        <StatCard 
          title="Stock Cost" 
          value={`₦${totalStockCost.toLocaleString()}`} 
          icon={<Package className="w-5 h-5" />}
          isLoading={isLoading}
        />
        <StatCard 
          title="Gross Profit" 
          value={`₦${grossProfit.toLocaleString()}`} 
          icon={grossProfit >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
          trend={`${grossMargin.toFixed(1)}% margin`}
          isLoading={isLoading}
        />
      </div>

      {outstandingCredit > 0 && (
        <div className="rounded-xl border border-warning/20 bg-warning/5 p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Outstanding Credit</p>
          <p className="text-xl font-bold text-warning tabular-nums">
            ₦{outstandingCredit.toLocaleString()}
          </p>
        </div>
      )}
    </div>
  )
}
