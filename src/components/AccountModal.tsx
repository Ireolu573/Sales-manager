import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { KeyRound, Mail, Eye, EyeOff, Link, Unlink, AlertTriangle } from 'lucide-react'

interface Props {
  email: string
  onClose: () => void
}

export default function AccountModal({ email, onClose }: Props) {
  const { toast } = useToast()

  // Password change state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  // Email change state
  const [newEmail, setNewEmail] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)

  // Google identity state
  const [isGoogleUser, setIsGoogleUser] = useState(false)
  const [hasPasswordLogin, setHasPasswordLogin] = useState(false)
  const [unlinkingGoogle, setUnlinkingGoogle] = useState(false)
  const [googleIdentity, setGoogleIdentity] = useState<any>(null)

  useEffect(() => {
    // Check what identity providers the user has
    const checkIdentities = async () => {
      const { data, error } = await supabase.auth.getUserIdentities()
      if (error || !data) return

      const google = data.identities.find(i => i.provider === 'google')
      const password = data.identities.find(i => i.provider === 'email')

      setGoogleIdentity(google || null)
      setIsGoogleUser(!!google)
      setHasPasswordLogin(!!password)
    }
    checkIdentities()
  }, [])

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' })
      return
    }
    if (newPassword.length < 8) {
      toast({ title: 'Password must be at least 8 characters', variant: 'destructive' })
      return
    }
    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Password updated successfully!' })
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault()

    // Block email change if Google is still linked
    if (isGoogleUser) {
      toast({
        title: 'Unlink Google first',
        description: 'You must unlink your Google account before changing your email address.',
        variant: 'destructive'
      })
      return
    }

    if (!newEmail || newEmail === email) {
      toast({ title: 'Please enter a different email address', variant: 'destructive' })
      return
    }

    setSavingEmail(true)
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    setSavingEmail(false)
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      toast({
        title: 'Confirmation email sent',
        description: `Check both ${email} and ${newEmail} to confirm the change.`,
      })
      setNewEmail('')
    }
  }

  const handleUnlinkGoogle = async () => {
    if (!googleIdentity) return

    // Safety check — must have password login before unlinking Google
    // Otherwise user will be locked out
    if (!hasPasswordLogin) {
      toast({
        title: 'Set a password first',
        description: 'You need to set a password before unlinking Google, otherwise you will be locked out of your account.',
        variant: 'destructive'
      })
      return
    }

    if (!confirm('Are you sure you want to unlink your Google account? You will no longer be able to sign in with Google.')) return

    setUnlinkingGoogle(true)
    const { error } = await supabase.auth.unlinkIdentity(googleIdentity)
    setUnlinkingGoogle(false)

    if (error) {
      toast({ title: 'Error unlinking Google', description: error.message, variant: 'destructive' })
    } else {
      setIsGoogleUser(false)
      setGoogleIdentity(null)
      toast({
        title: 'Google unlinked successfully',
        description: 'You can now change your email address. Sign in with email and password going forward.',
      })
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>My Account</DialogTitle>
        </DialogHeader>

        {/* Current account info */}
        <div className="bg-muted/50 rounded-xl px-4 py-3 space-y-1">
          <p className="text-xs text-muted-foreground">Signed in as</p>
          <p className="text-sm font-semibold text-foreground">{email}</p>
          <div className="flex items-center gap-2 mt-1">
            {isGoogleUser && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Google linked
              </span>
            )}
            {hasPasswordLogin && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                Password set
              </span>
            )}
          </div>
        </div>

        {/* ── GOOGLE IDENTITY SECTION ── */}
        {isGoogleUser && (
          <>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Unlink className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Google Account</span>
              </div>

              {!hasPasswordLogin ? (
                <div className="bg-warning/10 border border-warning/30 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-medium text-warning flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />Set a password before unlinking
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You currently only have Google sign-in. If you unlink Google without setting a password first, you will be locked out of your account.
                  </p>
                  <p className="text-xs text-muted-foreground font-medium">
                    Set a password below first, then come back to unlink Google.
                  </p>
                </div>
              ) : (
                <div className="bg-muted/40 border border-border/60 rounded-xl p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Your account is linked to Google. To change your email address, you must unlink Google first. You have a password set so you won't be locked out.
                  </p>
                  <Button
                    onClick={handleUnlinkGoogle}
                    disabled={unlinkingGoogle}
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/5"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    {unlinkingGoogle ? 'Unlinking...' : 'Unlink Google Account'}
                  </Button>
                </div>
              )}
            </div>
            <Separator />
          </>
        )}

        {/* ── CHANGE PASSWORD ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              {hasPasswordLogin ? 'Change Password' : 'Set a Password'}
            </span>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">New Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Confirm Password</Label>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                autoComplete="new-password"
                required
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
              {confirmPassword && newPassword === confirmPassword && confirmPassword.length >= 8 && (
                <p className="text-xs text-success">Passwords match ✓</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={savingPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
              className="w-full"
              size="sm"
            >
              {savingPassword ? 'Saving...' : hasPasswordLogin ? 'Update Password' : 'Set Password'}
            </Button>
          </form>
        </div>

        <Separator />

        {/* ── CHANGE EMAIL ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Change Email</span>
          </div>

          {isGoogleUser ? (
            <div className="bg-muted/40 border border-border/60 rounded-xl p-3">
              <p className="text-xs text-muted-foreground">
                🔒 Email change is locked because your Google account is still linked. Unlink Google above first, then you can change your email.
              </p>
            </div>
          ) : (
            <form onSubmit={handleEmailChange} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">New Email Address</Label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="new@email.com"
                  autoComplete="email"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                A confirmation link will be sent to both your current and new email. You must confirm both to complete the change.
              </p>
              <Button
                type="submit"
                disabled={savingEmail || !newEmail || newEmail === email}
                className="w-full"
                variant="outline"
                size="sm"
              >
                {savingEmail ? 'Sending...' : 'Send Confirmation Email'}
              </Button>
            </form>
          )}
        </div>

      </DialogContent>
    </Dialog>
  )
}
