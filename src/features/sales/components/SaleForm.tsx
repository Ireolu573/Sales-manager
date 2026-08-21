import { useState, useEffect, useRef, useMemo } from 'react'
import { getProductsForTenant } from '@/lib/tenant-queries'
import { supabase } from '@/integrations/supabase/client'
import { useStock } from '@/hooks/useStock'
import type { Product, ProductUnit, PaymentMethod } from '@/lib/types'
import { generateUUID } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PlusCircle, ShoppingCart, Trash2, Package, Zap, Plus, Banknote, Landmark, CreditCard, FileClock, User, type LucideIcon } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { enqueueSale } from '@/lib/offlineQueue'
import { useAuth } from '@/hooks/useAuth'
import { SalesService } from '@/services/sales.service'

import { lazy, Suspense } from 'react'
import type { ReceiptData } from '@/components/receipt/ReceiptCanvas'
const ReceiptShareSheet = lazy(() => import('@/components/receipt/ReceiptShareSheet'))
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
  return { id: generateUUID(), productId: '', selectedUnit: null, quantity: '', unitPrice: '' }
}

export function SaleForm({ userId, tenantId }: Props) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { company, isAdmin } = useAuth()

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

  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)

  const { inventorySummary } = useStock(tenantId)
  const [allowInventoryOverride, setAllowInventoryOverride] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')

  const selectedProductInventory = productId ? inventorySummary[productId] : undefined
  const selectedProductAvailable = selectedProductInventory?.availableStock ?? 0
  const isLowStock = selectedProductInventory ? selectedProductInventory.status === 'low_stock' : false
  const isOutOfStock = selectedProductInventory ? selectedProductInventory.status === 'out_of_stock' : true
  const numericQuantity = Number(quantity) * (selectedUnit?.base_unit_quantity || 1) || 0
  const singleStockIssue = numericQuantity > selectedProductAvailable
  const bulkStockIssues = useMemo(
    () => Object.entries(lineItems.reduce<Record<string, number>>((totals, item) => {
      if (item.productId && item.quantity) {
        totals[item.productId] = (totals[item.productId] || 0) + Number(item.quantity) * (item.selectedUnit?.base_unit_quantity || 1)
      }
      return totals
    }, {})).filter(([productId, required]) => required > (inventorySummary[productId]?.availableBaseQuantity ?? 0)),
    [inventorySummary, lineItems]
  )

  const [savedCustomers, setSavedCustomers] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const customerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getProductsForTenant(tenantId).then(({ data }) => { if (data) setProducts(data) })
    supabase
      .from('sales')
      .select('customer_name')
      .eq('tenant_id', tenantId)
      .not('customer_name', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (data) {
          const names = Array.from(new Set(data.map(d => d.customer_name).filter(Boolean))) as string[]
          setSavedCustomers(names)
        }
      })
  }, [tenantId])

  const selectedProduct = products.find(p => p.id === productId)

  const handleProductSelect = (id: string) => {
    setProductId(id)
    const prod = products.find(p => p.id === id)
    if (prod && prod.product_units.length > 0) {
      setSelectedUnit(prod.product_units[0])
      setUnitPrice(String(prod.product_units[0].unit_price))
    } else {
      setSelectedUnit(null)
      setUnitPrice('')
    }
  }

  const handleUnitSelect = (unitId: string) => {
    if (!selectedProduct) return
    const unit = selectedProduct.product_units.find(u => u.id === unitId) || null
    setSelectedUnit(unit)
    if (unit) setUnitPrice(String(unit.unit_price))
  }

  const handleBulkProductSelect = (lineId: string, prodId: string) => {
    const prod = products.find(p => p.id === prodId)
    const firstUnit = prod?.product_units[0] || null
    setLineItems(items => items.map(item => item.id === lineId ? {
      ...item,
      productId: prodId,
      selectedUnit: firstUnit,
      unitPrice: firstUnit ? String(firstUnit.unit_price) : ''
    } : item))
  }

  const handleBulkUnitSelect = (lineId: string, unitId: string) => {
    setLineItems(items => items.map(item => {
      if (item.id !== lineId) return item
      const prod = products.find(p => p.id === item.productId)
      const unit = prod?.product_units.find(u => u.id === unitId) || null
      return { ...item, selectedUnit: unit, unitPrice: unit ? String(unit.unit_price) : '' }
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      let receiptItems: ReceiptData['items'] = []
      if (mode === 'single') {
        if (!selectedProduct || !selectedUnit || !quantity || !unitPrice) {
          toast({ title: 'Please fill in all required fields.', variant: 'destructive' })
          setLoading(false)
          return
        }

        if (singleStockIssue && !allowInventoryOverride) {
          const remaining = Math.max((selectedProductInventory?.availableStock ?? 0), 0)
          toast({
            title: 'Stock limit reached.',
            description: `Only ${remaining} ${selectedUnit?.unit_label || 'unit'}${remaining === 1 ? '' : 's'} available for this product.`,
            variant: 'destructive',
          })
          setLoading(false)
          return
        }

        receiptItems = [{ item_name: selectedProduct.name, unit_label: selectedUnit.unit_label, quantity: Number(quantity), unit_price: Number(unitPrice), total_amount: Number(quantity) * Number(unitPrice) }]
      } else {
        const validItems = lineItems.filter(i => i.productId && i.selectedUnit && i.quantity && i.unitPrice)
        if (validItems.length === 0) {
          toast({ title: 'Add at least one complete line item.', variant: 'destructive' })
          setLoading(false)
          return
        }

        if (bulkStockIssues.length > 0 && !allowInventoryOverride) {
          const [productId] = bulkStockIssues[0]
          const productName = products.find(p => p.id === productId)?.name || 'This product'
          const available = inventorySummary[productId]?.availableBaseQuantity ?? 0
          toast({
            title: 'One or more items exceed stock.',
            description: `${productName} only has ${available} unit${available === 1 ? '' : 's'} left.`,
            variant: 'destructive',
          })
          setLoading(false)
          return
        }

        receiptItems = validItems.map(item => {
          const prod = products.find(p => p.id === item.productId)!
          const lineTotal = Number(item.quantity) * Number(item.unitPrice)
          return { item_name: prod.name, unit_label: item.selectedUnit!.unit_label, quantity: Number(item.quantity), unit_price: Number(item.unitPrice), total_amount: lineTotal }
        })
      }

      if (allowInventoryOverride && (!isAdmin || !overrideReason.trim())) {
        throw new Error('Only an administrator can override stock, and a reason is required.')
      }
      const transactionPayload = {
        items: mode === 'single'
          ? [{ product_id: selectedProduct!.id, product_unit_id: selectedUnit!.id, quantity: Number(quantity), unit_price: Number(unitPrice) }]
          : lineItems.filter(i => i.productId && i.selectedUnit && i.quantity && i.unitPrice).map(i => ({ product_id: i.productId, product_unit_id: i.selectedUnit!.id, quantity: Number(i.quantity), unit_price: Number(i.unitPrice) })),
        sale_date: saleDate, payment_method: paymentMethod, customer_name: customerName || null, notes: notes || null,
        allow_override: allowInventoryOverride, override_reason: overrideReason || null, transaction_id: generateUUID(),
      }
      if (!navigator.onLine) {
        enqueueSale({ __transaction: transactionPayload }, tenantId, userId)
        toast({ title: 'Offline sale queued', description: 'Stock will be re-checked securely when it syncs.' })
      } else {
        await SalesService.recordTransaction(transactionPayload, tenantId)
        toast({ title: 'Transaction recorded successfully!' })
      }
      const total = receiptItems.reduce((sum, item) => sum + item.total_amount, 0)
      setReceiptData({ items: receiptItems, total, paymentMethod, customerName: customerName || '', saleDate, notes: notes || '', companyName: company?.company_name || 'My Business', appName: company?.app_name || 'Sales Manager', logoEmoji: company?.logo_emoji || '🏢', brandColor: company?.brand_color || '#d97706' })
      setShowReceipt(true)
      setProductId(''); setSelectedUnit(null); setQuantity(''); setUnitPrice(''); setLineItems([newLine()]); setCustomerName(''); setNotes(''); setAllowInventoryOverride(false); setOverrideReason('')

      queryClient.invalidateQueries({ queryKey: ['sales', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['analytics', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['inventorySummary', tenantId] })
    } catch (err: any) {
      toast({ title: 'Error saving sale', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const singleTotal = Number(quantity) * Number(unitPrice) || 0
  const bulkTotal = lineItems.reduce((acc, i) => acc + (Number(i.quantity) * Number(i.unitPrice) || 0), 0)

  return (
    <div className="space-y-4 max-w-md mx-auto md:max-w-4xl md:space-y-6">
      <TodaySummaryCard tenantId={tenantId} userId={userId} isAdmin={isAdmin} />

      <Card className="shadow-sm border border-border/80 bg-card/95 backdrop-blur-sm rounded-2xl">
        <CardContent className="p-4 md:p-6">
          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
            <div className="flex flex-col gap-3 border-b pb-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-amber-600" /> Record Sales
                </h2>
              </div>

              <div className="flex items-center gap-2 bg-muted p-1 rounded-xl text-xs font-semibold w-full">
                <button
                  type="button"
                  onClick={() => setMode('single')}
                  className={`flex-1 px-3 py-2 rounded-lg transition-all ${mode === 'single' ? 'bg-background text-foreground shadow-sm ring-1 ring-border' : 'text-muted-foreground'}`}
                >
                  <Zap className="h-3.5 w-3.5 inline mr-1" /> Single
                </button>
                <button
                  type="button"
                  onClick={() => setMode('bulk')}
                  className={`flex-1 px-3 py-2 rounded-lg transition-all ${mode === 'bulk' ? 'bg-background text-foreground shadow-sm ring-1 ring-border' : 'text-muted-foreground'}`}
                >
                  <Package className="h-3.5 w-3.5 inline mr-1" /> Multi
                </button>
              </div>
            </div>

            {mode === 'single' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Product</Label>
                  <Select value={productId} onValueChange={handleProductSelect}>
                    <SelectTrigger className="h-11 rounded-xl bg-muted/40 border-border/80"><SelectValue placeholder="Select catalog product" /></SelectTrigger>
                    <SelectContent>
                      {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {selectedProductInventory && (
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 ${isOutOfStock ? 'bg-red-500/10 text-red-700' : isLowStock ? 'bg-amber-500/10 text-amber-700' : 'bg-emerald-500/10 text-emerald-700'}`}>
                        {isOutOfStock ? 'Out of stock' : isLowStock ? 'Low stock' : 'In stock'}
                      </span>
                      <span className="text-muted-foreground">
                        {selectedUnit && selectedUnit.base_unit_quantity > 1 ? (
                          <>
                            {(selectedProductAvailable / selectedUnit.base_unit_quantity).toFixed(1).replace(/\.0$/, '')} {selectedUnit.unit_label}{Math.floor(selectedProductAvailable / selectedUnit.base_unit_quantity) === 1 ? '' : 's'} ({selectedProductAvailable} base unit{selectedProductAvailable === 1 ? '' : 's'}) available
                          </>
                        ) : (
                          <>{selectedProductAvailable} {selectedUnit?.unit_label || 'unit'}{selectedProductAvailable === 1 ? '' : 's'} available</>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Unit Type</Label>
                  <Select value={selectedUnit?.id || ''} onValueChange={handleUnitSelect} disabled={!selectedProduct}>
                    <SelectTrigger className="h-11 rounded-xl bg-muted/40 border-border/80"><SelectValue placeholder="Select unit" /></SelectTrigger>
                    <SelectContent>
                      {selectedProduct?.product_units.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.unit_label} (₦{Number(u.unit_price).toLocaleString()})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Quantity</Label>
                  <Input className="h-11 rounded-xl bg-muted/40 border-border/80" type="number" min="0.01" step="any" placeholder="0" value={quantity} onChange={e => setQuantity(e.target.value)} />
                  {singleStockIssue && !allowInventoryOverride && (
                    <p className="text-xs text-destructive">Not enough stock left for this sale. You can enable override if needed.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Unit Price (₦)</Label>
                  <Input className="h-11 rounded-xl bg-muted/40 border-border/80" type="number" min="0" step="any" placeholder="0" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {lineItems.map((item, idx) => (
                  <div key={item.id} className="flex flex-col sm:flex-row gap-2 items-end bg-muted/30 p-3 rounded-lg border">
                    <div className="flex-1 space-y-1 w-full">
                      <Label className="text-xs">Product #{idx + 1}</Label>
                      <Select value={item.productId} onValueChange={val => handleBulkProductSelect(item.id, val)}>
                        <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                        <SelectContent>
                          {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {item.productId && (
                        <div className="text-xs text-muted-foreground">
                          Available: {inventorySummary[item.productId]?.availableStock ?? '–'} unit{inventorySummary[item.productId]?.availableStock === 1 ? '' : 's'}
                          {inventorySummary[item.productId]?.status === 'low_stock' ? ' (low stock)' : inventorySummary[item.productId]?.status === 'out_of_stock' ? ' (out of stock)' : ''}
                        </div>
                      )}
                    </div>

                    <div className="w-full sm:w-36 space-y-1">
                      <Label className="text-xs">Unit</Label>
                      <Select value={item.selectedUnit?.id || ''} onValueChange={val => handleBulkUnitSelect(item.id, val)} disabled={!item.productId}>
                        <SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger>
                        <SelectContent>
                          {products.find(p => p.id === item.productId)?.product_units.map(u => (
                            <SelectItem key={u.id} value={u.id}>{u.unit_label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="w-full sm:w-28 space-y-1">
                      <Label className="text-xs">Qty</Label>
                      <Input type="number" placeholder="Qty" value={item.quantity} onChange={e => {
                        const copy = [...lineItems]
                        copy[idx].quantity = e.target.value
                        setLineItems(copy)
                      }} />
                    </div>

                    <div className="w-full sm:w-32 space-y-1">
                      <Label className="text-xs">Price (₦)</Label>
                      <Input type="number" placeholder="Price" value={item.unitPrice} onChange={e => {
                        const copy = [...lineItems]
                        copy[idx].unitPrice = e.target.value
                        setLineItems(copy)
                      }} />
                    </div>

                    {lineItems.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => setLineItems(lineItems.filter(i => i.id !== item.id))}>
                        <Trash2 className="h-4 w-4 text-rose-500" />
                      </Button>
                    )}
                  </div>
                ))}

                <Button type="button" variant="outline" size="sm" onClick={() => setLineItems([...lineItems, newLine()])}>
                  <Plus className="h-4 w-4 mr-1" /> Add Line Item
                </Button>
              </div>
            )}

            {/* Payment & Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
              <div className="space-y-2.5">
                <Label className="text-sm font-semibold tracking-tight">Payment Method</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PAYMENT_METHODS.map(pm => {
                    const Icon = pm.icon
                    const isSelected = paymentMethod === pm.value
                    return (
                      <button
                        key={pm.value}
                        type="button"
                        onClick={() => setPaymentMethod(pm.value)}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-200 min-h-[48px] touch-manipulation ${
                          isSelected
                            ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs scale-102'
                            : 'border-border/60 bg-card/60 hover:bg-secondary/40 text-muted-foreground'
                        }`}
                      >
                        <Icon className={`h-4 w-4 mb-1 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="text-xs font-semibold">{pm.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold tracking-tight">Transaction Date</Label>
                <Input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} className="h-11 rounded-xl bg-muted/30 border-border/80 text-base md:text-sm" />
              </div>

              <div className="space-y-2 relative" ref={customerRef}>
                <Label className="text-sm font-semibold tracking-tight">Customer Name (Optional)</Label>
                <div className="relative">
                  <Input
                    placeholder="Enter customer name"
                    value={customerName}
                    onChange={e => { setCustomerName(e.target.value); setShowSuggestions(true) }}
                    onFocus={() => setShowSuggestions(true)}
                    className="h-11 rounded-xl bg-muted/30 border-border/80 pr-10 text-base md:text-sm"
                  />
                  <User className="h-4 w-4 absolute right-3 top-3.5 text-muted-foreground" />
                </div>
                {showSuggestions && savedCustomers.length > 0 && customerName && (
                  <div className="absolute z-10 w-full bg-popover border rounded-xl shadow-lg max-h-40 overflow-y-auto mt-1">
                    {savedCustomers.filter(c => c.toLowerCase().includes(customerName.toLowerCase())).map(c => (
                      <div
                        key={c}
                        className="p-2.5 hover:bg-secondary cursor-pointer text-xs font-medium"
                        onClick={() => { setCustomerName(c); setShowSuggestions(false) }}
                      >
                        {c}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold tracking-tight">Notes (Optional)</Label>
                <Textarea placeholder="Additional transaction notes..." value={notes} onChange={e => setNotes(e.target.value)} className="h-11 min-h-[44px] rounded-xl bg-muted/30 border-border/80 text-base md:text-sm" />
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t pt-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  <p className="font-semibold text-foreground">Inventory override</p>
                  <p className="text-xs text-muted-foreground">Admin-only. Every override is saved with a reason for review.</p>
                </div>
                <Button type="button" disabled={!isAdmin} variant={allowInventoryOverride ? 'outline' : 'ghost'} className="h-10 w-full sm:w-auto rounded-xl" onClick={() => setAllowInventoryOverride(v => !v)}>
                  {allowInventoryOverride ? 'Disable override' : 'Enable override'}
                </Button>
              </div>
              {allowInventoryOverride && (
                <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                  <Label htmlFor="override-reason" className="text-xs font-semibold">Reason for override</Label>
                  <Textarea id="override-reason" value={overrideReason} onChange={e => setOverrideReason(e.target.value)} placeholder="e.g. Physical count confirmed, stock entry pending" className="min-h-[72px] rounded-lg text-base md:text-sm" required />
                </div>
              )}
            </div>

            {/* Tactile Counter Register Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border/80 pt-4 bg-muted/20 -mx-6 -mb-6 p-4 rounded-b-2xl">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold block">Total Amount</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-primary font-tabular tracking-tight">
                  ₦{(mode === 'single' ? singleTotal : bulkTotal).toLocaleString()}
                </span>
              </div>

              <Button type="submit" disabled={loading} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 h-12 rounded-xl text-base shadow-md transition-transform active:scale-98">
                <PlusCircle className="h-5 w-5 mr-2" />
                {loading ? 'Recording...' : 'Record Transaction'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {showReceipt && receiptData && (
        <Suspense fallback={null}>
          <ReceiptShareSheet data={receiptData} onClose={() => setShowReceipt(false)} />
        </Suspense>
      )}
    </div>
  )
}

export default SaleForm
