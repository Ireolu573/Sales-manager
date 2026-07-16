import { useRef, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Package, Plus, Trash2, Upload } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { StarterProduct } from './onboardingData'

interface DraftProduct {
  name: string
  unitLabel: string
  unitPrice: string
}

interface Props {
  tenantId: string
  initialProducts: StarterProduct[]
  onNext: (addedCount: number) => void
  onBack: () => void
}

const emptyDraft = (): DraftProduct => ({ name: '', unitLabel: 'bag', unitPrice: '' })

// Minimal CSV parser for a 3 column file: name, unit, price.
// Handles a header row if present and skips blank lines.
function parseCsv(text: string): DraftProduct[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const rows = lines.map(line => line.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')))
  const startIndex = rows[0]?.[0]?.toLowerCase() === 'name' ? 1 : 0
  return rows.slice(startIndex)
    .filter(cols => cols[0])
    .map(cols => ({
      name: cols[0] || '',
      unitLabel: cols[1] || 'unit',
      unitPrice: cols[2] || '',
    }))
}

export default function Step3AddProducts({ tenantId, initialProducts, onNext, onBack }: Props) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const seeded: DraftProduct[] = initialProducts.length
    ? initialProducts.map(p => ({ name: p.name, unitLabel: p.units[0]?.unit_label || 'unit', unitPrice: '' }))
    : [emptyDraft()]

  const [drafts, setDrafts] = useState<DraftProduct[]>(seeded)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const updateDraft = (index: number, patch: Partial<DraftProduct>) => {
    setDrafts(prev => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)))
  }

  const addRow = () => setDrafts(prev => [...prev, emptyDraft()])
  const removeRow = (index: number) => setDrafts(prev => prev.filter((_, i) => i !== index))

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const parsed = parseCsv(text)
    if (parsed.length === 0) {
      toast({ title: 'No rows found', description: 'Check the file has name, unit, price columns.', variant: 'destructive' })
      return
    }
    setDrafts(prev => {
      const withoutBlanks = prev.filter(d => d.name.trim())
      return [...withoutBlanks, ...parsed]
    })
    toast({ title: `${parsed.length} product(s) imported from file` })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleContinue = async () => {
    const valid = drafts.filter(d => d.name.trim())
    if (valid.length === 0) {
      onNext(0)
      return
    }
    setError('')
    setSaving(true)

    let addedCount = 0
    for (const d of valid) {
      const { data, error: productError } = await supabase
        .from('products')
        .insert({ name: d.name.trim(), tenant_id: tenantId, is_active: true })
        .select('id')
        .single()

      if (productError || !data) {
        setError(`Couldn't save "${d.name}". ${productError?.message || ''}`)
        continue
      }

      await supabase.from('product_units').insert({
        product_id: data.id,
        unit_label: d.unitLabel.trim() || 'unit',
        unit_price: Number(d.unitPrice) || 0,
      })
      addedCount += 1
    }

    setSaving(false)

    if (addedCount === 0 && valid.length > 0) {
      toast({ title: 'Nothing saved', description: error || 'Please try again.', variant: 'destructive' })
      return
    }

    toast({ title: `${addedCount} product(s) added!` })
    onNext(addedCount)
  }

  const handleSkip = () => onNext(0)

  return (
    <Card className="slide-up shadow-xl border-border">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Add products or import a CSV.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleCsvUpload}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-3.5 h-3.5" />
            Import CSV
          </Button>
        </div>

        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {drafts.map((d, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs">Product name</Label>
                <Input
                  value={d.name}
                  onChange={e => updateDraft(i, { name: e.target.value })}
                  placeholder="e.g. Grower Feed"
                />
              </div>
              <div className="w-24 space-y-1.5">
                <Label className="text-xs">Unit</Label>
                <Input value={d.unitLabel} onChange={e => updateDraft(i, { unitLabel: e.target.value })} />
              </div>
              <div className="w-24 space-y-1.5">
                <Label className="text-xs">Price (₦)</Label>
                <Input
                  type="number"
                  min="0"
                  value={d.unitPrice}
                  onChange={e => updateDraft(i, { unitPrice: e.target.value })}
                />
              </div>
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="text-destructive/60 hover:text-destructive p-2 rounded-lg hover:bg-destructive/10 shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={addRow}>
          <Plus className="w-3.5 h-3.5" />
          Add another product
        </Button>

        {error && <p className="text-destructive text-sm font-medium">{error}</p>}

        <div className="flex items-center gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onBack} className="flex-1">
            Back
          </Button>
          <Button type="button" variant="outline" onClick={handleSkip} className="flex-1">
            Skip for now
          </Button>
          <Button type="button" onClick={handleContinue} disabled={saving} className="flex-1 gap-1.5 font-semibold">
            <Package className="w-4 h-4" />
            {saving ? 'Saving...' : 'Continue'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
