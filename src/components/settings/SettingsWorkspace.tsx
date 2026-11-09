import { useEffect, useState } from 'react'
import { ArrowLeft, Bell, Building2, ChevronRight, Languages, MessageSquareText, Moon, Package, Palette, Save, Sun, Users } from 'lucide-react'
import type { CompanySettings } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { BrandSettingsForm } from '@/features/tenant/components/BrandSettingsForm'
import { ProductManagementTable } from '@/features/tenant/components/ProductManagementTable'
import { StaffManagementTable, type StaffMember } from '@/features/tenant/components/StaffManagementTable'
import { TenantService } from '@/services/tenant.service'
import { supabase } from '@/integrations/supabase/client'

interface Props {
  userId: string
  tenantId: string
  company: CompanySettings
  onCompanyUpdated: (company: CompanySettings) => void
  isDark: boolean
  onToggleTheme: () => void
  onOpenAccount: () => void
  onOpenInventory: () => void
}
type Section = 'overview' | 'shop' | 'products' | 'staff' | 'preferences' | 'notifications' | 'reminder'
type Preferences = { unit: string; lowStockDefault: string; stockNotifications: boolean; salesNotifications: boolean; reminderMessage: string }
const KEY = 'agriledger-settings-preferences'
const DEFAULTS: Preferences = { unit: 'bag', lowStockDefault: '5', stockNotifications: true, salesNotifications: true, reminderMessage: 'Hello {name}, your outstanding balance is {balance}. Kindly make payment. Thank you.' }

