import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface AnalyticsChartsProps {
  topProducts: { name: string; revenue: number; qty: number }[]
  maxRevenue: number
  dailyData: { day: string; revenue: number }[]
  paymentPieData: { name: string; value: number; color: string }[]
}

export default function AnalyticsCharts({ topProducts, maxRevenue, dailyData, paymentPieData }: AnalyticsChartsProps) {
  return (
    <div className="space-y-5">
      {/* 🏆 Rank Listings */}
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
                    }`}>{index + 1}</span>
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

      {/* 📊 Trend Line Analysis */}
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

      {/* 🍕 Composition Split Breakdown */}
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
