import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useStock } from '@/hooks/useStock'
import type { Sale } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowUpRight, ArrowRight, Plus, ReceiptText, Package, Wallet, AlertTriangle } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

interface Props {
  tenantId: string
  userId: string
  isAdmin: boolean
  onSwitchTab: (tab: 'record' | 'history' | 'stock' | 'credit' | 'analytics' | 'leaderboard' | 'home') => void
}

const money = (value: number) => '₦' + value.toLocaleString('en-NG', { maximumFractionDigits: 0 })

export default function DashboardOverview({ tenantId, userId, isAdmin, onSwitchTab }: Props) {
  const { inventorySummary, isLoading: stockLoading } = useStock(tenantId)
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['dashboard-sales', tenantId, userId, isAdmin],
    queryFn: async () => {
      const q = isAdmin
        ? supabase.from('sales').select('*').eq('tenant_id', tenantId).order('sale_date', { ascending: false }).limit(250)
        : supabase.from('sales').select('*').eq('tenant_id', tenantId).eq('user_id', userId).order('sale_date', { ascending: false }).limit(250)
      const { data, error } = await q
      if (error) throw error
      return (data || []) as Sale[]
    },
    enabled: !!tenantId,
  })

  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const weekStart = new Date(startOfToday)
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
  const todaySales = sales.filter(s => new Date(s.sale_date) >= startOfToday)
  const weekSales = sales.filter(s => new Date(s.sale_date) >= weekStart)
  const todayTotal = todaySales.reduce((n, s) => n + Number(s.total_amount || 0), 0)
  const weekTotal = weekSales.reduce((n, s) => n + Number(s.total_amount || 0), 0)
  const owingSales = sales.filter(s => s.payment_method === 'credit' && !s.paid_at)
  const owedTotal = owingSales.reduce((n, s) => n + Number(s.total_amount || 0), 0)
  const lowStock = Object.values(inventorySummary).filter(item => item.status !== 'in_stock')
  const chartData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    return days.map((day, index) => {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + index)
      const key = d.toDateString()
      return { day, total: weekSales.filter(s => new Date(s.sale_date).toDateString() === key).reduce((n, s) => n + Number(s.total_amount || 0), 0) }
    })
  }, [weekSales, weekStart.getTime()])
  const recent = sales.slice(0, 5)

  const stats = [
    { label: "Today's sales", value: money(todayTotal), note: `${todaySales.length} sales recorded today`, icon: ReceiptText },
    { label: 'Sales this week', value: money(weekTotal), note: `${weekSales.length} sales recorded`, icon: ArrowUpRight },
    { label: 'Owed to you', value: money(owedTotal), note: `${new Set(owingSales.map(s => s.customer_name).filter(Boolean)).size} customers`, icon: Wallet },
    { label: 'Low stock', value: `${lowStock.length} items`, note: lowStock.length ? 'Reorder soon' : 'Stock levels look good', icon: Package },
  ]

  if (isLoading || stockLoading) return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map(i => <Card key={i} className="h-32 animate-pulse bg-muted/60" />)}</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-sm text-muted-foreground">{today.toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p><h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Dashboard</h1></div>
        <div className="flex gap-2"><Button variant="outline" className="gap-2" onClick={() => onSwitchTab('stock')}><Plus size={16}/> Add stock</Button><Button className="gap-2 bg-[#0F172A] text-white hover:bg-[#1e293b]" onClick={() => onSwitchTab('record')}><ReceiptText size={16}/> Record sale</Button></div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map(({label,value,note,icon:Icon}, i) => <Card key={label} className="rounded-xl border-[#CBD5E1] bg-white shadow-none"><CardContent className="p-4 md:p-5"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-[#475569] md:text-sm">{label}</p><span className={`rounded-lg p-2 ${i===2?'bg-amber-50 text-amber-800':i===3?'bg-red-50 text-red-800':'bg-green-50 text-green-700'}`}><Icon size={17}/></span></div><p className="mt-3 text-xl font-bold tracking-tight text-[#0F172A] md:text-2xl">{value}</p><p className="mt-1 text-xs text-[#64748B]">{note}</p></CardContent></Card>)}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)]">
        <Card className="rounded-xl border-[#CBD5E1] bg-white shadow-none"><CardContent className="p-4 md:p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold text-[#0F172A]">Sales this week</h2><p className="text-xs text-[#64748B]">Daily sales performance</p></div><p className="text-sm font-bold text-[#0F172A]">Today: {money(todayTotal)}</p></div><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{top:8,right:8,left:0,bottom:0}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0"/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill:'#64748B',fontSize:12}}/><YAxis hide/><Tooltip formatter={(v:number)=>money(v)} cursor={{fill:'#F1F5F9'}}/><Bar dataKey="total" fill="#16A34A" radius={[5,5,0,0]} maxBarSize={34}/></BarChart></ResponsiveContainer></div></CardContent></Card>
        <Card className="rounded-xl border-[#CBD5E1] bg-white shadow-none"><CardContent className="p-4 md:p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold text-[#0F172A]">Low stock</h2><button onClick={()=>onSwitchTab('leaderboard')} className="text-xs font-semibold text-green-700">View all</button></div>{lowStock.length===0?<p className="py-8 text-center text-sm text-[#64748B]">No low-stock products.</p>:<div className="space-y-3">{lowStock.slice(0,4).map(item=><div key={item.itemName} className="flex items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3 last:border-0"><div className="flex min-w-0 items-center gap-3"><span className="rounded-lg bg-amber-50 p-2 text-amber-800"><AlertTriangle size={16}/></span><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#0F172A]">{item.itemName}</p><p className="text-xs text-[#64748B]">{item.availableStock} available</p></div></div><Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">Low</Badge></div>)}</div>}</CardContent></Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)]">
        <Card className="rounded-xl border-[#CBD5E1] bg-white shadow-none"><CardContent className="p-4 md:p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold text-[#0F172A]">Recent sales</h2><button onClick={()=>onSwitchTab('history')} className="flex items-center gap-1 text-xs font-semibold text-green-700">View all <ArrowRight size={14}/></button></div><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-[#E2E8F0] text-xs text-[#64748B]"><th className="pb-3 font-semibold">Customer</th><th className="pb-3 font-semibold">Items</th><th className="pb-3 font-semibold">Total</th><th className="pb-3 font-semibold">Status</th></tr></thead><tbody>{recent.map(s=><tr key={s.id} className="border-b border-[#F1F5F9] last:border-0"><td className="py-3 font-medium text-[#0F172A]">{s.customer_name || 'Walk-in customer'}</td><td className="py-3 text-[#475569]">{s.quantity} {s.unit_label} {s.item_name}</td><td className="py-3 font-semibold text-[#0F172A]">{money(Number(s.total_amount))}</td><td className="py-3"><Badge variant="outline" className={s.payment_method==='credit'&&!s.paid_at?'border-amber-200 bg-amber-50 text-amber-800':'border-green-200 bg-green-50 text-green-800'}>{s.payment_method==='credit'&&!s.paid_at?'On credit':'Paid'}</Badge></td></tr>)}</tbody></table></div>{recent.length===0&&<p className="py-8 text-center text-sm text-[#64748B]">No sales recorded yet.</p>}</CardContent></Card>
        <Card className="rounded-xl border-[#CBD5E1] bg-white shadow-none"><CardContent className="p-4 md:p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold text-[#0F172A]">Customers who owe you</h2><button onClick={()=>onSwitchTab('credit')} className="text-xs font-semibold text-green-700">View all</button></div>{owingSales.length===0?<p className="py-8 text-center text-sm text-[#64748B]">No outstanding credit sales.</p>:<div className="space-y-3">{Object.entries(owingSales.reduce((acc:Record<string,number>,s)=>{const n=s.customer_name||'Unknown customer';acc[n]=(acc[n]||0)+Number(s.total_amount||0);return acc},{})).slice(0,4).map(([name,balance])=><div key={name} className="flex items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3 last:border-0"><span className="truncate text-sm font-medium text-[#0F172A]">{name}</span><span className="text-sm font-bold text-[#92400E]">{money(balance)}</span></div>)}</div>}</CardContent></Card>
      </div>
    </div>
  )
}
