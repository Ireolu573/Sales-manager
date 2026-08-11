import { useState } from 'react'
import type { Permissions } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Users, Copy, Check, RefreshCw, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'

export interface StaffMember {
  id: string
  email: string
  is_admin: boolean
  permissions: Permissions
}

interface Props {
  userId: string
  tenantId: string
  staff: StaffMember[]
  inviteCode: string
  onRegenerateCode: () => void
  onStaffUpdated: () => void
}

const PERM_LABELS: { key: keyof Permissions; label: string }[] = [
  { key: 'can_record_sales', label: 'Record Sales' },
  { key: 'can_view_history', label: 'View History' },
  { key: 'can_view_stock', label: 'View Stock' },
  { key: 'can_add_stock', label: 'Add Stock' },
  { key: 'can_view_analytics', label: 'View Analytics' },
  { key: 'can_manage_credit', label: 'Manage Credit' },
]

export function StaffManagementTable({ userId, tenantId, staff, inviteCode, onRegenerateCode, onStaffUpdated }: Props) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const copyInviteCode = async () => {
    await navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    toast({ title: 'Invite code copied!' })
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    const newCode = Math.random().toString(36).slice(2, 10).toLowerCase()
    const { error } = await supabase.from('tenants').update({ invite_code: newCode }).eq('id', tenantId)
    setRegenerating(false)
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      onRegenerateCode()
      toast({ title: 'Invite code regenerated!', description: 'Old code is now invalid.' })
    }
  }

  const updatePermission = async (targetUserId: string, permKey: keyof Permissions, value: boolean) => {
    const target = staff.find(s => s.id === targetUserId)
    if (!target) return

    const newPerms = { ...target.permissions, [permKey]: value }
    const { error } = await supabase.from('profiles').update({ permissions: newPerms }).eq('id', targetUserId)

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      onStaffUpdated()
      toast({ title: 'Permissions updated' })
    }
  }

  const deleteUser = async (targetUserId: string) => {
    const { error } = await supabase.from('profiles').delete().eq('id', targetUserId)
    if (error) {
      toast({ title: 'Error deleting user', description: error.message, variant: 'destructive' })
    } else {
      onStaffUpdated()
      toast({ title: 'User removed' })
    }
  }

  const otherStaff = staff.filter(s => s.id !== userId && !s.is_admin)
  const adminStaff = staff.filter(s => s.is_admin && s.id !== userId)

  return (
    <Card className="border shadow-sm">
      <CardContent className="pt-6 space-y-6">
        <div className="flex items-center gap-2 font-semibold text-lg border-b pb-2">
          <Users className="h-5 w-5 text-amber-600" />
          <span>Team & Staff Management</span>
        </div>

        {/* Invite Code Section */}
        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-lg space-y-2">
          <Label className="text-sm font-semibold block text-amber-900 dark:text-amber-300">
            Business Invite Code
          </Label>
          <p className="text-xs text-muted-foreground">Share this code with staff members to allow them to join your business store.</p>
          <div className="flex items-center gap-2 pt-1">
            <code className="flex-1 bg-background border rounded-md px-4 py-2 font-mono text-lg font-bold tracking-widest text-center select-all">
              {inviteCode || '--------'}
            </code>
            <Button variant="outline" size="icon" onClick={copyInviteCode}>
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="icon" onClick={handleRegenerate} disabled={regenerating}>
              <RefreshCw className={`h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Staff Members List */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-foreground">Active Staff Members ({otherStaff.length})</h4>
          {otherStaff.map(member => (
            <Card key={member.id} className="border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{member.email}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                    onClick={() => deleteUser(member.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Remove
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border-t pt-3">
                  {PERM_LABELS.map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between bg-muted/30 p-2 rounded border">
                      <Label className="text-xs">{label}</Label>
                      <Switch
                        checked={member.permissions?.[key] ?? false}
                        onCheckedChange={(val) => updatePermission(member.id, key, val)}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {adminStaff.length > 0 && (
            <div className="space-y-2 pt-2">
              <h4 className="font-medium text-sm text-foreground">Co-Admins ({adminStaff.length})</h4>
              {adminStaff.map(member => (
                <div key={member.id} className="flex items-center justify-between p-3 bg-muted rounded-md border text-sm">
                  <span>{member.email}</span>
                  <span className="text-xs bg-amber-600 text-white px-2 py-0.5 rounded-full font-medium">Admin</span>
                </div>
              ))}
            </div>
          )}

          {staff.filter(s => s.id !== userId).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-md">
              No additional staff members added yet. Share the invite code above.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
