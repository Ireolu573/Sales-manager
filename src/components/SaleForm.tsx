import { useState, useEffect, useRef } from 'react'
import { getProductsForTenant, insertSale } from '@/lib/tenant-queries'
import { supabase } from '@/integrations/supabase/client'
import type { Product, ProductUnit, PaymentMethod } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PlusCircle, ShoppingCart, Share2, Download, Copy, Check } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Props {
  userId: string
  tenantId: string
  refreshKey?: number
  onSaleAdded: () => void
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
  const [productId, setProductId] = useState('')
  const [selectedUnit, setSelectedUnit] = useState<ProductUnit | null>(null)
  const [quantity, setQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [customerName, setCustomerName] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [lastSale, setLastSale] = useState<any>(null)
  const [copied, setCopied] = useState(false)
  const [company, setCompany] = useState<{ name: string; emoji: string; color: string }>({
    name: '', emoji: '🏪', color: '#d97706'
  })

  const [savedCustomers, setSavedCustomers] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const customerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getProductsForTenant(tenantId).then(({ data }) => { if (data) setProducts(data) })
    supabase
      .from('sales').select('customer_name').eq('tenant_id', tenantId)
      .not('customer_name', 'is', null).order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => {
        if (data) {
          const unique = [...new Set(data.map((s: any) => s.customer_name).filter(Boolean))] as string[]
          setSavedCustomers(unique)
        }
      })
    supabase
      .from('company_settings').select('company_name, logo_emoji, brand_color')
      .eq('tenant_id', tenantId).maybeSingle()
      .then(({ data }) => {
        if (data) setCompany({
          name: data.company_name || '',
          emoji: data.logo_emoji || '🏪',
          color: data.brand_color || '#d97706',
        })
      })
  }, [tenantId, refreshKey])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customerRef.current && !customerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const total = Number(quantity) * Number(unitPrice) || 0
  const selectedProduct = products.find(p => p.id === productId)
  const filteredCustomers = savedCustomers.filter(c =>
    customerName ? c.toLowerCase().includes(customerName.toLowerCase()) && c !== customerName : true
  )

  const handleProductSelect = (id: string) => { setProductId(id); setSelectedUnit(null); setUnitPrice('') }
  const handleUnitSelect = (unitId: string) => {
    const unit = products.find(p => p.id === productId)?.product_units.find(u => u.id === unitId) || null
    setSelectedUnit(unit)
    setUnitPrice(unit ? String(unit.unit_price) : '')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduct || !selectedUnit) return
    setLoading(true)

    const saleData = {
      product_id: productId,
      item_name: selectedProduct.name,
      unit_label: selectedUnit.unit_label,
      quantity: Number(quantity),
      unit_price: Number(unitPrice),
      total_amount: total,
      sale_date: saleDate,
      payment_method: paymentMethod,
      customer_name: customerName || null,
      notes: notes || null,
    }

    const { error } = await insertSale(saleData, tenantId, userId)
    setLoading(false)

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      setLastSale({ ...saleData, total_amount: total, recorded_at: new Date() })
      if (customerName && !savedCustomers.includes(customerName)) setSavedCustomers(prev => [customerName, ...prev])
      setQuantity(''); setUnitPrice(''); setCustomerName(''); setNotes(''); setSelectedUnit(null); setProductId('')
      onSaleAdded()
    }
  }

  // Capture receipt as image blob
  const captureReceiptImage = async (): Promise<Blob | null> => {
    if (!receiptRef.current) return null
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: '#ffffff',
        scale: 3, // high res for sharing
        useCORS: true,
        logging: false,
      })
      return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
    } catch (err) {
      console.error('Capture failed:', err)
      return null
    }
  }

  // Share image via Web Share API (works on Android/iOS)
  // Falls back to download on desktop
  const shareImage = async () => {
    setSharing(true)
    try {
      const blob = await captureReceiptImage()
      if (!blob) throw new Error('Could not capture receipt')

      const file = new File([blob], `receipt-${Date.now()}.png`, { type: 'image/png' })

      // Web Share API — works on Android Chrome, iOS Safari
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Sales Receipt',
        })
      } else {
        // Desktop fallback — download the image
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `receipt-${Date.now()}.png`
        a.click()
        URL.revokeObjectURL(url)
        toast({ title: 'Receipt downloaded!', description: 'Open your downloads to find the receipt image.' })
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        toast({ title: 'Share failed', description: 'Try the copy option instead.', variant: 'destructive' })
      }
    } finally {
      setSharing(false)
    }
  }

  // Copy text receipt
  const buildReceiptText = () => {
    if (!lastSale) return ''
    const date = new Date(lastSale.sale_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
    const time = lastSale.recorded_at ? new Date(lastSale.recorded_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''
    const pm = PAYMENT_METHODS.find(m => m.value === lastSale.payment_method)
    return [
      `🧾 *SALES RECEIPT*`,
      company.name ? `${company.emoji} *${company.name}*` : '',
      `━━━━━━━━━━━━━━━━━━`,
      `📦 *${lastSale.item_name}*`,
      `   ${lastSale.quantity} ${lastSale.unit_label} × ₦${Number(lastSale.unit_price).toLocaleString()}`,
      `━━━━━━━━━━━━━━━━━━`,
      `💰 *Total: ₦${Number(lastSale.total_amount).toLocaleString()}*`,
      `${pm?.icon || ''} Payment: ${lastSale.payment_method.toUpperCase()}`,
      lastSale.customer_name ? `👤 Customer: ${lastSale.customer_name}` : '',
      `📅 ${date}${time ? ' · ' + time : ''}`,
      lastSale.notes ? `📝 ${lastSale.notes}` : '',
      `━━━━━━━━━━━━━━━━━━`,
      `Thank you for your patronage! 🙏`,
    ].filter(Boolean).join('\n')
  }

  const copyReceipt = async () => {
    await navigator.clipboard.writeText(buildReceiptText())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast({ title: 'Receipt copied!' })
  }

  const receiptDate = lastSale ? new Date(lastSale.sale_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) : ''
  const receiptTime = lastSale?.recorded_at ? new Date(lastSale.recorded_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''
  const badge = lastSale ? PAYMENT_BADGE[lastSale.payment_method] || PAYMENT_BADGE.cash : null
  const pm = lastSale ? PAYMENT_METHODS.find(m => m.value === lastSale.payment_method) : null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ShoppingCart className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-bold text-foreground text-lg">Record Sale</h2>
          <p className="text-sm text-muted-foreground">Add a new transaction</p>
        </div>
      </div>

      {/* ── RECEIPT CARD ── */}
      {lastSale && (
        <div className="flex flex-col items-center gap-3">
          {/* The receipt — captured by html2canvas */}
          <div ref={receiptRef} style={{
            width: 320,
            background: '#ffffff',
            borderRadius: 16,
            overflow: 'hidden',
            fontFamily: 'system-ui, sans-serif',
          }}>
            {/* Header */}
            <div style={{ background: company.color, padding: '20px 16px', textAlign: 'center', color: '#ffffff' }}>
              <div style={{ fontSize: 28, marginBottom: 4 }}>{company.emoji}</div>
              {company.name && (
                <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.95, letterSpacing: '0.04em' }}>
                  {company.name.toUpperCase()}
                </div>
              )}
              <div style={{ fontSize: 11, opacity: 0.75, marginTop: 3 }}>SALES RECEIPT</div>
            </div>

            {/* Dashed separator */}
            <div style={{ borderBottom: '2px dashed #e5e7eb', margin: '0 16px' }} />

            {/* Body */}
            <div style={{ padding: 16, background: '#ffffff' }}>
              {/* Total */}
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 34, fontWeight: 700, color: '#111827' }}>
                  ₦{Number(lastSale.total_amount).toLocaleString()}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Total Amount</div>
              </div>

              {/* Item details box */}
              <div style={{ background: '#f9fafb', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 8 }}>
                  {lastSale.item_name}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                  <span style={{ color: '#6b7280' }}>Quantity</span>
                  <span style={{ color: '#111827', fontWeight: 600 }}>{lastSale.quantity} {lastSale.unit_label}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                  <span style={{ color: '#6b7280' }}>Unit Price</span>
                  <span style={{ color: '#111827', fontWeight: 600 }}>₦{Number(lastSale.unit_price).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, alignItems: 'center' }}>
                  <span style={{ color: '#6b7280' }}>Payment</span>
                  <span style={{
                    background: badge?.bg, color: badge?.color,
                    padding: '3px 10px', borderRadius: 20, fontWeight: 600, fontSize: 11,
                  }}>
                    {pm?.icon} {lastSale.payment_method.charAt(0).toUpperCase() + lastSale.payment_method.slice(1)}
                  </span>
                </div>
              </div>

              {/* Customer + Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                {lastSale.customer_name && (
                  <div style={{ background: '#f9fafb', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Customer</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', marginTop: 2 }}>{lastSale.customer_name}</div>
                  </div>
                )}
                <div style={{
                  background: '#f9fafb', borderRadius: 10, padding: '10px 12px',
                  gridColumn: lastSale.customer_name ? 'auto' : '1 / -1',
                }}>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>Date & Time</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', marginTop: 2 }}>
                    {receiptDate}
                    {receiptTime && <span style={{ fontWeight: 400, color: '#6b7280' }}> · {receiptTime}</span>}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {lastSale.notes && (
                <div style={{ background: '#f9fafb', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>Note</div>
                  <div style={{ fontSize: 12, color: '#111827', marginTop: 2 }}>{lastSale.notes}</div>
                </div>
              )}

              {/* Credit warning */}
              {lastSale.payment_method === 'credit' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#854F0B', marginBottom: 10, fontWeight: 600 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF9F27' }} />
                  Credit sale — payment pending
                </div>
              )}

              {/* Dashed + thank you */}
              <div style={{ borderTop: '2px dashed #e5e7eb', paddingTop: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>Thank you for your patronage! 🙏</div>
              </div>
            </div>
          </div>

          {/* Action buttons BELOW receipt (not captured) */}
          <div style={{ display: 'flex', gap: 8, width: 320 }}>
            <button
              onClick={shareImage}
              disabled={sharing}
              style={{
                flex: 1, background: '#25D366', color: 'white',
                border: 'none', borderRadius: 10, padding: '11px 0',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                opacity: sharing ? 0.7 : 1,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.998 2.002C6.478 2.002 2 6.48 2 12c0 1.85.502 3.58 1.378 5.065L2 22l5.085-1.344A9.955 9.955 0 0011.998 22C17.52 22 22 17.52 22 12s-4.48-9.998-10.002-9.998zm0 18.18a8.18 8.18 0 01-4.17-1.14l-.3-.178-3.017.797.808-2.947-.196-.31A8.19 8.19 0 013.82 12c0-4.508 3.67-8.178 8.178-8.178S20.178 7.492 20.178 12c0 4.508-3.67 8.182-8.18 8.182z"/></svg>
              {sharing ? 'Capturing...' : 'Share Image'}
            </button>
            <button
              onClick={copyReceipt}
              style={{
                flex: 1, background: '#f3f4f6', color: '#374151',
                border: '0.5px solid #e5e7eb', borderRadius: 10, padding: '11px 0',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {copied ? '✓ Copied!' : '⎘ Copy Text'}
            </button>
            <button
              onClick={() => setLastSale(null)}
              style={{
                width: 40, background: '#f3f4f6', color: '#9ca3af',
                border: '0.5px solid #e5e7eb', borderRadius: 10,
                fontSize: 16, cursor: 'pointer', fontWeight: 600,
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* ── SALE FORM ── */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Product</Label>
                <Select value={productId} onValueChange={handleProductSelect}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={selectedUnit?.id || ''} onValueChange={handleUnitSelect} disabled={!productId}>
                  <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                  <SelectContent>
                    {selectedProduct?.product_units.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.unit_label} — ₦{u.unit_price.toLocaleString()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" required />
              </div>
              <div className="space-y-2">
                <Label>Unit Price (₦)</Label>
                <Input type="number" min="0" step="0.01" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder="0.00" required />
              </div>
            </div>

            {total > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 text-center">
                <span className="text-sm text-muted-foreground">Total: </span>
                <span className="text-xl font-bold text-primary">₦{total.toLocaleString()}</span>
              </div>
            )}

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

            <Button type="submit" disabled={loading || !selectedUnit || !quantity} className="w-full h-11 gap-2 font-semibold">
              <PlusCircle className="w-4 h-4" />
              {loading ? 'Recording...' : 'Record Sale'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}