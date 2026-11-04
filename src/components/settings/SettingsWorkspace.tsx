import { Building2, Palette, Package, Users, Bell, ShieldCheck, UserCircle, ChevronRight, Moon, Sun, Settings2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { CompanySettings } from '@/lib/types'

interface Props {
  company: CompanySettings
  isDark: boolean
  onToggleTheme: () => void
  onOpenBusinessSettings: () => void
  onOpenAccount: () => void
}

const groups = [
  { title: 'Business', description: 'Shop details, products and team access', icon: Building2, action: 'Manage business', key: 'business' },
  { title: 'Products & stock', description: 'Manage your product catalogue and stock settings', icon: Package, action: 'Manage products', key: 'products' },
  { title: 'Team & permissions', description: 'Staff accounts, invite codes and access levels', icon: Users, action: 'Manage team', key: 'team' },
]

export default function SettingsWorkspace({ company, isDark, onToggleTheme, onOpenBusinessSettings, onOpenAccount }: Props) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#16A34A]">Workspace preferences</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0F172A] sm:text-3xl">Settings</h1>
          <p className="mt-1 text-sm text-[#64748B]">Manage your shop, products, team and application preferences.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-3 py-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F1F5F9] text-[#0F172A]"><Building2 size={18}/></span>
          <span className="min-w-0"><span className="block text-[11px] text-[#64748B]">Current business</span><span className="block max-w-[220px] truncate text-sm font-semibold text-[#0F172A]">{company.company_name}</span></span>
        </div>
      </div>

      <section className="space-y-3">
        <div><h2 className="text-base font-bold text-[#0F172A]">Business settings</h2><p className="text-xs text-[#64748B]">Control the information and people connected to your shop.</p></div>
        <div className="grid gap-3 md:grid-cols-2">
          {groups.map(({title,description,icon:Icon,action}) => (
            <button key={title} onClick={onOpenBusinessSettings} className="group flex min-h-[112px] items-center gap-4 rounded-xl border border-[#CBD5E1] bg-white p-4 text-left transition hover:border-[#16A34A]/50 hover:shadow-sm sm:p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F0FDF4] text-[#166534]"><Icon size={20}/></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-[#0F172A]">{title}</span><span className="mt-1 block text-xs leading-5 text-[#64748B]">{description}</span><span className="mt-2 block text-xs font-semibold text-[#166534]">{action}</span></span>
              <ChevronRight size={18} className="shrink-0 text-[#94A3B8] transition group-hover:translate-x-0.5"/>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div><h2 className="text-base font-bold text-[#0F172A]">Preferences</h2><p className="text-xs text-[#64748B]">Adjust how AgriLedger looks and how you access your account.</p></div>
        <Card className="rounded-xl border-[#CBD5E1] bg-white shadow-none">
          <CardContent className="divide-y divide-[#E2E8F0] p-0">
            <div className="flex items-center gap-3 p-4 sm:p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F1F5F9] text-[#475569]"><Palette size={18}/></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#0F172A]">Appearance</span><span className="block text-xs text-[#64748B]">Choose light or dark application theme.</span></span>
              <Button variant="outline" size="sm" className="gap-2 border-[#CBD5E1] text-[#0F172A]" onClick={onToggleTheme}>{isDark ? <Sun size={15}/> : <Moon size={15}/>}<span className="hidden sm:inline">{isDark ? 'Light mode' : 'Dark mode'}</span></Button>
            </div>
            <button onClick={onOpenAccount} className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-[#F8FAFC] sm:p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F1F5F9] text-[#475569]"><UserCircle size={18}/></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#0F172A]">My profile</span><span className="block text-xs text-[#64748B]">Update your personal account information.</span></span>
              <ChevronRight size={18} className="text-[#94A3B8]"/>
            </button>
            <div className="flex items-center gap-3 p-4 sm:p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F0FDF4] text-[#166534]"><ShieldCheck size={18}/></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#0F172A]">Data & security</span><span className="block text-xs text-[#64748B]">Your business data is protected by your workspace access rules.</span></span>
              <span className="text-xs font-semibold text-[#166534]">Protected</span>
            </div>
          </CardContent>
        </Card>
      </section>
      <p className="text-center text-xs text-[#94A3B8]">AgriLedger · Farm shop sales, stock and customer credit in one place</p>
    </div>
  )
}
