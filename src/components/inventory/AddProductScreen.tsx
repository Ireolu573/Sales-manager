import { useState } from 'react'
import { ArrowLeft, PackagePlus, Plus, Trash2 } from 'lucide-react'
import { TenantService } from '@/services/tenant.service'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

interface Props { tenantId: string; onBack: () => void; onSaved: () => void }

const blankUnit = () => ({ unit_label: 'bag', unit_price: '', base_unit_quantity: '1' })
const unitOptions = ['bag', 'kg', 'paint', 'sachet', 'small', 'medium', 'large', 'bird', 'pack', 'crate', 'bottle', 'litre', 'unit']

export default function AddProductScreen({ tenantId, onBack, onSaved }: Props) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [units, setUnits] = useState([blankUnit()])
  const [saving, setSaving] = useState(false)

  const updateUnit = (index: number, field: keyof ReturnType<typeof blankUnit>, value: string) => {
    setUnits(current => current.map((unit, i) => i === index ? { ...unit, [field]: value } : unit))
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    const validUnits = units.filter(unit => unit.unit_label.trim() && Number(unit.unit_price) > 0 && Number(unit.base_unit_quantity) > 0)
    if (!name.trim()) return
    if (!validUnits.length) {
      toast({ title: 'Add a selling unit and price', description: 'At least one unit must have a price greater than zero.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await TenantService.addProduct(name.trim(), tenantId, validUnits.map(unit => ({
        unit_label: unit.unit_label.trim(),
        unit_price: Number(unit.unit_price),
        base_unit_quantity: Number(unit.base_unit_quantity),
      })))
      toast({ title: 'Product added to catalogue' })
      onSaved()
      onBack()
    } catch (error) {
      toast({ title: 'Could not save product', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return <div className="mx-auto w-full max-w-3xl space-y-5">
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to inventory"><ArrowLeft className="h-5 w-5" /></Button>
      <div className="min-w-0"><h1 className="text-xl font-bold text-foreground">Add product</h1><p className="text-sm text-muted-foreground">Create a product in your existing catalogue</p></div>
    </div>
    <form onSubmit={save} className="space-y-5">
      <Card><CardContent className="space-y-4 p-4 sm:p-6">
        <div className="flex items-center gap-2"><PackagePlus className="h-5 w-5 text-primary" /><h2 className="font-semibold">Product details</h2></div>
        <div className="space-y-2"><Label htmlFor="product-name">Product name</Label><Input id="product-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Layers mash 50kg" required maxLength={120} /></div>
        <div className="space-y-3">
          <div><h3 className="text-sm font-semibold">Selling units and prices</h3><p className="text-xs text-muted-foreground">Set the unit customers buy and its selling price.</p></div>
          {units.map((unit, index) => <div key={index} className="grid grid-cols-1 gap-3 rounded-xl border border-border p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
            <div className="space-y-1"><Label>Unit</Label><select value={unit.unit_label} onChange={e => updateUnit(index, 'unit_label', e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{unitOptions.map(option => <option key={option} value={option}>{option}</option>)}</select></div>
            <div className="space-y-1"><Label>Selling price (₦)</Label><Input type="number" min="0.01" step="0.01" value={unit.unit_price} onChange={e => updateUnit(index, 'unit_price', e.target.value)} placeholder="0.00" required /></div>
            <div className="space-y-1"><Label>Base quantity</Label><Input type="number" min="0.001" step="any" value={unit.base_unit_quantity} onChange={e => updateUnit(index, 'base_unit_quantity', e.target.value)} required /><p className="text-[11px] text-muted-foreground">Stock units per selling unit</p></div>
            {units.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => setUnits(current => current.filter((_, i) => i !== index))} aria-label="Remove unit"><Trash2 className="h-4 w-4 text-destructive" /></Button>}
          </div>)}
          <Button type="button" variant="outline" size="sm" onClick={() => setUnits(current => [...current, blankUnit()])}><Plus className="mr-2 h-4 w-4" />Add another unit</Button>
        </div>
      </CardContent></Card>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onBack}>Cancel</Button><Button type="submit" disabled={saving || !name.trim()}>{saving ? 'Saving product…' : 'Save product'}</Button></div>
    </form>
  </div>
}
