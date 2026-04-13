import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { CompanySettings } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

interface Props {
  company: CompanySettings
}

export default function AuthPage({ company }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else if (data.user && !data.session) {
        setMessage('Account created! Please verify your email and then log in.')
        setMode('login')
      }
    }
    setLoading(false)
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-background to-muted/30">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 slide-up">
          <div className="text-5xl mb-3">{company.logo_emoji}</div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{company.company_name}</h1>
          <p className="text-muted-foreground text-sm mt-1">{company.app_name}</p>
        </div>

        <Card className="slide-up border-border shadow-xl">
          <CardContent className="p-6 space-y-4">
            <Button
              onClick={handleGoogle}
              disabled={googleLoading}
              variant="outline"
              className="w-full gap-3 h-11 border-border hover:bg-muted"
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              {googleLoading ? 'Signing in...' : 'Continue with Google'}
            </Button>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">or</span>
              <Separator className="flex-1" />
            </div>

            <div className="flex bg-muted rounded-lg p-1">
              <button
                onClick={() => setMode('login')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                  mode === 'login'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Log In
              </button>
              <button
                onClick={() => setMode('signup')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                  mode === 'signup'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-input">Email address</Label>
                <Input
                  id="email-input"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="border-border"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password-input">Password</Label>
                <Input
                  id="password-input"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="border-border"
                />
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-3 py-2 font-medium" role="alert">
                  {error}
                </div>
              )}

              {message && (
                <div className="bg-success/10 border border-success/30 text-success text-sm rounded-lg px-3 py-2 font-medium">
                  {message}
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full h-11 font-semibold">
                {loading ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Create Account'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