export default function SettingsWorkspace({ userId, tenantId, company, onCompanyUpdated, isDark, onToggleTheme, onOpenAccount, onOpenInventory }: Props) {
  const [section, setSection] = useState<Section>('overview')
  const [preferences, setPreferences] = useState<Preferences>(DEFAULTS)
  const [saved, setSaved] = useState(false)
  const [products, setProducts] = useState<any[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [inviteCode, setInviteCode] = useState('')
  const [productCount, setProductCount] = useState(0)

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setPreferences({ ...DEFAULTS, ...JSON.parse(raw) }) } catch {}
    TenantService.getProducts(tenantId).then(rows => { setProducts(rows); setProductCount(rows.length) })
    supabase.from('profiles').select('id,email,is_admin,permissions').eq('tenant_id', tenantId).then(({ data }) => { if (data) setStaff(data as unknown as StaffMember[]) })
    supabase.from('tenants').select('invite_code').eq('id', tenantId).single().then(({ data }) => { if (data?.invite_code) setInviteCode(data.invite_code) })
  }, [tenantId])

  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(preferences)); setSaved(true) } catch { setSaved(false) }
  }
  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) => { setPreferences(current => ({ ...current, [key]: value })); setSaved(false) }
  const items = [
    { id: 'shop' as const, title: 'Business profile', detail: 'Business name, branding and appearance', icon: Building2 },
    { id: 'products' as const, title: 'Product catalogue', detail: 'Manage products and selling prices', icon: Package },
    { id: 'staff' as const, title: 'Staff and access', detail: 'Manage team members and permissions', icon: Users },
    { id: 'preferences' as const, title: 'Units and stock defaults', detail: 'Default selling units and low-stock threshold', icon: Palette },
    { id: 'notifications' as const, title: 'Notifications', detail: 'Choose the alerts shown in your workspace', icon: Bell },
    { id: 'reminder' as const, title: 'Credit reminder message', detail: 'Edit your default customer reminder', icon: MessageSquareText },
  ]
  const titles: Record<Exclude<Section, 'overview'>, string> = { shop: 'Business profile', products: 'Product catalogue', staff: 'Staff and access', preferences: 'Units and stock defaults', notifications: 'Notifications', reminder: 'Credit reminder message' }

  if (section !== 'overview') return <div className="mx-auto w-full max-w-[1600px] space-y-6 pb-8">
    <header className="flex items-center gap-3 border-b border-border pb-4"><Button variant="outline" size="icon" onClick={() => setSection('overview')} aria-label="Back to settings"><ArrowLeft size={17}/></Button><div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Workspace settings</p><h1 className="text-2xl font-bold">{titles[section]}</h1></div></header>
    {section === 'shop' && <BrandSettingsForm tenantId={tenantId} company={company} onCompanyUpdated={onCompanyUpdated}/>}
    {section === 'products' && <ProductManagementTable tenantId={tenantId} products={products} onProductsChanged={() => TenantService.getProducts(tenantId).then(rows => { setProducts(rows); setProductCount(rows.length) })}/>}
    {section === 'staff' && <StaffManagementTable userId={userId} tenantId={tenantId} staff={staff} inviteCode={inviteCode} onRegenerateCode={() => supabase.from('tenants').select('invite_code').eq('id', tenantId).single().then(({ data }) => { if (data?.invite_code) setInviteCode(data.invite_code) })} onStaffUpdated={() => supabase.from('profiles').select('id,email,is_admin,permissions').eq('tenant_id', tenantId).then(({ data }) => { if (data) setStaff(data as unknown as StaffMember[]) })}/>}
    {section === 'preferences' && <section className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-7"><div><h2 className="font-semibold">Default product preferences</h2><p className="text-sm text-muted-foreground">These defaults apply when you configure new products on this device.</p></div><label className="block space-y-2 text-sm font-medium">Default selling unit<select value={preferences.unit} onChange={e => update('unit', e.target.value)} className="h-11 w-full rounded-lg border border-input bg-background px-3"><option value="bag">Bag</option><option value="kg">Kilogram</option><option value="crate">Crate</option><option value="piece">Piece</option><option value="bottle">Bottle</option></select></label><label className="block space-y-2 text-sm font-medium">Suggested low-stock threshold<Input type="number" min="0" value={preferences.lowStockDefault} onChange={e => update('lowStockDefault', e.target.value)}/></label><p className="text-xs text-muted-foreground">Existing product thresholds remain unchanged. Currency is Nigerian Naira (₦).</p><Button onClick={save} className="gap-2"><Save size={15}/>Save preferences</Button>{saved && <span className="ml-2 text-xs text-emerald-700">Saved on this device</span>}</section>}
    {section === 'notifications' && <section className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-7"><h2 className="font-semibold">In-app notification preferences</h2>{(['stockNotifications','salesNotifications'] as const).map(key => <label key={key} className="flex items-center justify-between gap-4 rounded-xl border border-border p-4"><span><span className="block text-sm font-semibold">{key === 'stockNotifications' ? 'Stock alerts' : 'Sales activity'}</span><span className="text-xs text-muted-foreground">{key === 'stockNotifications' ? 'Low-stock and restock alerts' : 'Sales activity updates'}</span></span><input type="checkbox" checked={preferences[key]} onChange={e => update(key, e.target.checked)} className="h-4 w-4 accent-emerald-600"/></label>)}<p className="text-xs text-muted-foreground">These preferences are stored on this device. Browser push notifications are not enabled here.</p><Button onClick={save}><Save size={15} className="mr-2"/>Save preferences</Button>{saved && <span className="ml-2 text-xs text-emerald-700">Saved</span>}</section>}
    {section === 'reminder' && <section className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-7"><div><h2 className="font-semibold">Default credit reminder</h2><p className="text-sm text-muted-foreground">Use {'{name}'} and {'{balance}'} as placeholders.</p></div><Textarea rows={5} value={preferences.reminderMessage} onChange={e => update('reminderMessage', e.target.value)}/><Button onClick={save}><Save size={15} className="mr-2"/>Save reminder</Button>{saved && <span className="ml-2 text-xs text-emerald-700">Saved</span>}</section>}
  </div>

  return <div className="mx-auto w-full max-w-[1600px] space-y-6 pb-8">
    <header className="flex flex-col gap-1"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Workspace settings</p><h1 className="text-3xl font-bold tracking-tight">Settings</h1><p className="text-sm text-muted-foreground">Manage your business, team and account preferences.</p></header>
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="border-b border-border bg-muted/30 p-5"><h2 className="font-semibold">Business and workspace</h2><p className="mt-1 text-sm text-muted-foreground">{company.company_name} · {productCount} catalogue products · {staff.length} team members</p></div>{items.map(item => <button key={item.id} onClick={() => setSection(item.id)} className="group flex w-full items-center gap-3 border-b border-border px-5 py-4 text-left last:border-0 hover:bg-muted/50"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground"><item.icon size={18}/></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{item.detail}</span></span><ChevronRight size={17} className="text-muted-foreground transition-transform group-hover:translate-x-0.5"/></button>)}</section>
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="border-b border-border bg-muted/30 p-5"><h2 className="font-semibold">My account</h2><p className="mt-1 text-sm text-muted-foreground">Your personal details, sign-in and display settings.</p></div><button onClick={onOpenAccount} className="flex w-full items-center gap-3 border-b border-border p-5 text-left transition-colors hover:bg-muted/50"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted"><Users size={18}/></span><span className="flex-1"><span className="block text-sm font-semibold">My account</span><span className="text-xs text-muted-foreground">Edit your profile and sign-in details</span></span><ChevronRight size={17}/></button><div className="flex items-center gap-3 border-b border-border p-5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">{isDark ? <Sun size={18}/> : <Moon size={18}/>}</span><span className="flex-1"><span className="block text-sm font-semibold">Appearance</span><span className="text-xs text-muted-foreground">{isDark ? 'Dark theme is enabled' : 'Light theme is enabled'}</span></span><Button variant="outline" onClick={onToggleTheme}>{isDark ? 'Light mode' : 'Dark mode'}</Button></div><button onClick={onOpenInventory} className="flex w-full items-center gap-3 p-5 text-left transition-colors hover:bg-muted/50"><Package size={18}/><span className="flex-1 text-sm font-semibold">Open inventory</span><ChevronRight size={17}/></button></section>
    </div>
  </div>
}
