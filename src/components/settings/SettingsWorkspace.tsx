import { Building2, Bell, MessageSquareText, Languages, UserCircle, Moon, Sun, ChevronRight, Store, Ruler, AlertTriangle, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CompanySettings } from '@/lib/types'

interface Props {
  company: CompanySettings
  isDark: boolean
  fullName: string
  email: string
  phone: string
  role: string
  onToggleTheme: () => void
  onOpenBusinessSettings: () => void
  onOpenAccount: () => void
}

const shopItems = [
  { label: 'Shop details', description: 'Business name and contact information', icon: Store },
  { label: 'Units and currency', description: 'Selling units and Naira settings', icon: Ruler },
  { label: 'Low stock alerts', description: 'Set when products need reordering', icon: AlertTriangle },
]
const preferenceItems = [
  { label: 'Notifications', description: 'Stock and sales notifications', icon: Bell },
  { label: 'Reminder message', description: 'Customer credit reminder defaults', icon: MessageSquareText },
  { label: 'Language', description: 'Application language', icon: Languages },
]

export default function SettingsWorkspace({ company, isDark, fullName, email, phone, role, onToggleTheme, onOpenBusinessSettings, onOpenAccount }: Props) {
  const initials = (fullName || company.company_name || 'A').trim().split(/\\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('')

  const SettingRow = ({ label, description, icon: Icon, onClick }: { label: string; description: string; icon: typeof Store; onClick: () => void }) => (
    <button type="button" onClick={onClick} className="group flex w-full items-center gap-3 border-b border-[#E2E8F0] px-4 py-4 text-left last:border-0 hover:bg-[#F8FAFC] sm:px-5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F1F5F9] text-[#475569]"><Icon size={17}/></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#0F172A]">{label}</span><span className="mt-0.5 block text-xs text-[#64748B]">{description}</span></span>
      <ChevronRight size={17} className="shrink-0 text-[#94A3B8] group-hover:translate-x-0.5"/>
    </button>
  )

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-8">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#16A34A]">AgriLedger workspace</p>
        <h1 className="text-2xl font-bold tracking-tight text-[#0F172A] sm:text-3xl">Settings</h1>
        <p className="text-sm text-[#64748B]">Manage your shop preferences and personal account.</p>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section className="overflow-hidden rounded-xl border border-[#CBD5E1] bg-white">
          <div className="flex items-center gap-3 border-b border-[#E2E8F0] p-4 sm:p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F0FDF4] text-[#166534]"><Building2 size={19}/></span>
            <div className="min-w-0"><h2 className="text-sm font-bold text-[#0F172A]">Shop</h2><p className="truncate text-xs text-[#64748B]">{company.company_name}</p></div>
          </div>
          <div className="px-4 pt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">Shop settings</div>
          {shopItems.map(item => <SettingRow key={item.label} {...item} onClick={onOpenBusinessSettings}/>)}
          <div className="border-t border-[#E2E8F0] px-4 pt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">Preferences</div>
          {preferenceItems.map(item => <SettingRow key={item.label} {...item} onClick={onOpenBusinessSettings}/>)}
          <div className="flex items-center gap-3 border-t border-[#E2E8F0] p-4 sm:px-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F1F5F9] text-[#475569]">{isDark ? <Sun size={17}/> : <Moon size={17}/>}</span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#0F172A]">Appearance</span><span className="block text-xs text-[#64748B]">{isDark ? 'Dark theme enabled' : 'Light theme enabled'}</span></span>
            <Button variant="outline" size="sm" onClick={onToggleTheme}>{isDark ? 'Light mode' : 'Dark mode'}</Button>
          </div>
          <div className="border-t border-[#E2E8F0] p-4 sm:px-5">
            <button type="button" onClick={onOpenAccount} className="flex w-full items-center gap-3 text-left">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F1F5F9] text-[#475569]"><KeyRound size={17}/></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#0F172A]">Change password</span><span className="block text-xs text-[#64748B]">Update your account sign-in password</span></span>
              <ChevronRight size={17} className="text-[#94A3B8]"/>
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#CBD5E1] bg-white">
          <div className="border-b border-[#E2E8F0] p-4 sm:p-5">
            <h2 className="text-base font-bold text-[#0F172A]">Profile</h2>
            <p className="mt-1 text-xs text-[#64748B]">Your personal details and account access.</p>
          </div>
          <div className="flex flex-col items-center border-b border-[#E2E8F0] px-5 py-7 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#0F172A] text-2xl font-bold text-white">{initials || 'A'}</div>
            <h3 className="mt-3 text-lg font-bold text-[#0F172A]">{fullName || 'Your profile'}</h3>
            <p className="text-sm text-[#64748B]">{role}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={onOpenAccount}>Manage account</Button>
          </div>
          <div className="divide-y divide-[#E2E8F0]">
            <div className="flex items-start justify-between gap-4 px-4 py-4 sm:px-5"><span className="text-xs text-[#64748B]">Full name</span><span className="text-right text-sm font-semibold text-[#0F172A]">{fullName || 'Not provided'}</span></div>
            <div className="flex items-start justify-between gap-4 px-4 py-4 sm:px-5"><span className="text-xs text-[#64748B]">Phone number</span><span className="text-right text-sm font-semibold text-[#0F172A]">{phone || 'Not provided'}</span></div>
            <div className="flex items-start justify-between gap-4 px-4 py-4 sm:px-5"><span className="text-xs text-[#64748B]">Email</span><span className="max-w-[65%] break-all text-right text-sm font-semibold text-[#0F172A]">{email}</span></div>
            <div className="flex items-start justify-between gap-4 px-4 py-4 sm:px-5"><span className="text-xs text-[#64748B]">Role</span><span className="text-right text-sm font-semibold text-[#0F172A]">{role}</span></div>
          </div>
          <div className="p-4 sm:p-5"><Button className="w-full" onClick={onOpenAccount}>Edit profile details</Button></div>
        </section>
      </div>
      <p className="text-center text-xs text-[#94A3B8]">AgriLedger · Farm shop sales, stock and customer credit in one place</p>
    </div>
  )
}
