import { useEffect, useState } from 'react'
import { Building2, Bell, MessageSquareText, Languages, Moon, Sun, ChevronRight, Store, Ruler, AlertTriangle, KeyRound, ArrowLeft, Save, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BrandSettingsForm } from '@/features/tenant/components/BrandSettingsForm'
import { Textarea } from '@/components/ui/textarea'
import type { CompanySettings } from '@/lib/types'

interface Props {
  company: CompanySettings
  tenantId: string
  onCompanyUpdated: (company: CompanySettings) => void
  isDark: boolean
  fullName: string
  email: string
  phone: string
  role: string
  onToggleTheme: () => void
  onOpenAccount: () => void
  onOpenInventory: () => void
}

type Section = 'overview' | 'shop' | 'units' | 'alerts' | 'notifications' | 'reminder' | 'language'
type Preferences = {
  unit: string
  lowStockDefault: string
  stockNotifications: boolean
  salesNotifications: boolean
  reminderMessage: string
  language: string
}

const STORAGE_KEY = 'agriledger-settings-preferences'
const DEFAULTS: Preferences = {
  unit: 'bag',
  lowStockDefault: '5',
  stockNotifications: true,
  salesNotifications: true,
  reminderMessage: 'Hello {name}, this is a friendly reminder about your outstanding balance of {balance} at our shop. Please let us know when you can make payment. Thank you.',
  language: 'en',
}

const shopItems = [
  { label: 'Shop details', description: 'Business name and contact information', icon: Store, section: 'shop' },
  { label: 'Units and currency', description: 'Default selling unit and currency display', icon: Ruler, section: 'units' },
  { label: 'Low stock alerts', description: 'Review product reorder thresholds', icon: AlertTriangle, section: 'alerts' },
] as const
const preferenceItems = [
  { label: 'Notifications', description: 'Stock and sales notification preferences', icon: Bell, section: 'notifications' },
  { label: 'Reminder message', description: 'Default customer credit reminder', icon: MessageSquareText, section: 'reminder' },
  { label: 'Language', description: 'Application language', icon: Languages, section: 'language' },
] as const

