import { useState, useEffect, createContext, useContext, type ReactNode } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import type { User } from '@supabase/supabase-js'
import { Permissions, CompanySettings, DEFAULT_PERMS, ADMIN_PERMS, DEFAULT_COMPANY } from '@/lib/types'

interface AuthContextType {
  user: User | null
  isAdmin: boolean
  loading: boolean
  permissions: Permissions
  company: CompanySettings
  tenantId: string | null
  showBusinessRegistration: boolean
  setShowBusinessRegistration: (v: boolean) => void
  refreshProfile: () => void
  setCompany: (c: CompanySettings) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [permissions, setPermissions] = useState<Permissions>(DEFAULT_PERMS)
  const [company, setCompany] = useState<CompanySettings>(DEFAULT_COMPANY)
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [showBusinessRegistration, setShowBusinessRegistration] = useState(false)

  const fetchProfile = async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, is_admin, permissions, tenant_id, email')
        .eq('id', userId)
        .single()

      if (profileError) {
        if (profileError.code === 'PGRST116') {
          setTenantId(null)
          setIsAdmin(false)
          setPermissions(DEFAULT_PERMS)
          setShowBusinessRegistration(true)
          setLoading(false)
          return
        }
        throw profileError
      }

      const admin = profileData?.is_admin ?? false
      const tID = profileData?.tenant_id

      setTenantId(tID)
      setIsAdmin(admin)
      setPermissions(admin ? ADMIN_PERMS : (profileData?.permissions as unknown as Permissions) || DEFAULT_PERMS)

      if (!tID) {
        setShowBusinessRegistration(true)
        setLoading(false)
        return
      }

      const { data: companyData } = await supabase
        .from('company_settings')
        .select('*')
        .eq('tenant_id', tID)
        .maybeSingle()

      if (companyData) setCompany(companyData as unknown as CompanySettings)
    } catch (err) {
      console.error('Error fetching profile:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null
      setUser(u)
      if (u) fetchProfile(u.id)
      else setLoading(false)
    })

    // Listen for auth state changes (handles web OAuth redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) fetchProfile(u.id)
      else { setIsAdmin(false); setLoading(false) }
    })

    // Handle deep link redirect on Android/iOS
    // When Google OAuth redirects back to com.stepan.salesmanager://login-callback
    // Capacitor catches it and fires this event with the full URL
    if (Capacitor.isNativePlatform()) {
      App.addListener('appUrlOpen', async ({ url }) => {
        // The URL will look like:
        // com.stepan.salesmanager://login-callback#access_token=...&refresh_token=...
        if (url.includes('login-callback')) {
          // Extract the fragment (everything after #)
          const fragment = url.split('#')[1]
          if (fragment) {
            // Parse the tokens from the URL fragment
            const params = new URLSearchParams(fragment)
            const accessToken = params.get('access_token')
            const refreshToken = params.get('refresh_token')

            if (accessToken && refreshToken) {
              // Set the session manually using the tokens from the deep link
              const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              })
              if (!error && data.user) {
                setUser(data.user)
                fetchProfile(data.user.id)
              }
            }
          }
        }
      })
    }

    return () => subscription.unsubscribe()
  }, [])

  const refreshProfile = () => {
    if (user) fetchProfile(user.id)
  }

  return (
    <AuthContext.Provider value={{
      user, isAdmin, loading, permissions, company, tenantId,
      showBusinessRegistration, setShowBusinessRegistration,
      refreshProfile, setCompany
    }}>
      {children}
    </AuthContext.Provider>
  )
}