import { useState, useEffect, createContext, useContext, type ReactNode } from 'react'
import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react'
import { supabase } from '@/integrations/supabase/client'
import type { UserResource } from '@clerk/types'
import { Permissions, CompanySettings, DEFAULT_PERMS, ADMIN_PERMS, DEFAULT_COMPANY } from '@/lib/types'

interface AuthContextType {
  user: UserResource | null
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
  const { isLoaded, isSignedIn, userId } = useClerkAuth()
  const { user } = useUser()

  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [permissions, setPermissions] = useState<Permissions>(DEFAULT_PERMS)
  const [company, setCompany] = useState<CompanySettings>(DEFAULT_COMPANY)
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [showBusinessRegistration, setShowBusinessRegistration] = useState(false)

  const fetchProfile = async (clerkUserId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, is_admin, permissions, tenant_id, email, clerk_user_id')
        .eq('clerk_user_id', clerkUserId)
        .maybeSingle()

      if (profileError) throw profileError

      if (!profileData) {
        setTenantId(null)
        setIsAdmin(false)
        setPermissions(DEFAULT_PERMS)
        setShowBusinessRegistration(true)
        setLoading(false)
        return
      }

      const admin = profileData.is_admin ?? false
      const tID = profileData.tenant_id

      setTenantId(tID)
      setIsAdmin(admin)
      setPermissions(admin ? ADMIN_PERMS : (profileData.permissions as unknown as Permissions) || DEFAULT_PERMS)

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
    if (!isLoaded) return

    if (isSignedIn && userId) {
      fetchProfile(userId)
    } else {
      setIsAdmin(false)
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, userId])

  const refreshProfile = () => {
    if (userId) fetchProfile(userId)
  }

  return (
    <AuthContext.Provider value={{
      user: user ?? null, isAdmin, loading, permissions, company, tenantId,
      showBusinessRegistration, setShowBusinessRegistration,
      refreshProfile, setCompany
    }}>
      {children}
    </AuthContext.Provider>
  )
}