export default function SettingsWorkspace({ company, tenantId, onCompanyUpdated, isDark, fullName, email, phone, role, onToggleTheme, onOpenAccount, onOpenInventory }: Props) {
  const [section, setSection] = useState<Section>('overview')
  const [preferences, setPreferences] = useState<Preferences>(DEFAULTS)
  const [saved, setSaved] = useState(false)
  const initials = (fullName || company.company_name || 'A').trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('')

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored) setPreferences({ ...DEFAULTS, ...JSON.parse(stored) })
    } catch { /* Keep safe defaults when browser storage is unavailable. */ }
  }, [])

  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPreferences(current => ({ ...current, [key]: value }))
    setSaved(false)
  }
  const save = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
      setSaved(true)
    } catch { setSaved(false) }
  }
  const SettingRow = ({ label, description, icon: Icon, onClick }: { label: string; description: string; icon: typeof Store; onClick: () => void }) => (
    <button type="button" onClick={onClick} className="group flex w-full items-center gap-3 border-b border-[#E2E8F0] px-4 py-4 text-left last:border-0 hover:bg-[#F8FAFC] sm:px-5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F1F5F9] text-[#475569]"><Icon size={17}/></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#0F172A]">{label}</span><span className="mt-0.5 block text-xs text-[#64748B]">{description}</span></span>
      <ChevronRight size={17} className="shrink-0 text-[#94A3B8] group-hover:translate-x-0.5"/>
    </button>
  )

  const pageTitle: Record<Exclude<Section, 'overview'>, string> = {
    shop: 'Shop details',
    units: 'Units and currency',
    alerts: 'Low stock alerts',
    notifications: 'Notifications',
    reminder: 'Reminder message',
    language: 'Language',
  }

  if (section !== 'overview') {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-5 pb-8">
        <header className="flex items-center gap-3 border-b border-[#CBD5E1] pb-4">
          <Button variant="outline" size="icon" onClick={() => setSection('overview')} aria-label="Back to settings"><ArrowLeft size={17}/></Button>
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#16A34A]">Settings</p><h1 className="text-2xl font-bold text-[#0F172A]">{pageTitle[section]}</h1></div>
        </header>
        {section === 'shop' && <BrandSettingsForm tenantId={tenantId} company={company} onCompanyUpdated={onCompanyUpdated} />}
        {section === 'units' && (
          <section className="space-y-4 rounded-xl border border-[#CBD5E1] bg-white p-4 sm:p-6">
            <div><h2 className="font-semibold text-[#0F172A]">Display preferences</h2><p className="mt-1 text-sm text-[#64748B]">Choose the default selling unit for new products. The shop currently records all transactions in Nigerian Naira.</p></div>
            <div className="space-y-1.5 text-sm"><span className="font-medium text-[#0F172A]">Shop currency</span><p className="rounded-md border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2.5 text-[#475569]">Nigerian Naira (₦) · NGN</p></div>
            <label className="block space-y-1.5 text-sm font-medium text-[#0F172A]">Default selling unit
              <select value={preferences.unit} onChange={e => update('unit', e.target.value)} className="h-10 w-full rounded-md border border-[#CBD5E1] bg-white px-3">
                <option value="bag">Bag</option><option value="kg">Kilogram (kg)</option><option value="piece">Piece</option><option value="crate">Crate</option><option value="litre">Litre</option>
              </select>
            </label>
            <p className="text-xs text-[#64748B]">The default unit is saved in this browser and applied when you add a product. Currency is currently fixed to NGN; no currency conversion is performed.</p>
            <Button onClick={save} className="gap-2"><Save size={15}/> Save preferences</Button>{saved && <span className="ml-2 text-xs font-medium text-[#166534]">Saved on this device</span>}
          </section>
        )}
        {section === 'alerts' && (
          <section className="space-y-4 rounded-xl border border-[#CBD5E1] bg-white p-4 sm:p-6">
            <div><h2 className="font-semibold text-[#0F172A]">Product reorder levels</h2><p className="mt-1 text-sm text-[#64748B]">AgriLedger uses each product’s own low-stock threshold to calculate its stock status.</p></div>
            <label className="block space-y-1.5 text-sm font-medium text-[#0F172A]">Suggested default for newly configured products
              <Input type="number" min="0" step="1" value={preferences.lowStockDefault} onChange={e => update('lowStockDefault', e.target.value)}/>
            </label>
            <p className="text-xs text-[#64748B]">Changing this suggested default does not overwrite existing product thresholds. Edit a product’s actual reorder level in Inventory.</p>
            <div className="flex flex-wrap gap-2"><Button onClick={save} className="gap-2"><Save size={15}/> Save default</Button><Button variant="outline" onClick={onOpenInventory} className="gap-2"><Package size={15}/> Open inventory</Button></div>
            {saved && <span className="text-xs font-medium text-[#166534]">Saved on this device</span>}
          </section>
        )}
        {section === 'notifications' && (
          <section className="space-y-4 rounded-xl border border-[#CBD5E1] bg-white p-4 sm:p-6">
            <div><h2 className="font-semibold text-[#0F172A]">Notification preferences</h2><p className="mt-1 text-sm text-[#64748B]">Choose which in-app notification categories you want enabled.</p></div>
            {(['stockNotifications', 'salesNotifications'] as const).map((key) => <label key={key} className="flex items-center justify-between gap-4 rounded-lg border border-[#E2E8F0] p-3"><span><span className="block text-sm font-semibold text-[#0F172A]">{key === 'stockNotifications' ? 'Stock alerts' : 'Sales activity'}</span><span className="text-xs text-[#64748B]">{key === 'stockNotifications' ? 'Low-stock and restock reminders' : 'Sales recording notifications'}</span></span><input type="checkbox" checked={preferences[key]} onChange={e => update(key, e.target.checked)} className="h-4 w-4 accent-[#16A34A]"/></label>)}
            <p className="text-xs text-[#64748B]">These are saved preferences; browser push notifications are not configured by this screen.</p>
            <Button onClick={save} className="gap-2"><Save size={15}/> Save preferences</Button>{saved && <span className="ml-2 text-xs font-medium text-[#166534]">Saved on this device</span>}
          </section>
        )}
        {section === 'reminder' && (
          <section className="space-y-4 rounded-xl border border-[#CBD5E1] bg-white p-4 sm:p-6">
            <div><h2 className="font-semibold text-[#0F172A]">Default credit reminder</h2><p className="mt-1 text-sm text-[#64748B]">Create the message template used when preparing a customer reminder.</p></div>
            <Textarea rows={5} value={preferences.reminderMessage} onChange={e => update('reminderMessage', e.target.value)}/>
            <p className="text-xs text-[#64748B]">Placeholders: {'{name}'} for customer name and {'{balance}'} for outstanding balance. This template is stored in this browser.</p>
            <Button onClick={save} className="gap-2"><Save size={15}/> Save reminder template</Button>{saved && <span className="ml-2 text-xs font-medium text-[#166534]">Saved on this device</span>}
          </section>
        )}
        {section === 'language' && (
          <section className="space-y-4 rounded-xl border border-[#CBD5E1] bg-white p-4 sm:p-6">
            <div><h2 className="font-semibold text-[#0F172A]">Application language</h2><p className="mt-1 text-sm text-[#64748B]">English is currently the supported interface language.</p></div>
            <label className="block space-y-1.5 text-sm font-medium text-[#0F172A]">Language
              <select value={preferences.language} onChange={e => update('language', e.target.value)} className="h-10 w-full rounded-md border border-[#CBD5E1] bg-white px-3"><option value="en">English</option></select>
            </label>
            <Button onClick={save} className="gap-2"><Save size={15}/> Save language</Button>{saved && <span className="ml-2 text-xs font-medium text-[#166534]">Saved on this device</span>}
          </section>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-8">
      <header className="flex flex-col gap-1"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#16A34A]">AgriLedger workspace</p><h1 className="text-2xl font-bold tracking-tight text-[#0F172A] sm:text-3xl">Settings</h1><p className="text-sm text-[#64748B]">Manage your shop preferences and personal account.</p></header>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section className="overflow-hidden rounded-xl border border-[#CBD5E1] bg-white">
          <div className="flex items-center gap-3 border-b border-[#E2E8F0] p-4 sm:p-5"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F0FDF4] text-[#166534]"><Building2 size={19}/></span><div className="min-w-0"><h2 className="text-sm font-bold text-[#0F172A]">Shop</h2><p className="truncate text-xs text-[#64748B]">{company.company_name}</p></div></div>
          <div className="px-4 pt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">Shop settings</div>
          {shopItems.map(item => <SettingRow key={item.label} {...item} onClick={() => setSection(item.section)}/>)}
          <div className="border-t border-[#E2E8F0] px-4 pt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">Preferences</div>
          {preferenceItems.map(item => <SettingRow key={item.label} {...item} onClick={() => setSection(item.section)}/>)}
          <div className="flex items-center gap-3 border-t border-[#E2E8F0] p-4 sm:px-5"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F1F5F9] text-[#475569]">{isDark ? <Sun size={17}/> : <Moon size={17}/>}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#0F172A]">Appearance</span><span className="block text-xs text-[#64748B]">{isDark ? 'Dark theme enabled' : 'Light theme enabled'}</span></span><Button variant="outline" size="sm" onClick={onToggleTheme}>{isDark ? 'Light mode' : 'Dark mode'}</Button></div>
          <div className="border-t border-[#E2E8F0] p-4 sm:px-5"><button type="button" onClick={onOpenAccount} className="flex w-full items-center gap-3 text-left"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F1F5F9] text-[#475569]"><KeyRound size={17}/></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#0F172A]">Change password</span><span className="block text-xs text-[#64748B]">Update your account sign-in password</span></span><ChevronRight size={17} className="text-[#94A3B8]"/></button></div>
        </section>
        <section className="overflow-hidden rounded-xl border border-[#CBD5E1] bg-white">
          <div className="border-b border-[#E2E8F0] p-4 sm:p-5"><h2 className="text-base font-bold text-[#0F172A]">Profile</h2><p className="mt-1 text-xs text-[#64748B]">Your personal details and account access.</p></div>
          <div className="flex flex-col items-center border-b border-[#E2E8F0] px-5 py-7 text-center"><div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#0F172A] text-2xl font-bold text-white">{initials || 'A'}</div><h3 className="mt-3 text-lg font-bold text-[#0F172A]">{fullName || 'Your profile'}</h3><p className="text-sm text-[#64748B]">{role}</p><Button variant="outline" size="sm" className="mt-4" onClick={onOpenAccount}>Manage account</Button></div>
          <div className="divide-y divide-[#E2E8F0]"><div className="flex items-start justify-between gap-4 px-4 py-4 sm:px-5"><span className="text-xs text-[#64748B]">Full name</span><span className="text-right text-sm font-semibold text-[#0F172A]">{fullName || 'Not provided'}</span></div><div className="flex items-start justify-between gap-4 px-4 py-4 sm:px-5"><span className="text-xs text-[#64748B]">Phone number</span><span className="text-right text-sm font-semibold text-[#0F172A]">{phone || 'Not provided'}</span></div><div className="flex items-start justify-between gap-4 px-4 py-4 sm:px-5"><span className="text-xs text-[#64748B]">Email</span><span className="max-w-[65%] break-all text-right text-sm font-semibold text-[#0F172A]">{email}</span></div><div className="flex items-start justify-between gap-4 px-4 py-4 sm:px-5"><span className="text-xs text-[#64748B]">Role</span><span className="text-right text-sm font-semibold text-[#0F172A]">{role}</span></div></div>
          <div className="p-4 sm:p-5"><Button className="w-full" onClick={onOpenAccount}>Edit profile details</Button></div>
        </section>
      </div>
      <p className="text-center text-xs text-[#94A3B8]">AgriLedger · Farm shop sales, stock and customer credit in one place</p>
    </div>
  )
}
