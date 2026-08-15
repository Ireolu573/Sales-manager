import { useState } from 'react'
import type { CompanySettings } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Palette } from 'lucide-react'
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
    <Card className="border shadow-sm">
      <CardContent className="pt-5 sm:pt-6 space-y-4">
        <div className="flex items-center gap-2 font-semibold text-lg border-b pb-2">
          <Palette className="h-5 w-5 text-amber-600" />
          <span>Brand Settings</span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">Business / Store Name</Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Enterprises"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="appName">App Title</Label>
            <Input
              id="appName"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="e.g. Sales Manager"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="brandColor">Brand Accent Color</Label>
            <div className="flex gap-2">
              <Input
                id="brandColor"
                type="color"
                className="w-14 h-10 p-1 cursor-pointer shrink-0"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
              />
              <Input
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                placeholder="#d97706"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="logoEmoji">Brand Emoji Logo</Label>
            <Input
              id="logoEmoji"
              value={logoEmoji}
              onChange={(e) => setLogoEmoji(e.target.value)}
              maxLength={4}
              placeholder="🏢"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={saveBrand} disabled={saving} className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white">
            {saving ? 'Saving...' : 'Save Brand Settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
