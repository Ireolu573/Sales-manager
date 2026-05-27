import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Building2 } from 'lucide-react'

interface Props {
  userId: string
  email: string
  onComplete: () => void
}

// Default permissions for new staff members
const DEFAULT_STAFF_PERMISSIONS = {
  can_record_sales: true,
  can_view_history: true,
  can_view_stock: false,
  can_add_stock: false,
  can_view_analytics: false,
  can_manage_credit: false,
}

export default function BusinessRegistration({ userId, email, onComplete }: Props) {
  const [companyName, setCompanyName] = useState('')
  const [appName, setAppName] = useState('Sales Manager')
  const [brandColor, setBrandColor] = useState('#d97706')
  const [logoEmoji, setLogoEmoji] = useState('🏢')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'create' | 'join'>('create')
  const [joinCode, setJoinCode] = useState('')

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
        })

      if (settingsError) throw settingsError

      onComplete()
    } catch (err: any) {
      setError(err.message || 'Failed to create business')
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinCode.trim()) return
    setLoading(true)
    setError('')

    try {
      // Use maybeSingle() instead of single() so it returns null instead of throwing
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id')
        .eq('invite_code', joinCode.trim().toLowerCase())
        .maybeSingle()

      if (tenantError) throw new Error('Something went wrong. Please try again.')
      if (!tenant) throw new Error('Invalid invite code. Please check and try again.')

      // Link profile to tenant AND set default permissions so tabs are visible
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
            onClick={() => { setStep('create'); setError('') }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
              step === 'create' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            Create Business
          </button>
          <button
            onClick={() => { setStep('join'); setError('') }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
              step === 'join' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            Join Existing
          </button>
        </div>

        <Card className="slide-up shadow-xl border-border">
          <CardContent className="p-6">
            {step === 'create' ? (
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
