import { useState, useEffect, useRef } from 'react'
import { getProductsForTenant } from '@/lib/tenant-queries'
import { supabase } from '@/integrations/supabase/client'
import type { Product, ProductUnit, PaymentMethod } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PlusCircle, ShoppingCart, Trash2, Plus, Minus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Props {
  userId: string
  tenantId: string
  refreshKey?: number
  onSaleAdded: () => void
}

interface CartItem {
  id: string // temp ID for UI
  productId: string
  productName: string
  unit: ProductUnit
  quantity: number
  unitPrice: number
  total: number
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'cash', label: 'Cash', icon: '💵' },
  { value: 'transfer', label: 'Transfer', icon: '🏦' },
  { value: 'pos', label: 'POS', icon: '💳' },
  { value: 'credit', label: 'Credit', icon: '📋' },
]

const PAYMENT_BADGE: Record<string, { bg: string; color: string }> = {
  cash:     { bg: '#EAF3DE', color: '#3B6D11' },
  transfer: { bg: '#E6F1FB', color: '#185FA5' },
  pos:      { bg: '#EEEDFE', color: '#534AB7' },
  credit:   { bg: '#FAEEDA', color: '#854F0B' },
}

export default function SaleForm({ userId, tenantId, refreshKey, onSaleAdded }: Props) {
  const { toast } = useToast()
  const receiptRef = useRef<HTMLDivElement>(null)

  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])

  // Current item being added
  const [productId, setProductId] = useState('')
  const [selectedUnit, setSelectedUnit] = useState<ProductUnit | null>(null)
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState('')

  // Transaction-level fields
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [customerName, setCustomerName] = useState('')
  const [notes, setNotes] = useState('')

  const [loading, setLoading] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [lastTransaction, setLastTransaction] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  const [company, setCompany] = useState<{ name: string; emoji: string; color: string }>({
    name: '', emoji: '🏪', color: '#d97706'
  })
  const [savedCustomers, setSavedCustomers] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const customerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getProductsForTenant(tenantId).then(({ data }) => { if (data) setProducts(data) })
    supabase.from('sales').select('customer_name').eq('tenant_id', tenantId)
      .not('customer_name', 'is', null).order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => {
        if (data) setSavedCustomers([...new Set(data.map((s: any) => s.customer_name).filter(Boolean))] as string[])
      })
    supabase.from('company_settings').select('company_name, logo_emoji, brand_color')
      .eq('tenant_id', tenantId).maybeSingle()
      .then(({ data }) => {
        if (data) setCompany({ name: data.company_name || '', emoji: data.logo_emoji || '🏪', color: data.brand_color || '#d97706' })
      })
  }, [tenantId, refreshKey])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customerRef.current && !customerRef.current.contains(e.target as Node)) setShowSuggestions(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectedProduct = products.find(p => p.id === productId)
  const itemTotal = Number(quantity) * Number(unitPrice) || 0
  const cartTotal = cart.reduce((sum, item) => sum + item.total, 0)
  const filteredCustomers = savedCustomers.filter(c =>
    customerName ? c.toLowerCase().includes(customerName.toLowerCase()) && c !== customerName : true
  )

  const handleProductSelect = (id: string) => {
    setProductId(id)
    setSelectedUnit(null)
    setUnitPrice('')
  }

  const handleUnitSelect = (unitId: string) => {
    const unit = products.find(p => p.id === productId)?.product_units.find(u => u.id === unitId) || null
    setSelectedUnit(unit)
    setUnitPrice(unit ? String(unit.unit_price) : '')
  }

  const addToCart = () => {
    if (!selectedProduct || !selectedUnit || !quantity || !unitPrice) return
    const newItem: CartItem = {
      id: crypto.randomUUID(),
      productId,
      productName: selectedProduct.name,
      unit: selectedUnit,
      quantity: Number(quantity),
      unitPrice: Number(unitPrice),
      total: Number(quantity) * Number(unitPrice),
    }
    setCart(prev => [...prev, newItem])
    // Reset item fields but keep transaction fields
    setProductId('')
    setSelectedUnit(null)
    setQuantity('1')
    setUnitPrice('')
  }

  const removeFromCart = (id: string) => setCart(prev => prev.filter(item => item.id !== id))

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id !== id) return item
      const newQty = Math.max(0.5, item.quantity + delta)
      return { ...item, quantity: newQty, total: newQty * item.unitPrice }
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cart.length === 0) {
      toast({ title: 'Add at least one item to the cart', variant: 'destructive' })
      return
    }
    setLoading(true)

    // Generate a shared transaction_id for all items in this sale
    const transactionId = crypto.randomUUID()
    const recordedAt = new Date()

    const rows = cart.map(item => ({
      product_id: item.productId,
      item_name: item.productName,
      unit_label: item.unit.unit_label,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      sale_date: saleDate,
      payment_method: paymentMethod,
      customer_name: customerName || null,
      notes: notes || null,
      transaction_id: transactionId,
      tenant_id: tenantId,
      user_id: userId,
    }))

    const { error } = await supabase.from('sales').insert(rows)
    setLoading(false)

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      setLastTransaction({
        items: [...cart],
        total: cartTotal,
        paymentMethod,
        customerName: customerName || null,
        notes: notes || null,
        saleDate,
        recordedAt,
      })
      if (customerName && !savedCustomers.includes(customerName)) setSavedCustomers(prev => [customerName, ...prev])
      setCart([])
      setCustomerName('')
      setNotes('')
      onSaleAdded()
    }
  }

  const buildReceiptText = () => {
    if (!lastTransaction) return ''
    const date = new Date(lastTransaction.saleDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
    const time = new Date(lastTransaction.recordedAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: true })
    const pm = PAYMENT_METHODS.find(m => m.value === lastTransaction.paymentMethod)
    const itemLines = lastTransaction.items.map((item: CartItem) =>
      `📦 ${item.productName} (${item.quantity} ${item.unit.unit_label} × ₦${item.unitPrice.toLocaleString()}) = ₦${item.total.toLocaleString()}`
    )
    return [
      `🧾 *SALES RECEIPT*`,
      company.name ? `${company.emoji} *${company.name}*` : '',
      `━━━━━━━━━━━━━━━━━━`,
      ...itemLines,
      `━━━━━━━━━━━━━━━━━━`,
      `💰 *Total: ₦${lastTransaction.total.toLocaleString()}*`,
      `${pm?.icon || ''} Payment: ${lastTransaction.paymentMethod.toUpperCase()}`,
      lastTransaction.customerName ? `👤 Customer: ${lastTransaction.customerName}` : '',
      `📅 ${date} · ${time}`,
      lastTransaction.notes ? `📝 ${lastTransaction.notes}` : '',
      `━━━━━━━━━━━━━━━━━━`,
      `Thank you for your patronage! 🙏`,
    ].filter(Boolean).join('\n')
  }

  const shareImage = async () => {
    setSharing(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(receiptRef.current!, {
        backgroundColor: '#ffffff', scale: 3, useCORS: true, logging: false,
      })
      const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/png'))
      const file = new File([blob], `receipt-${Date.now()}.png`, { type: 'image/png' })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Sales Receipt' })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `receipt-${Date.now()}.png`; a.click()
        URL.revokeObjectURL(url)
        toast({ title: 'Receipt downloaded!' })
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') toast({ title: 'Share failed', variant: 'destructive' })
    } finally {
      setSharing(false)
    }
  }

  const copyReceipt = async () => {
    await navigator.clipboard.writeText(buildReceiptText())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast({ title: 'Receipt copied!' })
  }

  const receiptDate = lastTransaction ? new Date(lastTransaction.saleDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) : ''
  const receiptTime = lastTransaction?.recordedAt ? new Date(lastTransaction.recordedAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''
  const badge = lastTransaction ? PAYMENT_BADGE[lastTransaction.paymentMethod] : null
  const pm = lastTransaction ? PAYMENT_METHODS.find(m => m.value === lastTransaction.paymentMethod) : null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ShoppingCart className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-bold text-foreground text-lg">Record Sale</h2>
          <p className="text-sm text-muted-foreground">Add multiple items in one transaction</p>
        </div>
      </div>

      {/* ── RECEIPT CARD ── */}
      {lastTransaction && (
        <div className="flex flex-col items-center gap-3">
          <div ref={receiptRef} style={{ width: 320, background: '#ffffff', borderRadius: 16, overflow: 'hidden', fontFamily: 'system-ui, sans-serif' }}>
            {/* Header */}
            <div style={{ background: company.color, padding: '20px 16px', textAlign: 'center', color: '#ffffff' }}>
              <div style={{ fontSize: 28, marginBottom: 4 }}>{company.emoji}</div>
              {company.name && <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.95, letterSpacing: '0.04em' }}>{company.name.toUpperCase()}</div>}
              <div style={{ fontSize: 11, opacity: 0.75, marginTop: 3 }}>SALES RECEIPT</div>
            </div>

            <div style={{ borderBottom: '2px dashed #e5e7eb', margin: '0 16px' }} />

            <div style={{ padding: 16, background: '#ffffff' }}>
              {/* Grand total */}
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 34, fontWeight: 700, color: '#111827' }}>₦{lastTransaction.total.toLocaleString()}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Total Amount · {lastTransaction.items.length} item{lastTransaction.items.length > 1 ? 's' : ''}</div>
              </div>

              {/* Items list */}
              <div style={{ background: '#f9fafb', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                {lastTransaction.items.map((item: CartItem, i: number) => (
                  <div key={item.id} style={{
                    paddingBottom: i < lastTransaction.items.length - 1 ? 10 : 0,
                    marginBottom: i < lastTransaction.items.length - 1 ? 10 : 0,
                    borderBottom: i < lastTransaction.items.length - 1 ? '1px solid #e5e7eb' : 'none',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{item.productName}</div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                          {item.quantity} {item.unit.unit_label} × ₦{item.unitPrice.toLocaleString()}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>₦{item.total.toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Payment + date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <div style={{ background: '#f9fafb', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>Payment</div>
                  <div style={{ marginTop: 4 }}>
                    <span style={{ background: badge?.bg, color: badge?.color, padding: '3px 10px', borderRadius: 20, fontWeight: 600, fontSize: 11 }}>
                      {pm?.icon} {lastTransaction.paymentMethod.charAt(0).toUpperCase() + lastTransaction.paymentMethod.slice(1)}
                    </span>
                  </div>
                </div>
                <div style={{ background: '#f9fafb', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>Date & Time</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', marginTop: 2 }}>
                    {receiptDate}<span style={{ fontWeight: 400, color: '#6b7280' }}> · {receiptTime}</span>
                  </div>
                </div>
              </div>

              {lastTransaction.customerName && (
                <div style={{ background: '#f9fafb', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>Customer</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', marginTop: 2 }}>👤 {lastTransaction.customerName}</div>
                </div>
              )}

              {lastTransaction.notes && (
                <div style={{ background: '#f9fafb', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>Note</div>
                  <div style={{ fontSize: 12, color: '#111827', marginTop: 2 }}>{lastTransaction.notes}</div>
                </div>
              )}

              {lastTransaction.paymentMethod === 'credit' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#854F0B', marginBottom: 10, fontWeight: 600 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF9F27' }} />
                  Credit sale — payment pending
                </div>
              )}

              <div style={{ borderTop: '2px dashed #e5e7eb', paddingTop: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>Thank you for your patronage! 🙏</div>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 8, width: 320 }}>
            <button onClick={shareImage} disabled={sharing} style={{
              flex: 1, background: '#25D366', color: 'white', border: 'none', borderRadius: 10,
              padding: '11px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: sharing ? 0.7 : 1,
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.998 2.002C6.478 2.002 2 6.48 2 12c0 1.85.502 3.58 1.378 5.065L2 22l5.085-1.344A9.955 9.955 0 0011.998 22C17.52 22 22 17.52 22 12s-4.48-9.998-10.002-9.998zm0 18.18a8.18 8.18 0 01-4.17-1.14l-.3-.178-3.017.797.808-2.947-.196-.31A8.19 8.19 0 013.82 12c0-4.508 3.67-8.178 8.178-8.178S20.178 7.492 20.178 12c0 4.508-3.67 8.182-8.18 8.182z"/></svg>
              {sharing ? 'Capturing...' : 'Share Image'}
            </button>
            <button onClick={copyReceipt} style={{
              flex: 1, background: '#f3f4f6', color: '#374151', border: '0.5px solid #e5e7eb',
              borderRadius: 10, padding: '11px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              {copied ? '✓ Copied!' : '⎘ Copy Text'}
            </button>
            <button onClick={() => setLastTransaction(null)} style={{
              width: 40, background: '#f3f4f6', color: '#9ca3af', border: '0.5px solid #e5e7eb',
              borderRadius: 10, fontSize: 18, cursor: 'pointer', fontWeight: 600,
            }}>×</button>
          </div>
        </div>
      )}

      {/* ── ITEM PICKER ── */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Add Item</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Product</Label>
              <Select value={productId} onValueChange={handleProductSelect}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Unit</Label>
              <Select value={selectedUnit?.id || ''} onValueChange={handleUnitSelect} disabled={!productId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {selectedProduct?.product_units.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.unit_label} — ₦{u.unit_price.toLocaleString()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Qty</Label>
              <Input type="number" min="0.5" step="0.5" value={quantity} onChange={e => setQuantity(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Price (₦)</Label>
              <Input type="number" min="0" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} className="h-9" />
            </div>
          </div>

          {itemTotal > 0 && (
            <p className="text-xs text-muted-foreground text-right">Item total: <span className="font-semibold text-foreground">₦{itemTotal.toLocaleString()}</span></p>
          )}

          <Button
            type="button"
            onClick={addToCart}
            disabled={!selectedUnit || !quantity || !unitPrice}
            className="w-full h-9 gap-1.5"
            variant="outline"
          >
            <Plus className="w-4 h-4" /> Add to Cart
          </Button>
        </CardContent>
      </Card>

      {/* ── CART ── */}
      {cart.length > 0 && (
        <Card className="border-primary/20 bg-primary/5 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Cart · {cart.length} item{cart.length > 1 ? 's' : ''}
              </p>
              <p className="text-sm font-bold text-primary">₦{cartTotal.toLocaleString()}</p>
            </div>

            <div className="space-y-2">
              {cart.map(item => (
                <div key={item.id} className="flex items-center gap-2 bg-card rounded-xl px-3 py-2.5 border border-border/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">{item.unit.unit_label} · ₦{item.unitPrice.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => updateQty(item.id, -0.5)}
                      className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-semibold w-8 text-center">{item.quantity}</span>
                    <button onClick={() => updateQty(item.id, 0.5)}
                      className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-sm font-bold text-foreground w-20 text-right shrink-0">
                    ₦{item.total.toLocaleString()}
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="text-destructive/60 hover:text-destructive ml-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── TRANSACTION DETAILS + SUBMIT ── */}
      {cart.length > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Transaction Details</p>

              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Payment Method</Label>
                <div className="grid grid-cols-4 gap-2">
                  {PAYMENT_METHODS.map(m => (
                    <button key={m.value} type="button" onClick={() => setPaymentMethod(m.value)}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                        paymentMethod === m.value ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/30'
                      }`}>
                      <span className="text-lg">{m.icon}</span>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2" ref={customerRef}>
                <Label>
                  Customer Name
                  {paymentMethod === 'credit' ? <span className="text-destructive ml-1">*</span> : <span className="text-muted-foreground text-xs ml-1">(optional)</span>}
                  {savedCustomers.length > 0 && <span className="text-xs text-primary ml-2">📖 {savedCustomers.length} saved</span>}
                </Label>
                <div className="relative">
                  <Input value={customerName}
                    onChange={e => { setCustomerName(e.target.value); setShowSuggestions(true) }}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder="e.g. Mr. Emeka" required={paymentMethod === 'credit'} />
                  {showSuggestions && filteredCustomers.length > 0 && (
                    <div className="absolute z-10 w-full bg-card border border-border rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                      {filteredCustomers.slice(0, 8).map(c => (
                        <button key={c} type="button" onMouseDown={() => { setCustomerName(c); setShowSuggestions(false) }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted text-foreground border-b border-border/50 last:border-0">
                          👤 {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes..." rows={2} />
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{cart.length} item{cart.length > 1 ? 's' : ''}</span>
                <span className="text-xl font-bold text-primary">₦{cartTotal.toLocaleString()}</span>
              </div>

              <Button type="submit" disabled={loading} className="w-full h-11 gap-2 font-semibold">
                <PlusCircle className="w-4 h-4" />
                {loading ? 'Recording...' : `Record Sale · ₦${cartTotal.toLocaleString()}`}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {cart.length === 0 && !lastTransaction && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Select a product and tap <strong>Add to Cart</strong> to start</p>
        </div>
      )}
    </div>
  )
}