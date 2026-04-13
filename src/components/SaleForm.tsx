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
import { PlusCircle, ShoppingCart, MessageCircle } from 'lucide-react'
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

export default function SaleForm({ userId, tenantId, refreshKey, onSaleAdded }: Props) {
  const { toast } = useToast()
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
  const [lastSale, setLastSale] = useState<any>(null)

  // Customer book
  const [savedCustomers, setSavedCustomers] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const customerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getProductsForTenant(tenantId).then(({ data }) => {
      if (data) setProducts(data)
    })
    // Load saved customers from past sales
    supabase
      .from('sales')
      .select('customer_name')
      .eq('tenant_id', tenantId)
      .not('customer_name', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (data) {
          const unique = [...new Set(data.map((s: any) => s.customer_name).filter(Boolean))] as string[]
          setSavedCustomers(unique)
        }
      })
  }, [tenantId, refreshKey])

  // Close suggestions on outside click
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
    customerName
      ? c.toLowerCase().includes(customerName.toLowerCase()) && c !== customerName
      : true
  )

  const handleProductSelect = (id: string) => {
    setProductId(id)
    setSelectedUnit(null)
    setUnitPrice('')
  }

  const handleUnitSelect = (unitId: string) => {
    const product = products.find(p => p.id === productId)
    const unit = product?.product_units.find(u => u.id === unitId) || null
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
      setLastSale({ ...saleData, total_amount: total })

      // Add to saved customers if new
      if (customerName && !savedCustomers.includes(customerName)) {
        setSavedCustomers(prev => [customerName, ...prev])
      }

      toast({ title: 'Sale recorded!', description: `N${total.toLocaleString()} — ${selectedProduct.name}` })
      setQuantity('')
      setUnitPrice('')
      setCustomerName('')
      setNotes('')
      setSelectedUnit(null)
      onSaleAdded()
    }
  }

  const sendWhatsApp = () => {
    if (!lastSale) return
    const date = new Date(lastSale.sale_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
    const receipt = [
      `🧾 *Sales Receipt*`,
      `━━━━━━━━━━━━━━━`,
      `📦 *${lastSale.item_name}*`,
      `   Unit: ${lastSale.unit_label}`,
      `   Qty: ${lastSale.quantity} x N${Number(lastSale.unit_price).toLocaleString('en-NG')}`,
      `━━━━━━━━━━━━━━━`,
      `💰 *Total: N${Number(lastSale.total_amount).toLocaleString('en-NG')}*`,
      `💳 Payment: ${lastSale.payment_method.toUpperCase()}`,
      lastSale.customer_name ? `👤 Customer: ${lastSale.customer_name}` : '',
      `📅 Date: ${date}`,
      lastSale.notes ? `📝 ${lastSale.notes}` : '',
      `━━━━━━━━━━━━━━━`,
      `Thank you for your patronage! 🙏`,
    ].filter(Boolean).join('\n')

    window.open(`https://wa.me/?text=${encodeURIComponent(receipt)}`, '_blank')
  }

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

      {/* WhatsApp receipt button after sale */}
      {lastSale && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
          <CardContent className="p-3 flex items-center justify-between">
            <span className="text-sm text-green-700 dark:text-green-400 font-medium">✅ Sale recorded!</span>
            <Button
              size="sm"
              onClick={sendWhatsApp}
              className="gap-1.5 bg-green-500 hover:bg-green-600 text-white h-8"
            >
              <MessageCircle className="w-3.5 h-3.5" /> Send Receipt
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Product</Label>
                <Select value={productId} onValueChange={handleProductSelect}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={selectedUnit?.id || ''} onValueChange={handleUnitSelect} disabled={!productId}>
                  <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                  <SelectContent>
                    {selectedProduct?.product_units.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.unit_label} — N{u.unit_price.toLocaleString()}
                      </SelectItem>
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
                <Label>Unit Price (N)</Label>
                <Input type="number" min="0" step="0.01" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder="0.00" required />
              </div>
            </div>

            {total > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 text-center">
                <span className="text-sm text-muted-foreground">Total: </span>
                <span className="text-xl font-bold text-primary">N{total.toLocaleString()}</span>
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
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setPaymentMethod(m.value)}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                      paymentMethod === m.value
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/30'
                    }`}
                  >
                    <span className="text-lg">{m.icon}</span>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Customer name with autocomplete */}
            <div className="space-y-2" ref={customerRef}>
              <Label>
                Customer Name
                {paymentMethod === 'credit'
                  ? <span className="text-destructive ml-1">*</span>
                  : <span className="text-muted-foreground text-xs ml-1">(optional)</span>
                }
                {savedCustomers.length > 0 && (
                  <span className="text-xs text-primary ml-2">📖 {savedCustomers.length} saved</span>
                )}
              </Label>
              <div className="relative">
                <Input
                  value={customerName}
                  onChange={e => { setCustomerName(e.target.value); setShowSuggestions(true) }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="e.g. Mr. Emeka"
                  required={paymentMethod === 'credit'}
                />
                {showSuggestions && filteredCustomers.length > 0 && (
                  <div className="absolute z-10 w-full bg-card border border-border rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                    {filteredCustomers.slice(0, 8).map(c => (
                      <button
                        key={c}
                        type="button"
                        onMouseDown={() => { setCustomerName(c); setShowSuggestions(false) }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted text-foreground border-b border-border/50 last:border-0"
                      >
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
