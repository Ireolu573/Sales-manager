import { useState } from 'react'
import type { Permissions } from '@/lib/types'
import { DEFAULT_PERMS } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Copy, RefreshCw, Users, Shield, User, Trash2, Check, Key } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'

export interface StaffMember {
  id: string
  email: string
  is_admin?: boolean
  permissions?: Permissions | null
  created_at?: string
}

interface Props {
  userId: string
  tenantId: string
  staff: StaffMember[]
  inviteCode: string
  onRegenerateCode: () => void
  onStaffUpdated: () => void
}

const PERMISSION_KEYS: { key: keyof Permissions; label: string }[] = [
  { key: 'can_record_sales', label: 'Record Sales' },
  { key: 'can_view_history', label: 'View History' },
  { key: 'can_view_stock', label: 'View Stock' },
  { key: 'can_add_stock', label: 'Add Stock' },
  { key: 'can_view_analytics', label: 'View Analytics' },
  { key: 'can_manage_credit', label: 'Manage Credit' },
]

export function StaffManagementTable({
  userId,
  tenantId,
  staff,
  inviteCode,
  onRegenerateCode,
  onStaffUpdated,
}: Props) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null)

  const copyInviteCode = async () => {
    if (!inviteCode) return
    await navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    toast({ title: 'Invite code copied!' })
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRegenerateCode = async () => {
    setRegenerating(true)
    const newCode = Math.random().toString(36).slice(2, 10).toLowerCase()
    const { error } = await supabase
      .from('tenants')
      .update({ invite_code: newCode })
      .eq('id', tenantId)

    setRegenerating(false)
    if (error) {
      toast({ title: 'Error regenerating code', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Invite code regenerated!', description: 'Old code is now invalid.' })
      onRegenerateCode()
    }
  }

  const togglePermission = async (member: StaffMember, permKey: keyof Permissions) => {
    setUpdatingMemberId(member.id)
    const currentPerms: Permissions = member.permissions || DEFAULT_PERMS
    const updatedPerms: Permissions = {
      ...currentPerms,
      [permKey]: !currentPerms[permKey],
    }

    const { error } = await supabase
      .from('profiles')
      .update({ permissions: updatedPerms as any })
      .eq('id', member.id)

    setUpdatingMemberId(null)

    if (error) {
      toast({ title: 'Error updating permissions', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Permissions updated' })
      onStaffUpdated()
    }
  }

  const removeStaffMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this staff member from your business?')) return

    setUpdatingMemberId(memberId)
    const { error } = await supabase
      .from('profiles')
      .update({ tenant_id: null, permissions: DEFAULT_PERMS as any })
      .eq('id', memberId)

    setUpdatingMemberId(null)

    if (error) {
      toast({ title: 'Error removing staff', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Staff member removed' })
      onStaffUpdated()
    }
  }

  return (
    <div className="space-y-6">
      {/* Invite Code Box */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-amber-600" />
              <h3 className="font-semibold text-base">Business Invite Code</h3>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerateCode}
              disabled={regenerating}
              className="text-xs gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? 'animate-spin' : ''}`} />
              Regenerate
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Share this code with team members so they can join your store account.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-background border rounded-lg px-4 py-2.5 font-mono text-lg tracking-widest text-center font-bold select-all">
              {inviteCode || '--------'}
            </code>
            <Button
              variant="default"
              onClick={copyInviteCode}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Staff Roster */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-amber-600" />
            Staff Members ({staff.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-4 space-y-4">
          {staff.length === 0 ? (
            <p className="text-center py-6 text-sm text-muted-foreground">
              No staff members have joined yet. Share your invite code above to get started!
            </p>
          ) : (
            <div className="divide-y rounded-lg border overflow-hidden">
              {staff.map((member) => {
                const isCurrent = member.id === userId
                const memberPerms = member.permissions || DEFAULT_PERMS
                const isLoadingMember = updatingMemberId === member.id

                return (
                  <div key={member.id} className="p-4 bg-card space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {member.is_admin ? (
                          <Shield className="h-4 w-4 text-amber-600 shrink-0" />
                        ) : (
                          <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <span className="font-medium text-sm truncate">{member.email}</span>
                        {isCurrent && (
                          <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-600">
                            You
                          </Badge>
                        )}
                        {member.is_admin && (
                          <Badge className="text-xs bg-amber-600 hover:bg-amber-700 text-white">
                            Admin
                          </Badge>
                        )}
                      </div>

                      {!member.is_admin && !isCurrent && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isLoadingMember}
                          onClick={() => removeStaffMember(member.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs h-8 gap-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </Button>
                      )}
                    </div>

                    {!member.is_admin ? (
                      <div className="pt-2 border-t">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Access Permissions</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {PERMISSION_KEYS.map(({ key, label }) => {
                            const isChecked = Boolean(memberPerms[key])
                            return (
                              <label
                                key={key}
                                className={`flex items-center gap-2 p-2 rounded border text-xs cursor-pointer transition-colors ${
                                  isChecked
                                    ? 'bg-amber-500/10 border-amber-500/30 font-medium'
                                    : 'bg-muted/30 border-transparent hover:border-border'
                                } ${isLoadingMember ? 'opacity-50 cursor-wait' : ''}`}
                              >
                                <Checkbox
                                  checked={isChecked}
                                  disabled={isLoadingMember}
                                  onCheckedChange={() => togglePermission(member, key)}
                                />
                                <span>{label}</span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic pt-1">
                        Admins have full access to all features.
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default StaffManagementTable
