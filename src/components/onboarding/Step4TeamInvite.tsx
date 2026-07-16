import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Check, Copy, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Props {
  tenantId: string
  onNext: () => void
  onBack: () => void
}

export default function Step4TeamInvite({ tenantId, onNext, onBack }: Props) {
  const { toast } = useToast()
  const [inviteCode, setInviteCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
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

  return (
    <Card className="slide-up shadow-xl border-border">
      <CardContent className="p-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          Invite staff now, or skip and share the code later from Settings.
        </p>

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
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <RefreshCw className="w-3 h-3" />Regenerate if the wrong person got this code
            </p>
          </CardContent>
        </Card>

        <div className="flex items-center gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onBack} className="flex-1">
            Back
          </Button>
          <Button type="button" onClick={onNext} className="flex-1 font-semibold">
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
