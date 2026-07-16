import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Building2 } from 'lucide-react'
import WizardShell from './WizardShell'
import Step2ChooseCategory from './Step2ChooseCategory'
import Step3AddProducts from './Step3AddProducts'
import Step4TeamInvite from './Step4TeamInvite'
import Step5Finish from './Step5Finish'
import type { CategoryPreset, StarterProduct } from './onboardingData'
import type { CompanySettings } from '@/lib/types'

interface Props {
  userId: string
  email: string
  tenantId: string | null
  company: CompanySettings
  onComplete: () => void
}

const TOTAL_STEPS = 5

// Default permissions for new staff members joining an existing business
const DEFAULT_STAFF_PERMISSIONS = {
  can_record_sales: true,
  can_view_history: true,
  can_view_stock: false,
  can_add_stock: false,
  can_view_analytics: false,
  can_manage_credit: false,
}

export default function OnboardingWizard({ userId, email, tenantId, company, onComplete }: Props) {
  // If a tenant already exists, resume at its saved step. Otherwise start at step 1.
  const [step, setStep] = useState(tenantId ? (company.onboarding_step || 2) : 1)
  const [localTenantId, setLocalTenantId] = useState<string | null>(tenantId)
  const [companyName, setCompanyName] = useState(company.company_name || '')
  const [appName, setAppName] = useState(company.app_name || 'Sales Manager')
  const [brandColor, setBrandColor] = useState(company.brand_color || '#d97706')
  const [logoEmoji, setLogoEmoji] = useState(company.logo_emoji || '🏢')

  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [stagedProducts, setStagedProducts] = useState<StarterProduct[]>([])
  const [addedProductCount, setAddedProductCount] = useState(0)
  const [finishing, setFinishing] = useState(false)

  const persistStep = (n: number, extra: Record<string, unknown> = {}) => {
    if (!localTenantId) return
    supabase.from('company_settings').update({ onboarding_step: n, ...extra }).eq('tenant_id', localTenantId)
  }

  const goToStep = (n: number, extra: Record<string, unknown> = {}) => {
    persistStep(n, extra)
    setStep(n)
  }

  // ── Step 1: create business ────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyName.trim()) return
    setLoading(true)
    setError('')

    try {
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({ name: companyName, created_by: userId })
        .select('id')
        .single()

      if (tenantError) throw tenantError

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          tenant_id: tenant.id,
          is_admin: true,
          permissions: {
            can_record_sales: true,
            can_view_history: true,
            can_view_stock: true,
            can_add_stock: true,
            can_view_analytics: true,
            can_manage_credit: true,
          }
        })
        .eq('id', userId)

      if (profileError) throw profileError

      const { error: settingsError } = await supabase
        .from('company_settings')
        .insert({
          tenant_id: tenant.id,
          admin_id: userId,
          company_name: companyName,
          app_name: appName,
          brand_color: brandColor,
          logo_emoji: logoEmoji,
          onboarding_step: 2,
          onboarding_complete: false,
        })

      if (settingsError) throw settingsError

      setLocalTenantId(tenant.id)
      setStep(2)
    } catch (err: any) {
      setError(err.message || 'Failed to create business')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 1: join existing business (bypasses the rest of the wizard) ──
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinCode.trim()) return
    setLoading(true)
    setError('')

    try {
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id')
        .eq('invite_code', joinCode.trim().toLowerCase())
        .maybeSingle()

      if (tenantError) throw new Error('Something went wrong. Please try again.')
      if (!tenant) throw new Error('Invalid invite code. Please check and try again.')

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          tenant_id: tenant.id,
          is_admin: false,
          permissions: DEFAULT_STAFF_PERMISSIONS,
        })
        .eq('id', userId)

      if (profileError) throw profileError

      onComplete()
    } catch (err: any) {
      setError(err.message || 'Failed to join business')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2 → 3 ──────────────────────────────────────────────────────────
  const handleCategorySelect = (preset: CategoryPreset) => {
    setStagedProducts(preset.products)
    goToStep(3, { business_category: preset.key })
  }

  // ── Step 3 → 4 ──────────────────────────────────────────────────────────
  const handleProductsNext = (count: number) => {
    setAddedProductCount(count)
    goToStep(4)
  }

  // ── Step 5: finish ──────────────────────────────────────────────────────
  const handleFinish = async () => {
    setFinishing(true)
    if (localTenantId) {
      await supabase.from('company_settings')
        .update({ onboarding_step: 5, onboarding_complete: true })
        .eq('tenant_id', localTenantId)
    }
    setFinishing(false)
    onComplete()
  }

  // ── Step 1 render: create or join ────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-background to-muted/30">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 slide-up">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Welcome!</h1>
            <p className="text-muted-foreground text-sm mt-1">Set up your business to get started</p>
          </div>

          <div className="flex bg-muted rounded-lg p-1 mb-6">
            <button
              onClick={() => { setMode('create'); setError('') }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                mode === 'create' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Create Business
            </button>
            <button
              onClick={() => { setMode('join'); setError('') }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                mode === 'join' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Join Existing
            </button>
          </div>

          <Card className="slide-up shadow-xl border-border">
            <CardContent className="p-6">
              {mode === 'create' ? (
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Business Name</Label>
                    <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Acme Farms" required />
                  </div>
                  <div className="space-y-2">
                    <Label>App Name</Label>
                    <Input value={appName} onChange={e => setAppName(e.target.value)} placeholder="Sales Manager" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Brand Color</Label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)} className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
                        <Input value={brandColor} onChange={e => setBrandColor(e.target.value)} className="font-mono text-sm" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Logo Emoji</Label>
                      <Input value={logoEmoji} onChange={e => setLogoEmoji(e.target.value)} className="text-2xl text-center" maxLength={2} />
                    </div>
                  </div>
                  {error && <p className="text-destructive text-sm font-medium">{error}</p>}
                  <Button type="submit" disabled={loading} className="w-full h-11 font-semibold">
                    {loading ? 'Creating...' : 'Create Business'}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleJoin} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Invite Code</Label>
                    <Input
                      value={joinCode}
                      onChange={e => setJoinCode(e.target.value)}
                      placeholder="Enter invite code from your admin"
                      required
                      className="font-mono tracking-wider text-center text-lg"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                    <p className="text-xs text-muted-foreground">Ask your business admin for the invite code</p>
                  </div>
                  {error && <p className="text-destructive text-sm font-medium">{error}</p>}
                  <Button type="submit" disabled={loading} className="w-full h-11 font-semibold">
                    {loading ? 'Joining...' : 'Join Business'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!localTenantId) return null // safety guard, unreachable in practice

  // ── Steps 2-5 render inside the shared wizard shell ───────────────────────
  if (step === 2) {
    return (
      <WizardShell step={2} totalSteps={TOTAL_STEPS} title="What do you sell?" subtitle="Pick a starting point for your products">
        <Step2ChooseCategory onSelect={handleCategorySelect} />
      </WizardShell>
    )
  }

  if (step === 3) {
    return (
      <WizardShell step={3} totalSteps={TOTAL_STEPS} title="Add your products" subtitle="Set names, units, and prices">
        <Step3AddProducts
          tenantId={localTenantId}
          initialProducts={stagedProducts}
          onNext={handleProductsNext}
          onBack={() => goToStep(2)}
        />
      </WizardShell>
    )
  }

  if (step === 4) {
    return (
      <WizardShell step={4} totalSteps={TOTAL_STEPS} title="Invite your team" subtitle="Optional, you can do this later">
        <Step4TeamInvite
          tenantId={localTenantId}
          onNext={() => goToStep(5)}
          onBack={() => goToStep(3)}
        />
      </WizardShell>
    )
  }

  return (
    <WizardShell step={5} totalSteps={TOTAL_STEPS} title="You're all set">
      <Step5Finish
        companyName={companyName || company.company_name}
        logoEmoji={logoEmoji || company.logo_emoji}
        productCount={addedProductCount}
        onFinish={handleFinish}
        finishing={finishing}
      />
    </WizardShell>
  )
}
