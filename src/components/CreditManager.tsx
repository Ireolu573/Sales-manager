import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { Sale } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CreditCard, CheckCircle2, AlertCircle, Search, ChevronDown, ChevronUp, MessageCircle, UserRound, Clock3 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { SkeletonRowList } from '@/components/ui/loading-skeletons'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SalesService } from '@/services/sales.service'

interface Props {
  isAdmin: boolean
  userId: string
  tenantId: string
}

type CreditPayment = { id: string; sale_id: string; amount: number; received_at: string; payment_method: string; note: string | null }
type CustomerRecord = { id: string; name: string; phone: string | null; address: string | null; credit_limit: number | null; allow_credit: boolean }
type CustomerCredit = { id: string | null; name: string; phone: string; address: string; creditLimit: number | null; allowCredit: boolean; sales: Sale[]; balance: number; lastActivity: string }

const money = (amount: number) => '₦' + amount.toLocaleString('en-NG', { maximumFractionDigits: 2 })
const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date unavailable'

export default function CreditManager({ isAdmin, userId, tenantId }: Props) {
  const { toast } = useToast()
  const [credits, setCredits] = useState<Sale[]>([])
  const [savedCustomers, setSavedCustomers] = useState<CustomerRecord[]>([])
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [savingCustomer, setSavingCustomer] = useState(false)
  const [customerForm, setCustomerForm] = useState({ id: '', name: '', phone: '', address: '', creditLimit: '', allowCredit: true })
  const [payments, setPayments] = useState<Record<string, CreditPayment[]>>({})
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({})
  const [savingPayment, setSavingPayment] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'owing'>('owing')
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)
  const [phoneNumbers, setPhoneNumbers] = useState<Record<string, string>>({})
  const [reminderMessage, setReminderMessage] = useState(() => {
    const fallback = 'Hello {name}, this is a friendly reminder about your outstanding balance of {balance} at our shop. Please let us know when you can make payment. Thank you.'
    try {
      const saved = window.localStorage.getItem('agriledger-settings-preferences')
      return saved ? (JSON.parse(saved)?.reminderMessage || fallback) : fallback
    } catch { return fallback }
  })

  const fetchCredits = async () => {
    setLoading(true)
    try {
      const [{ data, error }, { data: paymentRows, error: paymentError }, { data: customerRows, error: customerError }] = await Promise.all([
        supabase.from('sales').select('*').eq('tenant_id', tenantId).eq('payment_method', 'credit').order('sale_date', { ascending: false }),
        supabase.from('credit_payments').select('id, sale_id, amount, received_at, payment_method, note').eq('tenant_id', tenantId).order('received_at', { ascending: false }),
        supabase.from('customers').select('id, name, phone, address, credit_limit, allow_credit').eq('tenant_id', tenantId).order('name'),
      ])
      if (error) throw error
      if (paymentError) throw paymentError
      if (customerError) throw customerError
      setSavedCustomers((customerRows || []) as CustomerRecord[])
      const sales = (data || []) as Sale[]
      const paymentMap: Record<string, CreditPayment[]> = {}
      ;((paymentRows || []) as CreditPayment[]).forEach(row => {
        paymentMap[row.sale_id] ||= []
        paymentMap[row.sale_id].push(row)
      })
      setCredits(sales)
      setPayments(paymentMap)
    } catch (error: any) {
      toast({ title: 'Could not load customer balances', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCredits() }, [tenantId])

  const paidFor = (saleId: string) => (payments[saleId] || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const balanceFor = (sale: Sale) => Math.max(0, Number(sale.total_amount || 0) - paidFor(sale.id))

  const customers = useMemo<CustomerCredit[]>(() => {
    const grouped = new Map<string, Sale[]>()
    credits.forEach(sale => {
      const name = (sale.customer_name || '').trim() || 'Unnamed customer'
      grouped.set(name, [...(grouped.get(name) || []), sale])
    })
    const fromSales = Array.from(grouped.entries()).map(([name, sales]) => {
      const saved = savedCustomers.find(customer => customer.name.trim().toLowerCase() === name.trim().toLowerCase())
      return {
        id: saved?.id || null,
        name,
        phone: saved?.phone || '',
        address: saved?.address || '',
        creditLimit: saved?.credit_limit ?? null,
        allowCredit: saved?.allow_credit ?? true,
        sales,
        balance: sales.reduce((sum, sale) => sum + balanceFor(sale), 0),
        lastActivity: sales.reduce((latest, sale) => sale.sale_date > latest ? sale.sale_date : latest, sales[0]?.sale_date || ''),
      }
    })
    const salesNames = new Set(fromSales.map(customer => customer.name.trim().toLowerCase()))
    const directoryOnly = savedCustomers.filter(customer => !salesNames.has(customer.name.trim().toLowerCase())).map(customer => ({
      id: customer.id, name: customer.name, phone: customer.phone || '', address: customer.address || '',
      creditLimit: customer.credit_limit, allowCredit: customer.allow_credit, sales: [], balance: 0, lastActivity: '',
    }))
    return [...fromSales, ...directoryOnly].sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name))
  }, [credits, payments, savedCustomers])

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = [customer.name, customer.phone, customer.address].join(' ').toLowerCase().includes(search.trim().toLowerCase())
    return matchesSearch && (filter === 'all' || customer.balance > 0)
  })
  const totalOutstanding = customers.reduce((sum, customer) => sum + customer.balance, 0)
  const owingCount = customers.filter(customer => customer.balance > 0).length

  const handlePayment = async (saleId: string) => {
    const sale = credits.find(item => item.id === saleId)
    if (!sale) return
    const balance = balanceFor(sale)
    const amount = Number(paymentAmounts[saleId])
    if (!Number.isFinite(amount) || amount <= 0 || amount > balance) {
      toast({ title: 'Enter a valid payment amount.', description: 'The payment must be greater than zero and no more than the outstanding balance.', variant: 'destructive' })
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
    } finally {
      setSavingPayment(null)
    }
  }

  const openCustomerForm = (customer?: CustomerCredit) => {
    setCustomerForm(customer ? {
      id: customer.id || '', name: customer.name, phone: customer.phone, address: customer.address,
      creditLimit: customer.creditLimit == null ? '' : String(customer.creditLimit), allowCredit: customer.allowCredit,
    } : { id: '', name: '', phone: '', address: '', creditLimit: '', allowCredit: true })
    setShowCustomerForm(true)
  }

  const saveCustomer = async (event: React.FormEvent) => {
    event.preventDefault()
    const name = customerForm.name.trim()
    if (!name) {
      toast({ title: 'Customer name is required', variant: 'destructive' })
      return
    }
    const creditLimit = customerForm.creditLimit.trim() ? Number(customerForm.creditLimit) : null
    if (creditLimit !== null && (!Number.isFinite(creditLimit) || creditLimit < 0)) {
      toast({ title: 'Enter a valid credit limit', variant: 'destructive' })
      return
    }
    setSavingCustomer(true)
    try {
      const values = {
        name, phone: customerForm.phone.trim() || null, address: customerForm.address.trim() || null,
        credit_limit: creditLimit, allow_credit: customerForm.allowCredit,
      }
      if (customerForm.id) {
        const { error } = await supabase.from('customers').update(values).eq('id', customerForm.id).eq('tenant_id', tenantId)
        if (error) throw error
      } else {
        const { data: existingCustomers, error: lookupError } = await supabase.from('customers').select('id, name').eq('tenant_id', tenantId)
        if (lookupError) throw lookupError
        const existing = (existingCustomers || []).find(customer => customer.name.trim().toLowerCase() === name.toLowerCase())
        const { error } = existing
          ? await supabase.from('customers').update(values).eq('id', existing.id).eq('tenant_id', tenantId)
          : await supabase.from('customers').insert({ ...values, tenant_id: tenantId, created_by: userId })
        if (error) throw error
      }
      toast({ title: customerForm.id ? 'Customer details updated' : 'Customer added' })
      setShowCustomerForm(false)
      await fetchCredits()
    } catch (error: any) {
      toast({ title: 'Could not save customer', description: error.message, variant: 'destructive' })
    } finally {
      setSavingCustomer(false)
    }
  }

  const sendReminder = (customer: CustomerCredit) => {
    const rawPhone = (phoneNumbers[customer.name] || customer.phone || '').trim()
    const phone = rawPhone.replace(/[^\d+]/g, '').replace(/^\+/, '')
    if (phone.length < 10) {
      toast({ title: 'Enter the customer’s WhatsApp number', description: 'Include the country code, for example 2348012345678.', variant: 'destructive' })
      return
    }
    const message = reminderMessage.replaceAll('{name}', customer.name).replaceAll('{balance}', money(customer.balance))
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="w-full min-w-0 space-y-5 pb-8">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">AgriLedger workspace</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Customers &amp; credit</h1>
        <p className="text-sm text-muted-foreground">Review customer balances, payment history and reminders.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card><CardContent className="flex items-center justify-between p-4 sm:p-5"><div><p className="text-sm text-muted-foreground">Total owed to you</p><p className="mt-1 text-2xl font-bold text-warning">{money(totalOutstanding)}</p></div><AlertCircle className="h-7 w-7 text-warning/50"/></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-4 sm:p-5"><div><p className="text-sm text-muted-foreground">Customers owing</p><p className="mt-1 text-2xl font-bold text-foreground">{owingCount}</p></div><UserRound className="h-7 w-7 text-primary/50"/></CardContent></Card>
      </div>

      {showCustomerForm && (
        <Card><CardContent className="p-4 sm:p-5">
          <form onSubmit={saveCustomer} className="space-y-4">
            <div><h2 className="font-bold text-foreground">{customerForm.id ? 'Edit customer' : 'Add customer'}</h2><p className="text-xs text-muted-foreground">Contact information is saved to this business’s customer directory.</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-medium">Full name<Input required value={customerForm.name} onChange={e => setCustomerForm(v => ({ ...v, name: e.target.value }))} placeholder="Customer full name"/></label>
              <label className="space-y-1 text-sm font-medium">Phone number<Input value={customerForm.phone} onChange={e => setCustomerForm(v => ({ ...v, phone: e.target.value }))} placeholder="e.g. 08012345678"/></label>
              <label className="space-y-1 text-sm font-medium">Address<Input value={customerForm.address} onChange={e => setCustomerForm(v => ({ ...v, address: e.target.value }))} placeholder="Customer address"/></label>
              <label className="space-y-1 text-sm font-medium">Credit limit (₦)<Input type="number" min="0" step="0.01" value={customerForm.creditLimit} onChange={e => setCustomerForm(v => ({ ...v, creditLimit: e.target.value }))} placeholder="Leave blank for no limit"/></label>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={customerForm.allowCredit} onChange={e => setCustomerForm(v => ({ ...v, allowCredit: e.target.checked }))} className="h-4 w-4 accent-primary"/> Allow credit purchases</label>
            <div className="flex flex-wrap gap-2"><Button type="submit" disabled={savingCustomer}>{savingCustomer ? 'Saving…' : 'Save customer'}</Button><Button type="button" variant="outline" onClick={() => setShowCustomerForm(false)}>Cancel</Button></div>
          </form>
        </CardContent></Card>
      )}

      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-lg font-bold text-foreground">Customer directory</h2><p className="text-sm text-muted-foreground">Saved customer details, credit balances and payment history.</p></div>
          <Button size="sm" onClick={() => openCustomerForm()} className="gap-2"><UserRound className="h-4 w-4"/> Add customer</Button>
          <div className="flex gap-2">
            <Button size="sm" variant={filter === 'owing' ? 'default' : 'outline'} onClick={() => setFilter('owing')}>Owing ({owingCount})</Button>
            <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>All customers</Button>
          </div>
        </div>
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search customer name…" className="pl-9"/></div>
      </section>

      {loading ? <SkeletonRowList count={4}/> : filteredCustomers.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-success/50"/><p className="font-semibold text-foreground">{search ? 'No matching customers' : 'No outstanding credits'}</p><p className="mt-1 text-sm text-muted-foreground">{search ? 'Try another customer name.' : 'Credit sales and balances will appear here.'}</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filteredCustomers.map(customer => {
            const expanded = expandedCustomer === customer.name
            return (
              <Card key={customer.name} className="overflow-hidden border-border/70">
                <CardContent className="p-0">
                  <button type="button" onClick={() => setExpandedCustomer(expanded ? null : customer.name)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/40 sm:p-5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{customer.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-foreground">{customer.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{customer.sales.length} credit {customer.sales.length === 1 ? 'sale' : 'sales'}{customer.phone ? ` · ${customer.phone}` : ''}{customer.lastActivity ? ` · Last sale ${dateLabel(customer.lastActivity)}` : ' · No sales yet'}</span></span>
                    <span className="text-right"><span className="block text-sm font-bold text-warning">{money(customer.balance)}</span><span className="block text-[11px] text-muted-foreground">{customer.balance > 0 ? 'Outstanding' : 'Settled'}</span></span>
                    {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground"/> : <ChevronDown className="h-4 w-4 text-muted-foreground"/>}
                  </button>
                  {expanded && (
                    <div className="space-y-4 border-t border-border bg-muted/20 p-4 sm:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2"><div className="text-xs text-muted-foreground">{customer.address || 'Address not added'}{customer.creditLimit !== null ? ` · Credit limit ${money(customer.creditLimit)}` : ''}</div><Button size="sm" variant="outline" onClick={() => openCustomerForm(customer)}>Edit customer details</Button></div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-foreground" htmlFor={`reminder-${customer.name}`}>Reminder message</label>
                        <Textarea id={`reminder-${customer.name}`} value={reminderMessage} onChange={event => setReminderMessage(event.target.value)} rows={3} />
                        <p className="text-[11px] text-muted-foreground">Use {'{name}'} for the customer’s name and {'{balance}'} for the amount owed.</p>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input aria-label={`WhatsApp number for ${customer.name}`} value={phoneNumbers[customer.name] || ''} onChange={event => setPhoneNumbers(prev => ({ ...prev, [customer.name]: event.target.value }))} placeholder="WhatsApp number with country code"/>
                        <Button onClick={() => sendReminder(customer)} disabled={customer.balance <= 0} className="shrink-0 gap-2"><MessageCircle className="h-4 w-4"/> Send WhatsApp reminder</Button>
                      </div>
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-foreground">Credit and payment history</h3>
                        {customer.sales.map(sale => {
                          const saleBalance = balanceFor(sale)
                          return (
                            <div key={sale.id} className="rounded-lg border border-border bg-background p-3 sm:p-4">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div><p className="font-semibold text-foreground">{sale.item_name}</p><p className="text-xs text-muted-foreground">{dateLabel(sale.sale_date)} · {sale.quantity} {sale.unit_label || 'units'}</p></div>
                                <div className="text-right"><p className="text-sm font-semibold">{money(Number(sale.total_amount || 0))}</p><p className="text-xs text-warning">{money(saleBalance)} due</p></div>
                              </div>
                              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5"/> {payments[sale.id]?.length || 0} recorded {payments[sale.id]?.length === 1 ? 'payment' : 'payments'}</div>
                              {(payments[sale.id] || []).map(payment => <div key={payment.id} className="mt-2 flex justify-between gap-3 border-t border-border pt-2 text-xs"><span>{dateLabel(payment.received_at)} · {payment.payment_method}</span><span className="font-semibold text-success">{money(Number(payment.amount))}</span></div>)}
                              {isAdmin && saleBalance > 0 && (
                                <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row">
                                  <Input aria-label={`Payment amount for ${sale.item_name}`} type="number" min="0.01" max={saleBalance} step="0.01" value={paymentAmounts[sale.id] || ''} onChange={event => setPaymentAmounts(prev => ({ ...prev, [sale.id]: event.target.value }))} className="sm:max-w-48" placeholder="Payment amount"/>
                                  <Button size="sm" variant="outline" disabled={savingPayment === sale.id} onClick={() => handlePayment(sale.id)} className="gap-2 border-success/30 text-success hover:bg-success/10"><CheckCircle2 className="h-4 w-4"/>{savingPayment === sale.id ? 'Saving…' : 'Log payment'}</Button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
      <p className="text-center text-xs text-muted-foreground">Customer contact details and credit preferences are saved to this business’s directory.</p>
    </div>
  )
}
