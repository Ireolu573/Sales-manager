import { StatCard } from '@/components/ui/StatCard'
import { TrendingUp, Package, Banknote, ShoppingCart, TrendingDown } from 'lucide-react'

interface AnalyticsCardsProps {
  totalRevenue: number
  totalQty: number
  totalStockCost: number
  estimatedProfit: number
  outstandingCredit: number
  isLoading?: boolean
}

export default function AnalyticsCards({
  totalRevenue,
  totalQty,
  totalStockCost,
  estimatedProfit,
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
          title="Stock Purchased" 
          value={`₦${totalStockCost.toLocaleString()}`} 
          icon={<Package className="w-5 h-5" />}
          isLoading={isLoading}
        />
        <StatCard 
          title="Est. Profit" 
          value={`₦${Math.abs(estimatedProfit).toLocaleString()}`} 
          icon={estimatedProfit >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
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
