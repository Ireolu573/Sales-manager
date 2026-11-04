import { useState } from 'react'
import { ArrowLeft, PackagePlus, Plus, Trash2 } from 'lucide-react'
import { TenantService } from '@/services/tenant.service'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

interface Props { tenantId: string; userId: string; onBack: () => void; onSaved: () => void }
type UnitDraft = { unit_label: string; unit_price: string; base_unit_quantity: string }
const blankUnit = (): UnitDraft => ({ unit_label: 'bag', unit_price: '', base_unit_quantity: '1' })
const unitOptions = ['bag', 'kg', 'paint', 'sachet', 'small', 'medium', 'large', 'bird', 'pack', 'crate', 'bottle', 'litre', 'unit']
const categories = [{ value: 'feeds', label: 'Feeds' }, { value: 'livestock', label: 'Livestock' }, { value: 'drugs', label: 'Drugs' }, { value: 'other', label: 'Other' }]

export default function AddProductScreen({ tenantId, userId, onBack, onSaved }: Props) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('feeds')
  const [units, setUnits] = useState<UnitDraft[]>([blankUnit()])
  const [costPrice, setCostPrice] = useState('')
  const [openingQuantity, setOpeningQuantity] = useState('')
  const [lowStockThreshold, setLowStockThreshold] = useState('5')
  const [saving, setSaving] = useState(false)
  const [stockDate] = useState(new Date().toISOString().slice(0, 10))

  const updateUnit = (index: number, field: keyof UnitDraft, value: string) => {
    setUnits(current => current.map((unit, i) => i === index ? { ...unit, [field]: value } : unit))
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    const validUnits = units.filter(unit => unit.unit_label.trim() && Number(unit.unit_price) > 0 && Number(unit.base_unit_quantity) > 0)
    const openingQty = Number(openingQuantity || 0)
    const cost = Number(costPrice || 0)
    const baseUnitQty = Number(validUnits[0]?.base_unit_quantity || 1)
    if (!name.trim()) return
    if (validUnits.length !== units.length || !validUnits.length) {
      toast({ title: 'Check selling units and prices', description: 'Every selling unit needs a valid price and base quantity.', variant: 'destructive' })
      return
    }
    if (Number(lowStockThreshold) < 0 || !Number.isFinite(Number(lowStockThreshold))) {
      toast({ title: 'Invalid low-stock threshold', variant: 'destructive' }); return
    }
    if (openingQuantity && (openingQty <= 0 || cost <= 0)) {
      toast({ title: 'Check opening stock', description: 'Enter a positive quantity and cost price, or leave both fields empty.', variant: 'destructive' }); return
    }
    setSaving(true)
    try {
      await TenantService.addProduct(name.trim(), tenantId, validUnits.map(unit => ({
        unit_label: unit.unit_label.trim(), unit_price: Number(unit.unit_price), base_unit_quantity: Number(unit.base_unit_quantity),
      })), {
        category,
        low_stock_threshold: Number(lowStockThreshold),
        ...(openingQty > 0 ? { opening_stock: {
          quantity: openingQty, cost_price: cost, unit_label: validUnits[0].unit_label,
          base_unit_quantity: baseUnitQty, stock_date: stockDate, user_id: userId,
        } } : {}),
      })
      toast({ title: 'Product added to catalogue', description: openingQty > 0 ? 'Opening stock has also been recorded.' : undefined })
      onSaved()
      onBack()
    } catch (error) {
      toast({ title: 'Could not save product', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' })
    } finally { setSaving(false) }
  }

  return <div className="mx-auto w-full max-w-3xl space-y-5">
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to inventory"><ArrowLeft className="h-5 w-5" /></Button>
      <div className="min-w-0"><h1 className="text-xl font-bold text-foreground">Add product</h1><p className="text-sm text-muted-foreground">Add an item to your farm shop catalogue</p></div>
    </div>
    <form onSubmit={save} className="space-y-5">
      <Card><CardContent className="space-y-4 p-4 sm:p-6">
        <div className="flex items-center gap-2"><PackagePlus className="h-5 w-5 text-primary" /><h2 className="font-semibold">Product details</h2></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="product-name">Product name</Label><Input id="product-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Layers mash 50kg" required maxLength={120} /></div>
          <div className="space-y-2"><Label htmlFor="product-category">Category</Label><select id="product-category" value={category} onChange={e => setCategory(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{categories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
          <div className="space-y-2"><Label htmlFor="low-stock">Low stock alert at</Label><Input id="low-stock" type="number" min="0" step="any" value={lowStockThreshold} onChange={e => setLowStockThreshold(e.target.value)} required /><p className="text-xs text-muted-foreground">Measured in the product's base stock unit</p></div>
        </div>
        <div className="space-y-3">
          <div><h3 className="text-sm font-semibold">Selling units</h3><p className="text-xs text-muted-foreground">Set the customer-facing unit, price and how much base stock it represents.</p></div>
          {units.map((unit, index) => <div key={index} className="grid grid-cols-1 gap-3 rounded-xl border border-border p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
            <div className="space-y-1"><Label>Unit</Label><select value={unit.unit_label} onChange={e => updateUnit(index, 'unit_label', e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{unitOptions.map(option => <option key={option} value={option}>{option}</option>)}</select></div>
            <div className="space-y-1"><Label>Selling price (₦)</Label><Input type="number" min="0.01" step="0.01" value={unit.unit_price} onChange={e => updateUnit(index, 'unit_price', e.target.value)} placeholder="0.00" required /></div>
            <div className="space-y-1"><Label>Base quantity</Label><Input type="number" min="0.001" step="any" value={unit.base_unit_quantity} onChange={e => updateUnit(index, 'base_unit_quantity', e.target.value)} required /><p className="text-[11px] text-muted-foreground">Base units per selling unit</p></div>
            {units.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => setUnits(current => current.filter((_, i) => i !== index))} aria-label="Remove unit"><Trash2 className="h-4 w-4 text-destructive" /></Button>}
          </div>)}
          <Button type="button" variant="outline" size="sm" onClick={() => setUnits(current => [...current, blankUnit()])}><Plus className="mr-2 h-4 w-4" />Add another unit</Button>
        </div>
      </CardContent></Card>
      <Card><CardContent className="space-y-4 p-4 sm:p-6">
        <div><h2 className="font-semibold">Opening stock</h2><p className="text-xs text-muted-foreground">Optional. Record the quantity already on hand as the first stock entry.</p></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="cost-price">Cost price per {units[0]?.unit_label || 'unit'} (₦)</Label><Input id="cost-price" type="number" min="0.01" step="0.01" value={costPrice} onChange={e => setCostPrice(e.target.value)} placeholder="0.00" /></div>
          <div className="space-y-2"><Label htmlFor="opening-quantity">Opening quantity ({units[0]?.unit_label || 'unit'})</Label><Input id="opening-quantity" type="number" min="0.001" step="any" value={openingQuantity} onChange={e => setOpeningQuantity(e.target.value)} placeholder="0" /></div>
        </div>
        <p className="text-xs text-muted-foreground">If you enter opening quantity, enter its cost price too. It will be saved as a stock record, not as a separate catalogue balance.</p>
      </CardContent></Card>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onBack}>Cancel</Button><Button type="submit" disabled={saving || !name.trim()}>{saving ? 'Saving product…' : 'Save product'}</Button></div>
    </form>
  </div>
}
