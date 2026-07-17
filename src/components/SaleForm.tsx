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
import { PlusCircle, ShoppingCart, Trash2, Package, Zap, Plus, Banknote, Landmark, CreditCard, FileClock, BookUser, User, type LucideIcon } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { enqueueSale } from '@/lib/offlineQueue'
import { useAuth } from '@/hooks/useAuth'

// ── Receipt ──────────────────────────────────────────────────
import { lazy, Suspense } from 'react'
import type { ReceiptData } from '@/components/receipt/ReceiptCanvas'
const ReceiptShareSheet = lazy(() => import('@/components/receipt/ReceiptShareSheet'))

// ── Today summary ────────────────────────────────────────────
import TodaySummaryCard from '@/components/TodaySummaryCard'

interface Props {
  userId: string
  tenantId: string
}

interface LineItem {
  id: string
  productId: string
  selectedUnit: ProductUnit | null
  quantity: string
  unitPrice: string
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: LucideIcon }[] = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'transfer', label: 'Transfer', icon: Landmark },
  { value: 'pos', label: 'POS', icon: CreditCard },
  { value: 'credit', label: 'Credit', icon: FileClock },
]

function newLine(): LineItem {
  return { id: crypto.randomUUID(), productId: '', selectedUnit: null, quantity: '', unitPrice: '' }
}

