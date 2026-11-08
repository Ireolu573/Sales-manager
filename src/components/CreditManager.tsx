import { useMemo, useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { getCreditSalesForTenant } from '@/lib/tenant-queries'
import type { Sale } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CreditCard, CheckCircle2, AlertCircle, MessageCircle, Search, Users, Wallet, Clock3, ArrowUpRight } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { SkeletonRowList } from '@/components/ui/loading-skeletons'
import { Input } from '@/components/ui/input'
import { SalesService } from '@/services/sales.service'

interface Props {
  isAdmin: boolean
  userId: string
  tenantId: string
}

export default function CreditManager({ isAdmin, userId, tenantId }: Props) {
  const { toast } = useToast()
  const [credits, setCredits] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [payments, setPayments] = useState<Record<string, number>>({})
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({})
  const [savingPayment, setSavingPayment] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const fetchCredits = async () => {
    setLoading(true)
    const [{ data }, { data: paymentRows }] = await Promise.all([
      getCreditSalesForTenant(tenantId),
      (supabase as any).from('credit_payments').select('sale_id, amount').eq('tenant_id', tenantId),
    ])
    if (data) setCredits(data as unknown as Sale[])
    setPayments((paymentRows || []).reduce((totals: Record<string, number>, row: { sale_id: string; amount: number }) => {
      totals[row.sale_id] = (totals[row.sale_id] || 0) + Number(row.amount)
      return totals
    }, {}))
    setLoading(false)
  }

  useEffect(() => {
    void fetchCredits()
  }, [tenantId])

  const handlePayment = async (saleId: string, balance: number) => {
    const amount = Number(paymentAmounts[saleId])
    if (!amount || amount <= 0 || amount > balance) {
      toast({ title: 'Enter a valid payment amount.', variant: 'destructive' })
      return
    }
    setSavingPayment(saleId)
    try {
      await SalesService.recordCreditPayment(saleId, amount, 'cash')
      toast({ title: amount === balance ? 'Credit settled!' : 'Payment recorded.' })
      setPaymentAmounts(prev => ({ ...prev, [saleId]: '' }))
      await fetchCredits()
    } catch (error: any) {
      toast({ title: 'Could not record payment', description: error.message, variant: 'destructive' })
    } finally { setSavingPayment(null) }
  }

  const sendReminder = (customer: string, balance: number) => {
    const phone = window.prompt(`Enter ${customer}'s WhatsApp number, including country code:`)
    if (!phone) return
    const normalizedPhone = phone.replace(/[^0-9]/g, '')
    if (normalizedPhone.length < 10) {
      toast({ title: 'Enter a valid phone number.', variant: 'destructive' })
      return
    }
    const message = `Hello ${customer}, this is a payment reminder from AgriLedger. Your outstanding balance is ₦${balance.toLocaleString('en-NG')}. Kindly make payment. Thank you.`
    window.open(`https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
  }

  const balanceFor = (sale: Sale) => Math.max(0, Number(sale.total_amount) - (payments[sale.id] || 0))
  const totalOutstanding = credits.reduce((sum, sale) => sum + balanceFor(sale), 0)
  const outstandingSales = credits.filter(sale => balanceFor(sale) > 0)
  const customerGroups = useMemo(() => {
    const groups: Record<string, Sale[]> = {}
    outstandingSales.forEach(sale => {
      const name = sale.customer_name?.trim() || 'Walk-in customer'
      if (!groups[name]) groups[name] = []
      groups[name].push(sale)
    })
    return Object.entries(groups)
      .map(([name, sales]) => ({ name, sales, balance: sales.reduce((sum, sale) => sum + balanceFor(sale), 0) }))
      .filter(group => group.name.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => b.balance - a.balance)
  }, [outstandingSales, payments, search])
  const customerCount = new Set(outstandingSales.map(sale => sale.customer_name?.trim() || 'Walk-in customer')).size
  const paidTotal = credits.reduce((sum, sale) => sum + Math.min(Number(sale.total_amount), payments[sale.id] || 0), 0)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Relationship management</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Customers & credit</h1>
          <p className="mt-1 text-sm text-muted-foreground">Monitor outstanding balances and record customer repayments.</p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Live account balances
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-border shadow-sm">
          <CardContent className="flex items-center justify-between gap-3 p-4 sm:p-5">
            <div><p className="text-xs font-medium text-muted-foreground">Total outstanding</p><p className="mt-2 text-2xl font-bold tabular-nums text-foreground">₦{totalOutstanding.toLocaleString('en-NG')}</p><p className="mt-1 text-xs text-muted-foreground">Amount yet to be collected</p></div>
            <div className="rounded-xl bg-amber-50 p-3 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"><Wallet className="h-5 w-5" /></div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardContent className="flex items-center justify-between gap-3 p-4 sm:p-5">
            <div><p className="text-xs font-medium text-muted-foreground">Customers owing</p><p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{customerCount}</p><p className="mt-1 text-xs text-muted-foreground">With unpaid credit sales</p></div>
            <div className="rounded-xl bg-blue-50 p-3 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"><Users className="h-5 w-5" /></div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardContent className="flex items-center justify-between gap-3 p-4 sm:p-5">
            <div><p className="text-xs font-medium text-muted-foreground">Payments received</p><p className="mt-2 text-2xl font-bold tabular-nums text-foreground">₦{paidTotal.toLocaleString('en-NG')}</p><p className="mt-1 text-xs text-muted-foreground">Against recorded credit sales</p></div>
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"><CheckCircle2 className="h-5 w-5" /></div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-lg font-semibold text-foreground">Outstanding accounts</h2><p className="text-sm text-muted-foreground">{customerCount} customer account{customerCount === 1 ? '' : 's'} need attention</p></div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search customer..." className="pl-9" />
        </div>
      </div>

      {loading ? <SkeletonRowList count={4} /> : customerGroups.length === 0 ? (
        <Card className="border-dashed border-border shadow-none">
          <CardContent className="flex flex-col items-center px-5 py-14 text-center">
            <div className="mb-3 rounded-2xl bg-emerald-50 p-4 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"><CheckCircle2 className="h-7 w-7" /></div>
            <h3 className="font-semibold text-foreground">{search ? 'No matching customers' : 'All accounts are settled'}</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{search ? 'Try another customer name.' : 'There are no outstanding credit balances to follow up.'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {customerGroups.map(group => (
            <Card key={group.name} className="overflow-hidden border-border shadow-sm">
              <CardContent className="p-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 p-4 sm:p-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-100">{group.name.slice(0, 1).toUpperCase()}</div>
                    <div className="min-w-0"><h3 className="truncate font-semibold text-foreground">{group.name}</h3><p className="text-xs text-muted-foreground">{group.sales.length} unpaid transaction{group.sales.length === 1 ? '' : 's'}</p></div>
                  </div>
                  <div className="text-right"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Balance due</p><p className="text-lg font-bold tabular-nums text-amber-700 dark:text-amber-400">₦{group.balance.toLocaleString('en-NG')}</p></div>
                </div>
                <div className="divide-y divide-border px-4 sm:px-5">
                  {group.sales.map(sale => {
                    const balance = balanceFor(sale)
                    const paid = Math.max(0, Number(sale.total_amount) - balance)
                    return (
                      <div key={sale.id} className="space-y-3 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{sale.item_name}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(sale.sale_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {sale.quantity} {sale.unit_label}</p></div>
                          <div className="shrink-0 text-right"><p className="text-sm font-semibold text-foreground">₦{Number(sale.total_amount).toLocaleString('en-NG')}</p><p className="text-xs text-muted-foreground">₦{paid.toLocaleString('en-NG')} paid</p></div>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, Number(sale.total_amount) > 0 ? paid / Number(sale.total_amount) * 100 : 0)}%` }} /></div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400"><Clock3 className="h-3.5 w-3.5" /> ₦{balance.toLocaleString('en-NG')} remaining</div>
                          {isAdmin && (
                            <div className="flex w-full gap-2 sm:w-auto">
                              <Input aria-label={`Payment amount for ${group.name}`} type="number" min="1" max={balance} value={paymentAmounts[sale.id] || ''} onChange={event => setPaymentAmounts(prev => ({ ...prev, [sale.id]: event.target.value }))} className="h-9 min-w-0 sm:w-32" placeholder="Amount (₦)" />
                              <Button size="sm" disabled={savingPayment === sale.id} onClick={() => handlePayment(sale.id, balance)} className="h-9 shrink-0 gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />{savingPayment === sale.id ? 'Saving' : 'Record payment'}</Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-end border-t border-border p-3">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => sendReminder(group.name, group.balance)}><MessageCircle className="h-4 w-4" /> Send WhatsApp reminder <ArrowUpRight className="h-3.5 w-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {!isAdmin && <p className="text-xs text-muted-foreground">Only business administrators can record credit repayments.</p>}
    </div>
  )
}
