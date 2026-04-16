import { useState, lazy, Suspense, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import type { Tab, Permissions } from '@/lib/types'
import { supabase } from '@/integrations/supabase/client'
import AuthPage from '@/components/AuthPage'
import BusinessRegistration from '@/components/BusinessRegistration'
import DomainController from '@/components/DomainController'
import { Settings, Wifi, WifiOff, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

const SaleForm = lazy(() => import('@/components/SaleForm'))
const SalesTable = lazy(() => import('@/components/SalesTable'))
const StockForm = lazy(() => import('@/components/StockForm'))
const CreditManager = lazy(() => import('@/components/CreditManager'))
const Analytics = lazy(() => import('@/components/Analytics'))

const NAV_TABS = [
  { id: 'record' as Tab, label: 'Record', icon: '📝', perm: 'can_record_sales' },
  { id: 'history' as Tab, label: 'History', icon: '🗂️', perm: 'can_view_history' },
  { id: 'stock' as Tab, label: 'Stock', icon: '📦', perm: 'can_view_stock' },
  { id: 'analytics' as Tab, label: 'Analytics', icon: '📊', perm: 'can_view_analytics' },
  { id: 'credit' as Tab, label: 'Credit', icon: '📋', perm: 'can_manage_credit' },
]

// Convert a hex colour like #f59e0b into HSL string "38 92% 50%"
// so it can be dropped into Tailwind's CSS variable format
function hexToHsl(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return null
  let r = parseInt(result[1], 16) / 255
  let g = parseInt(result[2], 16) / 255
  let b = parseInt(result[3], 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

function applyBrandColor(hex: string) {
  if (!hex) return
  const hsl = hexToHsl(hex)
  if (!hsl) return
  const root = document.documentElement
  root.style.setProperty('--primary', hsl)
  root.style.setProperty('--ring', hsl)
}

export default function Dashboard() {
  const { user, isAdmin, loading, permissions, company, tenantId, showBusinessRegistration, setShowBusinessRegistration, refreshProfile, setCompany } = useAuth()
  const [tab, setTab] = useState<Tab>('record')
  const [animKey, setAnimKey] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showDC, setShowDC] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)

  // Apply brand colour whenever company settings load or change
  useEffect(() => {
    if (company?.brand_color) {
      applyBrandColor(company.brand_color)
    }
  }, [company?.brand_color])

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <div className="text-4xl">{company.logo_emoji}</div>
        <div className="w-8 h-8 rounded-full border-4 border-muted animate-spin border-t-primary" />
      </div>
    )
  }

  if (!user) return <AuthPage company={company} />

  if (showBusinessRegistration) {
    return (
      <BusinessRegistration
        userId={user.id}
        email={user.email || ''}
        onComplete={() => { setShowBusinessRegistration(false); refreshProfile() }}
      />
    )
  }

  const visibleTabs = NAV_TABS.filter(t => permissions[t.perm as keyof Permissions])

  const switchTab = (newTab: Tab) => {
    if (newTab === tab) return
    setTab(newTab)
    setAnimKey(k => k + 1)
  }

  const handleCompanyUpdated = (c: typeof company) => {
    setCompany(c)
    if (c?.brand_color) applyBrandColor(c.brand_color)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-20 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{company.logo_emoji}</span>
            <div>
              <div className="font-bold text-foreground text-sm leading-tight">{company.company_name}</div>
              <div className="text-xs text-muted-foreground leading-tight">{company.app_name}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {online
              ? <Wifi size={13} className="text-success" />
              : <WifiOff size={13} className="text-muted-foreground" />
            }
            {isAdmin && (
              <Button variant="ghost" size="icon" onClick={() => setShowDC(true)} className="h-8 w-8 text-primary hover:bg-primary/10">
                <Settings size={16} />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => supabase.auth.signOut()} className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
              <LogOut size={16} />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-5 pb-24">
        <div key={animKey} className="slide-up">
          <Suspense fallback={
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 rounded-full border-4 border-muted animate-spin border-t-primary" />
            </div>
          }>
            {tab === 'record' && permissions.can_record_sales && tenantId && (
              <SaleForm userId={user.id} tenantId={tenantId} onSaleAdded={() => setRefreshKey(k => k + 1)} />
            )}
            {tab === 'history' && permissions.can_view_history && tenantId && (
              <SalesTable userId={user.id} tenantId={tenantId} isAdmin={isAdmin} refreshKey={refreshKey} onDelete={() => setRefreshKey(k => k + 1)} />
            )}
            {tab === 'stock' && (permissions.can_view_stock || permissions.can_add_stock) && tenantId && (
              <StockForm userId={user.id} tenantId={tenantId} isAdmin={isAdmin || permissions.can_add_stock} />
            )}
            {tab === 'analytics' && permissions.can_view_analytics && tenantId && (
              <Analytics userId={user.id} tenantId={tenantId} isAdmin={isAdmin} refreshKey={refreshKey} />
            )}
            {tab === 'credit' && permissions.can_manage_credit && tenantId && (
              <CreditManager isAdmin={isAdmin} userId={user.id} tenantId={tenantId} />
            )}
          </Suspense>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-20 shadow-[0_-4px_16px_-4px_hsl(var(--foreground)/0.06)]">
        <div className="max-w-2xl mx-auto px-2 py-1.5 flex justify-around">
          {visibleTabs.map(t => (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition-all duration-200 min-w-0 flex-1 active:scale-95 ${
                tab === t.id ? 'text-primary scale-105' : 'text-muted-foreground opacity-60 hover:opacity-80'
              }`}
            >
              <span className="text-xl">{t.icon}</span>
              <span className="text-xs font-medium truncate">{t.label}</span>
              {tab === t.id && <div className="w-1 h-1 rounded-full bg-primary" />}
            </button>
          ))}
        </div>
      </nav>

      {/* Settings Dialog */}
      {showDC && tenantId && (
        <DomainController
          userId={user.id}
          tenantId={tenantId}
          company={company}
          onClose={() => setShowDC(false)}
          onCompanyUpdated={handleCompanyUpdated}
          onProductsChanged={() => setRefreshKey(k => k + 1)}
        />
      )}
    </div>
  )
}