export default function SaleForm({ userId, tenantId }: Props) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { isAdmin, company } = useAuth()

  const [products, setProducts] = useState<Product[]>([])
  const [mode, setMode] = useState<'single' | 'bulk'>('single')

  const [productId, setProductId] = useState('')
  const [selectedUnit, setSelectedUnit] = useState<ProductUnit | null>(null)
  const [quantity, setQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')

  const [lineItems, setLineItems] = useState<LineItem[]>([newLine()])

  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [customerName, setCustomerName] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  // ── receipt state ─────────────────────────────────────────
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)

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
  }, [tenantId])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customerRef.current && !customerRef.current.contains(e.target as Node)) setShowSuggestions(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const singleTotal = Number(quantity) * Number(unitPrice) || 0
  const selectedProduct = products.find(p => p.id === productId)
  const bulkTotal = lineItems.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice) || 0), 0)
  const filteredCustomers = savedCustomers.filter(c =>
    customerName ? c.toLowerCase().includes(customerName.toLowerCase()) && c !== customerName : true
  )

  const buildReceiptData = (items: any[], total: number): ReceiptData => ({
    items,
    total,
    paymentMethod,
    customerName,
    saleDate,
    notes,
    companyName: company.company_name,
    appName: company.app_name,
    logoEmoji: company.logo_emoji,
    brandColor: company.brand_color,
  })

  const handleProductSelect = (id: string) => { setProductId(id); setSelectedUnit(null); setUnitPrice('') }
  const handleUnitSelect = (unitId: string) => {
    const product = products.find(p => p.id === productId)
    const unit = product?.product_units.find(u => u.id === unitId) || null
    setSelectedUnit(unit)
    setUnitPrice(unit ? String(unit.unit_price) : '')
  }

  const updateLine = (id: string, patch: Partial<LineItem>) => setLineItems(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
  const handleBulkProductSelect = (lineId: string, prodId: string) => updateLine(lineId, { productId: prodId, selectedUnit: null, unitPrice: '' })
  const handleBulkUnitSelect = (lineId: string, unitId: string, prodId: string) => {
    const unit = products.find(p => p.id === prodId)?.product_units.find(u => u.id === unitId) || null
    updateLine(lineId, { selectedUnit: unit, unitPrice: unit ? String(unit.unit_price) : '' })
  }
  const addLine = () => setLineItems(prev => [...prev, newLine()])
  const removeLine = (id: string) => setLineItems(prev => prev.filter(l => l.id !== id))

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduct || !selectedUnit) return
    setLoading(true)
    const saleData = {
      product_id: productId,
      item_name: selectedProduct.name,
      unit_label: selectedUnit.unit_label,
      quantity: Number(quantity),
      unit_price: Number(unitPrice),
      total_amount: singleTotal,
      sale_date: saleDate,
      payment_method: paymentMethod,
      paid_at: paymentMethod !== 'credit' ? new Date().toISOString() : null,
      customer_name: customerName || null,
      notes: notes || null,
    }

    if (!navigator.onLine) {
      enqueueSale(saleData, tenantId, userId)
      setLoading(false)
      toast({ title: 'Sale queued', description: `Will sync when back online — ₦${singleTotal.toLocaleString()}` })
      const rd = buildReceiptData([saleData], singleTotal)
      setReceiptData(rd); setShowReceipt(true)
      setQuantity(''); setUnitPrice(''); setCustomerName(''); setNotes(''); setSelectedUnit(null)
      return
    }

    const { error } = await insertSale(saleData, tenantId, userId)
    setLoading(false)
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      if (customerName && !savedCustomers.includes(customerName)) setSavedCustomers(prev => [customerName, ...prev])
      toast({ title: 'Sale recorded!', description: `₦${singleTotal.toLocaleString()} — ${selectedProduct.name}` })
      const rd = buildReceiptData([saleData], singleTotal)
      setReceiptData(rd); setShowReceipt(true)
      setQuantity(''); setUnitPrice(''); setCustomerName(''); setNotes(''); setSelectedUnit(null)
      queryClient.invalidateQueries({ queryKey: ['sales', tenantId] })
    }
  }

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validLines = lineItems.filter(l => l.selectedUnit && l.quantity && Number(l.quantity) > 0)
    if (validLines.length === 0) return
    setLoading(true)

    const bulkSaleData = validLines.map(line => {
      const prod = products.find(p => p.id === line.productId)
      return {
        product_id: line.productId,
        item_name: prod?.name || '',
        unit_label: line.selectedUnit!.unit_label,
        quantity: Number(line.quantity),
        unit_price: Number(line.unitPrice),
        total_amount: Number(line.quantity) * Number(line.unitPrice),
        sale_date: saleDate,
        payment_method: paymentMethod,
        paid_at: paymentMethod !== 'credit' ? new Date().toISOString() : null,
        customer_name: customerName || null,
        notes: notes || null,
      }
    })

    if (!navigator.onLine) {
      bulkSaleData.forEach(sd => enqueueSale(sd, tenantId, userId))
      setLoading(false)
      toast({ title: `${validLines.length} item(s) queued`, description: `Will sync when back online — ₦${bulkTotal.toLocaleString()}` })
      const rd = buildReceiptData(bulkSaleData, bulkTotal)
      setReceiptData(rd); setShowReceipt(true)
      setLineItems([newLine()]); setCustomerName(''); setNotes('')
      return
    }

    const results = await Promise.all(bulkSaleData.map(sd => insertSale(sd, tenantId, userId)))
    setLoading(false)
    const errors = results.filter(r => r.error)
    if (errors.length > 0) {
      toast({ title: 'Some items failed', description: `${errors.length} item(s) not saved.`, variant: 'destructive' })
    } else {
      if (customerName && !savedCustomers.includes(customerName)) setSavedCustomers(prev => [customerName, ...prev])
      toast({ title: `${validLines.length} items recorded!`, description: `Total: ₦${bulkTotal.toLocaleString()}` })
      const rd = buildReceiptData(bulkSaleData, bulkTotal)
      setReceiptData(rd); setShowReceipt(true)
      setLineItems([newLine()]); setCustomerName(''); setNotes('')
      queryClient.invalidateQueries({ queryKey: ['sales', tenantId] })
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Today's summary ── */}
      <TodaySummaryCard userId={userId} tenantId={tenantId} isAdmin={isAdmin} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-foreground text-lg">Record Sale</h2>
            <p className="text-sm text-muted-foreground">Add a new transaction</p>
          </div>
        </div>
        <div className="flex items-center bg-muted rounded-xl p-1 gap-1">
          <button onClick={() => setMode('single')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${mode === 'single' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <Package className="w-3.5 h-3.5" /> Single
          </button>
          <button onClick={() => setMode('bulk')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${mode === 'bulk' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <Zap className="w-3.5 h-3.5" /> Bulk
          </button>
        </div>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-5">
          {mode === 'single' ? (
            <form onSubmit={handleSingleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Product</Label>
                  <Select value={productId} onValueChange={handleProductSelect}>
                    <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
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
                  <Input type="number" min="0.01" step="0.01" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" required />
                </div>
                <div className="space-y-2">
                  <Label>Unit Price (₦)</Label>
                  <Input type="number" min="0" step="0.01" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder="0.00" required />
                </div>
              </div>
              {singleTotal > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 text-center">
                  <span className="text-sm text-muted-foreground">Total: </span>
                  <span className="text-xl font-bold text-primary">₦{singleTotal.toLocaleString()}</span>
                </div>
              )}
              <SharedFields
                saleDate={saleDate} setSaleDate={setSaleDate}
                paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
                customerName={customerName} setCustomerName={setCustomerName}
                notes={notes} setNotes={setNotes}
                savedCustomers={savedCustomers}
                filteredCustomers={filteredCustomers}
                showSuggestions={showSuggestions} setShowSuggestions={setShowSuggestions}
                customerRef={customerRef}
              />
              <Button type="submit" disabled={loading || !selectedUnit || !quantity} className="w-full h-11 gap-2 font-semibold">
                <PlusCircle className="w-4 h-4" />
                {loading ? 'Recording...' : 'Record Sale'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleBulkSubmit} className="space-y-4">
              <div className="space-y-2">
                {lineItems.map((line, idx) => (
                  <BulkLineItem
                    key={line.id} line={line} index={idx} products={products}
                    onProductSelect={(id) => handleBulkProductSelect(line.id, id)}
                    onUnitSelect={(unitId) => handleBulkUnitSelect(line.id, unitId, line.productId)}
                    onQtyChange={(v) => updateLine(line.id, { quantity: v })}
                    onPriceChange={(v) => updateLine(line.id, { unitPrice: v })}
                    onRemove={() => removeLine(line.id)}
                    canRemove={lineItems.length > 1}
                  />
                ))}
                <button type="button" onClick={addLine}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-border text-muted-foreground text-sm font-medium hover:border-primary/40 hover:text-primary transition-all">
                  <Plus className="w-4 h-4" /> Add item
                </button>
              </div>
              {bulkTotal > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{lineItems.filter(l => l.selectedUnit && l.quantity).length} item(s)</span>
                  <div>
                    <span className="text-sm text-muted-foreground">Total: </span>
                    <span className="text-xl font-bold text-primary">₦{bulkTotal.toLocaleString()}</span>
                  </div>
                </div>
              )}
              <SharedFields
                saleDate={saleDate} setSaleDate={setSaleDate}
                paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
                customerName={customerName} setCustomerName={setCustomerName}
                notes={notes} setNotes={setNotes}
                savedCustomers={savedCustomers}
                filteredCustomers={filteredCustomers}
                showSuggestions={showSuggestions} setShowSuggestions={setShowSuggestions}
                customerRef={customerRef}
              />
              <Button type="submit"
                disabled={loading || lineItems.filter(l => l.selectedUnit && l.quantity).length === 0}
                className="w-full h-11 gap-2 font-semibold">
                <Zap className="w-4 h-4" />
                {loading ? 'Recording...' : `Record ${lineItems.filter(l => l.selectedUnit && l.quantity).length} Item(s)`}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* ── Receipt share sheet ── */}
      {showReceipt && receiptData && (
        <Suspense fallback={null}>
          <ReceiptShareSheet
            data={receiptData}
            onClose={() => { setShowReceipt(false); setReceiptData(null) }}
          />
        </Suspense>
      )}
    </div>
  )
}

function BulkLineItem({ line, index, products, onProductSelect, onUnitSelect, onQtyChange, onPriceChange, onRemove, canRemove }: {
  line: LineItem; index: number; products: Product[]
  onProductSelect: (id: string) => void; onUnitSelect: (unitId: string) => void
  onQtyChange: (v: string) => void; onPriceChange: (v: string) => void
  onRemove: () => void; canRemove: boolean
}) {
  const selectedProduct = products.find(p => p.id === line.productId)
  const lineTotal = (Number(line.quantity) * Number(line.unitPrice)) || 0
  return (
    <div className="bg-muted/40 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Item {index + 1}</span>
        <div className="flex items-center gap-2">
          {lineTotal > 0 && <span className="text-xs font-bold text-primary">₦{lineTotal.toLocaleString()}</span>}
          {canRemove && (
            <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors p-0.5">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select value={line.productId} onValueChange={onProductSelect}>
          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Product" /></SelectTrigger>
          <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={line.selectedUnit?.id || ''} onValueChange={onUnitSelect} disabled={!line.productId}>
          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Unit" /></SelectTrigger>
          <SelectContent>
            {selectedProduct?.product_units.map(u => (
              <SelectItem key={u.id} value={u.id}>{u.unit_label} — ₦{u.unit_price.toLocaleString()}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input type="number" min="0.01" step="0.01" value={line.quantity} onChange={e => onQtyChange(e.target.value)} placeholder="Qty" className="h-9 text-sm" />
        <Input type="number" min="0" step="0.01" value={line.unitPrice} onChange={e => onPriceChange(e.target.value)} placeholder="Price (₦)" className="h-9 text-sm" />
      </div>
    </div>
  )
}

function SharedFields({ saleDate, setSaleDate, paymentMethod, setPaymentMethod, customerName, setCustomerName, notes, setNotes, savedCustomers, filteredCustomers, showSuggestions, setShowSuggestions, customerRef }: any) {
  return (
    <>
      <div className="space-y-2">
        <Label>Date</Label>
        <Input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Payment Method</Label>
        <div className="grid grid-cols-4 gap-2">
          {PAYMENT_METHODS.map(m => (
            <button key={m.value} type="button" onClick={() => setPaymentMethod(m.value)}
              className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-medium transition-all ${paymentMethod === m.value ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/30'}`}>
              <m.icon className="w-[18px] h-[18px]" />
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2" ref={customerRef}>
        <Label>
          Customer Name
          {paymentMethod === 'credit' ? <span className="text-destructive ml-1">*</span> : <span className="text-muted-foreground text-xs ml-1">(optional)</span>}
          {savedCustomers.length > 0 && (
            <span className="text-xs text-primary ml-2 inline-flex items-center gap-1">
              <BookUser className="w-3 h-3" />{savedCustomers.length} saved
            </span>
          )}
        </Label>
        <div className="relative">
          <Input value={customerName} onChange={e => { setCustomerName(e.target.value); setShowSuggestions(true) }}
            onFocus={() => setShowSuggestions(true)} placeholder="e.g. Mr. Emeka" required={paymentMethod === 'credit'} />
          {showSuggestions && filteredCustomers.length > 0 && (
            <div className="absolute z-10 w-full bg-card border border-border rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
              {filteredCustomers.slice(0, 8).map((c: string) => (
                <button key={c} type="button" onMouseDown={() => { setCustomerName(c); setShowSuggestions(false) }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted text-foreground border-b border-border/50 last:border-0 flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />{c}
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
    </>
  )
}
