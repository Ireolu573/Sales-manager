import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { getProductsForTenant } from '@/lib/tenant-queries'
import type { CompanySettings, Product, Permissions } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Trash2, Users, Package, Palette, Copy, Check, X, AlertTriangle, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Props {
  userId: string
  tenantId: string
  company: CompanySettings
  onClose: () => void
  onCompanyUpdated: (c: CompanySettings) => void
  onProductsChanged: () => void
}

interface StaffMember {
  id: string
  email: string
  is_admin: boolean
  permissions: Permissions
}

const UNIT_OPTIONS = ['bag','kg','paint','sachet','small','medium','large','big','bird','pack','crate','bottle','litre','unit']
const emptyUnit = () => ({ unit_label: 'bag', unit_price: '' })

const PERM_LABELS: { key: keyof Permissions; label: string }[] = [
  { key: 'can_record_sales', label: 'Record Sales' },
  { key: 'can_view_history', label: 'View History' },
  { key: 'can_view_stock', label: 'View Stock' },
  { key: 'can_add_stock', label: 'Add Stock' },
  { key: 'can_view_analytics', label: 'View Analytics' },
  { key: 'can_manage_credit', label: 'Manage Credit' },
]

export default function DomainController({ userId, tenantId, company, onClose, onCompanyUpdated, onProductsChanged }: Props) {
  const { toast } = useToast()
  const [tab, setTab] = useState<'brand' | 'products' | 'staff'>('brand')

  const [companyName, setCompanyName] = useState(company.company_name)
  const [appName, setAppName] = useState(company.app_name)
  const [brandColor, setBrandColor] = useState(company.brand_color)
  const [logoEmoji, setLogoEmoji] = useState(company.logo_emoji)
  const [saving, setSaving] = useState(false)

  const [products, setProducts] = useState<Product[]>([])
  const [newProductName, setNewProductName] = useState('')
  const [units, setUnits] = useState<{ unit_label: string; unit_price: string }[]>([emptyUnit()])
  const [addingProduct, setAddingProduct] = useState(false)
  const [productError, setProductError] = useState('')

  const [staff, setStaff] = useState<StaffMember[]>([])
  const [inviteCode, setInviteCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const [showDangerZone, setShowDangerZone] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletingCompany, setDeletingCompany] = useState(false)

  useEffect(() => {
    getProductsForTenant(tenantId).then(({ data }) => { if (data) setProducts(data) })
    supabase.from('profiles').select('id, email, is_admin, permissions').eq('tenant_id', tenantId).then(({ data }) => {
      if (data) setStaff(data as unknown as StaffMember[])
    })
    supabase.from('tenants').select('invite_code').eq('id', tenantId).single().then(({ data }) => {
      if (data?.invite_code) setInviteCode(data.invite_code)
    })
  }, [tenantId])

  const copyInviteCode = async () => {
    await navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    toast({ title: 'Invite code copied!' })
    setTimeout(() => setCopied(false), 2000)
  }

  const regenerateInviteCode = async () => {
    setRegenerating(true)
    const newCode = Math.random().toString(36).slice(2, 10).toLowerCase()
    const { error } = await supabase.from('tenants').update({ invite_code: newCode }).eq('id', tenantId)
    setRegenerating(false)
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      setInviteCode(newCode)
      toast({ title: 'Invite code regenerated!', description: 'Old code is now invalid.' })
    }
  }

  const saveBrand = async () => {
    setSaving(true)
    const updates = { company_name: companyName, app_name: appName, brand_color: brandColor, logo_emoji: logoEmoji }
    const { error } = await supabase.from('company_settings').update(updates).eq('tenant_id', tenantId)
    setSaving(false)
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      onCompanyUpdated({ ...company, ...updates })
      toast({ title: 'Brand updated!' })
    }
  }

  const addProduct = async () => {
    if (!newProductName) return
    const validUnits = units.filter(u => u.unit_label && u.unit_price)
    if (validUnits.length === 0) { setProductError('Add at least one unit with a price.'); return }
    setProductError('')
    setAddingProduct(true)
    const { data, error } = await supabase
      .from('products')
      .insert({ name: newProductName, tenant_id: tenantId, is_active: true })
      .select('id, name')
      .single()
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else if (data) {
      await supabase.from('product_units').insert(
        validUnits.map(u => ({ product_id: data.id, unit_label: u.unit_label, unit_price: Number(u.unit_price) }))
      )
      setNewProductName('')
      setUnits([emptyUnit()])
      getProductsForTenant(tenantId).then(({ data }) => { if (data) setProducts(data) })
      onProductsChanged()
      toast({ title: 'Product added!' })
    }
    setAddingProduct(false)
  }

  const deleteProduct = async (id: string) => {
    if (!confirm('Delete this product?')) return
    await supabase.from('products').update({ is_active: false }).eq('id', id)
    setProducts(prev => prev.filter(p => p.id !== id))
    onProductsChanged()
    toast({ title: 'Product removed' })
  }

  const updatePermission = async (staffId: string, perm: keyof Permissions, value: boolean) => {
    const member = staff.find(s => s.id === staffId)
    if (!member) return
    const newPerms = { ...member.permissions, [perm]: value }
    const { error } = await supabase.from('profiles').update({ permissions: newPerms }).eq('id', staffId)
    if (error) {
      toast({ title: 'Error saving permission', description: error.message, variant: 'destructive' })
    } else {
      setStaff(prev => prev.map(s => s.id === staffId ? { ...s, permissions: newPerms } : s))
    }
  }

  const deleteUser = async (uid: string, email: string) => {
    if (!confirm(`Remove ${email} from your business permanently?`)) return
    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId: uid },
      })
      if (error || data?.error) {
        toast({ title: 'Error', description: error?.message || data?.error, variant: 'destructive' })
      } else {
        setStaff(prev => prev.filter(s => s.id !== uid))
        toast({ title: 'User deleted successfully' })
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to delete user', variant: 'destructive' })
    }
  }

  const deleteCompany = async () => {
    if (deleteConfirmText !== company.company_name) return
    setDeletingCompany(true)
    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { deleteTenant: true, tenantId },
      })
      if (error || data?.error) {
        toast({ title: 'Error', description: error?.message || data?.error, variant: 'destructive' })
        setDeletingCompany(false)
      } else {
        toast({ title: 'Company deleted', description: 'Signing you out...' })
        setTimeout(() => supabase.auth.signOut(), 1500)
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to delete company', variant: 'destructive' })
      setDeletingCompany(false)
    }
  }

  const TABS = [
    { id: 'brand' as const, label: 'Brand', icon: Palette },
    { id: 'products' as const, label: 'Products', icon: Package },
    { id: 'staff' as const, label: 'Staff', icon: Users },
  ]

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="flex bg-muted rounded-lg p-1 mb-4">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-all ${
                tab === t.id ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'
              }`}>
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* BRAND TAB */}
        {tab === 'brand' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Business Name</Label>
              <Input value={companyName} onChange={e => setCompanyName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>App Name</Label>
              <Input value={appName} onChange={e => setAppName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Brand Color</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
                  <Input value={brandColor} onChange={e => setBrandColor(e.target.value)} className="font-mono text-sm" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Logo Emoji</Label>
                <Input value={logoEmoji} onChange={e => setLogoEmoji(e.target.value)} className="text-2xl text-center" maxLength={2} />
              </div>
            </div>
            <Button onClick={saveBrand} disabled={saving} className="w-full">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>

            <Separator className="my-2" />

            <div>
              <button
                onClick={() => setShowDangerZone(v => !v)}
                className="flex items-center gap-2 text-destructive/70 hover:text-destructive text-sm font-medium transition-colors"
              >
                <AlertTriangle className="w-4 h-4" />
                DELETE COMPANY
              </button>

              {showDangerZone && (
                <div className="mt-3 border border-destructive/30 bg-destructive/5 rounded-xl p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-destructive">Delete this company</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      This will permanently delete <strong>{company.company_name}</strong> and all its data. This cannot be undone.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Type <strong className="text-foreground">{company.company_name}</strong> to confirm
                    </Label>
                    <Input
                      value={deleteConfirmText}
                      onChange={e => setDeleteConfirmText(e.target.value)}
                      placeholder={company.company_name}
                      className="border-destructive/40 focus-visible:ring-destructive/40"
                    />
                  </div>
                  <Button
                    variant="destructive"
                    className="w-full"
                    disabled={deleteConfirmText !== company.company_name || deletingCompany}
                    onClick={deleteCompany}
                  >
                    {deletingCompany ? 'Deleting everything...' : 'Delete Company Permanently'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PRODUCTS TAB */}
        {tab === 'products' && (
          <div className="space-y-4">
            <div className="space-y-2">
              {products.map(p => (
                <div key={p.id} className="flex items-start justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.product_units?.map(u => `${u.unit_label}: ₦${u.unit_price.toLocaleString()}`).join(' · ')}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteProduct(p.id)}
                    className="h-8 w-8 text-destructive hover:text-destructive shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {products.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No products yet.</p>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="text-sm font-semibold">Add New Product</Label>
              <Input value={newProductName} onChange={e => setNewProductName(e.target.value)}
                placeholder="Product name (e.g. Broiler Feed)" />

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Units & Prices</Label>
                {units.map((row, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <select value={row.unit_label}
                      onChange={e => setUnits(u => u.map((r, idx) => idx === i ? { ...r, unit_label: e.target.value } : r))}
                      className="border border-border rounded-lg px-2 py-2 text-sm w-24 bg-background">
                      {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <Input type="number" min="0" step="any" value={row.unit_price}
                      onChange={e => setUnits(u => u.map((r, idx) => idx === i ? { ...r, unit_price: e.target.value } : r))}
                      placeholder="Price" className="flex-1" />
                    {units.length > 1 && (
                      <button type="button" onClick={() => setUnits(u => u.filter((_, idx) => idx !== i))}
                        className="text-muted-foreground hover:text-destructive">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setUnits(u => [...u, emptyUnit()])}
                  className="text-xs text-primary flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add another unit
                </button>
              </div>

              {productError && <p className="text-destructive text-xs">{productError}</p>}

              <Button onClick={addProduct} disabled={addingProduct || !newProductName} className="w-full gap-1.5">
                <Plus className="w-4 h-4" />
                {addingProduct ? 'Adding...' : 'Add Product'}
              </Button>
            </div>
          </div>
        )}

        {/* STAFF TAB */}
        {tab === 'staff' && (
          <div className="space-y-4">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <Label className="text-sm font-semibold mb-2 block">Invite Code</Label>
                <p className="text-xs text-muted-foreground mb-3">Share this code with staff to join your business</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-background border border-border rounded-lg px-4 py-2.5 font-mono text-lg tracking-widest text-center select-all">
                    {inviteCode || '--------'}
                  </code>
                  <Button variant="outline" size="icon" onClick={copyInviteCode} className="h-10 w-10 shrink-0">
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <Button variant="outline" size="icon" onClick={regenerateInviteCode}
                    disabled={regenerating} className="h-10 w-10 shrink-0" title="Regenerate invite code">
                    <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">🔄 Regenerate if the wrong person got this code</p>
              </CardContent>
            </Card>

            <Separator />

            {staff.filter(s => s.id !== userId && !s.is_admin).map(member => (
              <Card key={member.id} className="border-border/50">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm truncate">{member.email}</div>
                    <Button variant="ghost" size="icon" onClick={() => deleteUser(member.id, member.email)}
                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0 ml-2"
                      title="Delete user">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {PERM_LABELS.map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">{label}</Label>
                        <Switch checked={member.permissions?.[key] ?? false}
                          onCheckedChange={v => updatePermission(member.id, key, v)} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}

            {staff.filter(s => s.is_admin && s.id !== userId).map(member => (
              <div key={member.id} className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <span className="text-sm text-amber-700 dark:text-amber-400 truncate">{member.email}</span>
                <span className="text-xs bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded-full shrink-0 ml-2">Admin</span>
              </div>
            ))}

            {staff.filter(s => s.id !== userId).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No staff yet. Share your invite code above.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}