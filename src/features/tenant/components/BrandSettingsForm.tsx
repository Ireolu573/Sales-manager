import { useState } from 'react'
import type { CompanySettings } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Palette, Store, Check, ImagePlus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { TenantService } from '@/services/tenant.service'

interface Props {
  tenantId: string
  company: CompanySettings
  onCompanyUpdated: (c: CompanySettings) => void
}

export function BrandSettingsForm({ tenantId, company, onCompanyUpdated }: Props) {
  const { toast } = useToast()
  const [companyName, setCompanyName] = useState(company.company_name)
  const [appName, setAppName] = useState(company.app_name)
  const [brandColor, setBrandColor] = useState(company.brand_color)
  const [logoEmoji, setLogoEmoji] = useState(company.logo_emoji)
  const [saving, setSaving] = useState(false)

  const saveBrand = async () => {
    setSaving(true)
    try {
      const updates = { company_name: companyName, app_name: appName, brand_color: brandColor, logo_emoji: logoEmoji }
      const updated = await TenantService.updateCompanySettings(tenantId, updates)
      onCompanyUpdated({ ...company, ...updated })
      toast({ title: 'Brand updated successfully!' })
    } catch (err: any) {
      toast({ title: 'Error updating brand', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="border-border shadow-sm">
        <CardContent className="space-y-6 p-5 sm:p-7">
          <div className="flex items-start gap-3 border-b border-border pb-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Store size={20}/></span>
            <div><h2 className="text-lg font-semibold">Business details</h2><p className="mt-1 text-sm text-muted-foreground">Set the name and identity customers and staff see in AgriLedger.</p></div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="companyName">Business name</Label><Input id="companyName" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. Hosannah Farms and Animal Production Services" className="h-11"/></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="appName">Workspace name</Label><Input id="appName" value={appName} onChange={e => setAppName(e.target.value)} placeholder="AgriLedger" className="h-11"/><p className="text-xs text-muted-foreground">The name displayed in your workspace.</p></div>
            <div className="space-y-2"><Label htmlFor="brandColor">Brand colour</Label><div className="flex h-11 items-center gap-3 rounded-lg border border-input bg-background px-3"><Input id="brandColor" type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)} className="h-8 w-10 cursor-pointer border-0 p-0"/><Input aria-label="Brand colour hex value" value={brandColor} onChange={e => setBrandColor(e.target.value)} className="h-9 border-0 px-0 font-mono uppercase shadow-none focus-visible:ring-0"/></div></div>
            <div className="space-y-2"><Label htmlFor="logoEmoji">Business mark</Label><Input id="logoEmoji" value={logoEmoji} onChange={e => setLogoEmoji(e.target.value)} maxLength={4} placeholder="🌱" className="h-11"/><p className="text-xs text-muted-foreground">Use a short symbol or emoji as your workspace mark.</p></div>
          </div>
          <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">Changes apply to this business workspace.</p><Button onClick={saveBrand} disabled={saving || !companyName.trim() || !appName.trim()} className="h-11 gap-2 px-6">{saving ? 'Saving changes...' : <><Check size={16}/>Save changes</>}</Button></div>
        </CardContent>
      </Card>
      <Card className="h-fit overflow-hidden border-border shadow-sm">
        <div className="border-b border-border bg-muted/30 p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live preview</p><h3 className="mt-1 font-semibold">Workspace identity</h3></div>
        <CardContent className="p-5">
          <div className="rounded-2xl border border-border bg-background p-5">
            <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl" style={{ backgroundColor: brandColor + '18' }}>{logoEmoji || '🌱'}</span><div className="min-w-0"><p className="truncate font-semibold">{companyName || 'Your business name'}</p><p className="truncate text-xs text-muted-foreground">{appName || 'Workspace name'}</p></div></div>
            <div className="mt-6 h-2 rounded-full" style={{ backgroundColor: brandColor }}/>
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground"><span>Primary action</span><span className="rounded-md px-3 py-2 font-semibold text-white" style={{ backgroundColor: brandColor }}>Save changes</span></div>
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">Your selected colour updates the workspace accent. The preview shows how the business identity will appear in the app.</p>
        </CardContent>
      </Card>
    </div>
  )
}
