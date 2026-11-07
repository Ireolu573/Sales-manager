import { useState, lazy, Suspense, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { Tab, Permissions } from '@/lib/types'
import { supabase } from '@/integrations/supabase/client'
import AuthPage from '@/components/AuthPage'
import AgriLedgerLogo from '@/components/brand/AgriLedgerLogo'
import OnboardingWizard from '@/components/onboarding/OnboardingWizard'
import DomainController from '@/components/DomainController'
import AccountModal from '@/components/AccountModal'
import { Menu, Settings, Wifi, WifiOff, LogOut, UserCircle, Sun, Moon, NotebookPen, History, Package, BarChart3, CreditCard, Keyboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useQueryClient } from '@tanstack/react-query'
import { flushQueue, getQueueLength } from '@/lib/offlineQueue'
import { useToast } from '@/hooks/use-toast'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import KeyboardShortcutsHelp from '@/components/KeyboardShortcutsHelp'
import { SkeletonPage } from '@/components/ui/loading-skeletons'
import DashboardOverview from '@/components/DashboardOverview'

const SaleForm = lazy(() => import('@/components/SaleForm'))
const SalesTable = lazy(() => import('@/components/SalesTable'))
const StockForm = lazy(() => import('@/components/StockForm'))
const CreditManager = lazy(() => import('@/components/CreditManager'))
const Analytics = lazy(() => import('@/components/Analytics'))

const NAV_TABS = [
  { id: 'dashboard' as Tab, label: 'Dashboard', icon: BarChart3, perm: null },
  { id: 'record' as Tab, label: 'New sale', icon: NotebookPen, perm: 'can_record_sales' as const },
  { id: 'history' as Tab, label: 'Sales history', icon: History, perm: 'can_view_history' as const },
  { id: 'stock' as Tab, label: 'Inventory', icon: Package, perm: 'can_view_stock' as const },
  { id: 'credit' as Tab, label: 'Customers', icon: CreditCard, perm: 'can_manage_credit' as const },
  { id: 'analytics' as Tab, label: 'Reports', icon: BarChart3, perm: 'can_view_analytics' as const },
]

const VALID_TABS: Tab[] = NAV_TABS.map(tab => tab.id)

const resolveTabFromSearch = (search: string): Tab => {
  const tabParam = new URLSearchParams(search).get('tab')
  return tabParam && VALID_TABS.includes(tabParam as Tab) ? (tabParam as Tab) : 'record'
}

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

// Store the last applied brand color so toggleTheme can re-apply it after a switch.
// We write to :root as an inline style which overrides the stylesheet, so it works
// in both light and dark modes (both use hsl(var(--primary)) tokens).
let _brandColorHsl: string | null = null

function applyBrandColor(hex: string) {
  if (!hex) return
  const hsl = hexToHsl(hex)
  if (!hsl) return
  _brandColorHsl = hsl
  document.documentElement.style.setProperty('--brand-accent', hsl)
}

export default function Dashboard() {
  const { user, isAdmin, loading, permissions, company, tenantId, showBusinessRegistration, setShowBusinessRegistration, refreshProfile, setCompany } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()

  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === 'undefined') return 'record'
    return resolveTabFromSearch(window.location.search)
  })
  const [animKey, setAnimKey] = useState(0)
  const [showDC, setShowDC] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [online, setOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true)
  // 🌙 Dark mode: read from localStorage so it persists across sessions
  const [isDark, setIsDark] = useState(() => false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme')
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark')
      } else if (savedTheme === 'light') {
        document.documentElement.classList.remove('dark')
      }
      setIsDark(savedTheme === 'dark')
    }
  }, [])

  useEffect(() => {
    if (company?.brand_color) applyBrandColor(company.brand_color)
  }, [company?.brand_color])

  // 📶 Offline queue: flush pending sales when connection returns
  const handleOnline = useCallback(async () => {
    setOnline(true)
    const pending = getQueueLength()
    if (pending === 0) return

    toast({
      title: 'Back online!',
      description: `Syncing ${pending} queued sale${pending > 1 ? 's' : ''}…`,
    })

    const synced = await flushQueue()
    if (synced > 0) {
      // Invalidate so SaleForm, SalesTable, Analytics all refresh
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      toast({
        title: 'Sync complete',
        description: `${synced} sale${synced > 1 ? 's' : ''} pushed to the server.`,
      })
    }
  }, [queryClient, toast])

  useEffect(() => {
    const off = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', off)
    }
  }, [handleOnline])

  // 🌙 Toggle dark mode and persist to localStorage
  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
    // Re-apply brand color after theme switch — inline style survives
    // the class change so this is a no-op if color hasn't changed, but
    // it guarantees the primary token is correct in both modes.
    if (_brandColorHsl) {
      document.documentElement.style.setProperty('--brand-accent', _brandColorHsl)
    }
  }

  // ── All hooks and derived values must come BEFORE any early returns ──────
  // React requires hooks to be called unconditionally on every render.
  // switchTab is a plain function (not a hook) but useKeyboardShortcuts IS a
  // hook, so it — and everything it depends on — must live above the guards.

  const syncTabToUrl = useCallback((nextTab: Tab) => {
    const params = new URLSearchParams(location.search)

    if (nextTab === 'dashboard') {
      params.delete('tab')
    } else {
      params.set('tab', nextTab)
    }

    const nextSearch = params.toString()
    const target = nextSearch ? `/?${nextSearch}` : '/'
    const currentSearch = location.search || ''

    if (currentSearch === (nextSearch ? `?${nextSearch}` : '')) return
    navigate(target)
  }, [location.search, navigate])

  const switchTab = (newTab: Tab) => {
    if (newTab === tab) return
    setTab(newTab)
    setAnimKey(k => k + 1)
    syncTabToUrl(newTab)
  }

  useEffect(() => {
    const nextTab = resolveTabFromSearch(location.search)
    if (nextTab !== tab) {
      setTab(nextTab)
    }
  }, [location.search, tab])

  const { showHelp, setShowHelp } = useKeyboardShortcuts({
    onTabSwitch: switchTab,
    onToggleDark: toggleTheme,
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const visibleTabs = NAV_TABS.filter(t => !t.perm || permissions[t.perm as keyof Permissions])
  const mobileTabs = visibleTabs.filter(t => ['dashboard', 'record', 'stock', 'credit'].includes(t.id))
  const handleCompanyUpdated = (c: typeof company) => {
    setCompany(c)
    if (c?.brand_color) applyBrandColor(c.brand_color)
  }
  const queuedCount = getQueueLength()

  // ── Early returns (guards) — hooks are all done above ─────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <AgriLedgerLogo size={52} />
        <div className="w-8 h-8 rounded-full border-4 border-muted animate-spin border-t-primary" />
      </div>
    )
  }

  if (!user) return <AuthPage company={company} />

  if (showBusinessRegistration) {
    return (
      <OnboardingWizard
        userId={user.id}
        email={user.email || ''}
        tenantId={tenantId}
        company={company}
        onComplete={() => { setShowBusinessRegistration(false); refreshProfile() }}
      />
    )
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Desktop navigation — mobile uses the bottom navigation below. */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-30 w-64 flex-col border-r border-border bg-card">
        <div className="flex h-20 items-center gap-3 border-b border-border px-6">
          <AgriLedgerLogo size={42} />
          <div className="min-w-0">
            <p className="truncate text-base font-bold tracking-tight text-foreground">{company.company_name}</p>
            <p className="truncate text-xs text-muted-foreground">Sales & inventory</p>
          </div>
        </div>
        <div className="px-4 pt-7 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Workspace</div>
        <nav className="flex-1 space-y-1 px-3">
          {visibleTabs.map(t => (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              aria-current={tab === t.id ? 'page' : undefined}
            >
              <t.icon size={18} strokeWidth={tab === t.id ? 2.3 : 1.9} />
              <span>{t.label}</span>
              {tab === t.id && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
            </button>
          ))}
        </nav>
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-2 rounded-xl bg-muted/70 p-3">
            <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-destructive'}`} />
            <span className="text-xs font-medium text-muted-foreground">{online ? 'Connected' : 'Offline mode'}</span>
            {!online && queuedCount > 0 && <span className="ml-auto text-xs font-semibold text-destructive">{queuedCount} queued</span>}
          </div>
        </div>
      </aside>

      {/* Header */}
      <header className="bg-card/95 backdrop-blur border-b border-border sticky top-0 z-20 shadow-sm lg:ml-64">
        <div className="mx-auto max-w-none px-4 py-3 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AgriLedgerLogo size={30} />
            <div>
              <div className="font-bold text-foreground text-sm leading-tight">{company.company_name}</div>
              <div className="text-xs text-muted-foreground leading-tight">AgriLedger</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-2 pr-3">
              <Button variant="outline" onClick={() => switchTab('stock')} className="h-9 gap-2 rounded-lg">
                <Package size={15} /> Add stock
              </Button>
              <Button onClick={() => switchTab('record')} className="h-9 gap-2 rounded-lg shadow-sm">
                <NotebookPen size={15} /> Record sale
              </Button>
            </div>
            {/* 📶 Wi-Fi indicator — shows queue count when offline */}
            <div className="relative">
              {online
                ? <Wifi size={13} className="text-success" />
                : <WifiOff size={13} className="text-destructive" />
              }
              {!online && queuedCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-destructive text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none">
                  {queuedCount}
                </span>
              )}
            </div>

            {/* ☰ Hamburger — opens the menu pane with theme, settings, account, sign out */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowMenu(true)}
              className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
              title="Menu"
            >
              <Menu size={18} />
            </Button>
          </div>
        </div>

        {/* 📶 Offline banner — shown when offline with queued sales */}
        {!online && (
          <div className="bg-destructive/10 border-t border-destructive/20 px-4 py-1.5 text-center">
            <p className="text-xs text-destructive font-medium">
              You're offline.{queuedCount > 0 ? ` ${queuedCount} sale${queuedCount > 1 ? 's' : ''} queued — will sync when reconnected.` : ' Sales will be queued until reconnected.'}
            </p>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-none mx-auto px-4 py-5 pb-24 overflow-y-auto lg:ml-64 lg:px-8 lg:py-8 lg:pb-10">
        <div key={animKey} className="slide-up">
          <Suspense fallback={<SkeletonPage />}>
            {tab === 'dashboard' && tenantId && (\n              <DashboardOverview userId={user.id} tenantId={tenantId} isAdmin={isAdmin} onSwitchTab={switchTab} />\n            )}\n            {tab === 'record' && permissions.can_record_sales && tenantId && (
              <SaleForm userId={user.id} tenantId={tenantId} />
            )}
            {tab === 'history' && permissions.can_view_history && tenantId && (
              <SalesTable userId={user.id} tenantId={tenantId} isAdmin={isAdmin} />
            )}
            {tab === 'stock' && (permissions.can_view_stock || permissions.can_add_stock) && tenantId && (
              <StockForm userId={user.id} tenantId={tenantId} isAdmin={isAdmin || permissions.can_add_stock} />
            )}
            {tab === 'analytics' && permissions.can_view_analytics && tenantId && (
              <Analytics userId={user.id} tenantId={tenantId} isAdmin={isAdmin} />
            )}
            {tab === 'credit' && permissions.can_manage_credit && tenantId && (
              <CreditManager isAdmin={isAdmin} userId={user.id} tenantId={tenantId} />
            )}
            {tab === 'leaderboard' && permissions.can_view_analytics && tenantId && (
              <InventoryOverview
                tenantId={tenantId}
                isAdmin={isAdmin}
                onOpenSettings={isAdmin ? () => setShowDC(true) : undefined}
                onSwitchTab={switchTab}
              />
            )}
          </Suspense>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-20 shadow-[0_-4px_16px_-4px_hsl(var(--foreground)/0.06)]">
        <div className="max-w-2xl mx-auto px-2 py-1.5 flex justify-around lg:hidden">
          {visibleTabs.map(t => (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition-all duration-200 min-w-0 flex-1 active:scale-95 ${
                tab === t.id ? 'text-primary scale-105' : 'text-muted-foreground opacity-60 hover:opacity-80'
              }`}
            >
              <t.icon size={20} strokeWidth={tab === t.id ? 2.25 : 2} />
              <span className="text-xs font-medium truncate">{t.id === 'dashboard' ? 'Home' : t.id === 'record' ? 'Sales' : t.id === 'credit' ? 'Customers' : t.label}</span>
              {tab === t.id && <div className="w-1 h-1 rounded-full bg-primary" />}
            </button>
          ))}
        </div>
      </nav>

      {showDC && tenantId && (
        <DomainController
          userId={user.id}
          tenantId={tenantId}
          company={company}
          onClose={() => setShowDC(false)}
          onCompanyUpdated={handleCompanyUpdated}
          onProductsChanged={() => {}}
        />
      )}

      {showAccount && (
        <AccountModal
          email={user.email || ''}
          onClose={() => setShowAccount(false)}
        />
      )}

      {/* ⌨️ Keyboard shortcuts overlay */}
      {showHelp && <KeyboardShortcutsHelp onClose={() => setShowHelp(false)} />}

      {/* ☰ Hamburger menu pane */}
      <Sheet open={showMenu} onOpenChange={setShowMenu}>
        <SheetContent side="right" className="flex flex-col gap-1">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>

          <Button
            variant="ghost"
            className="justify-start gap-3 h-11 text-foreground"
            onClick={() => { setShowMenu(false); setShowHelp(true) }}
          >
            <Keyboard size={16} />
            Keyboard shortcuts
          </Button>

          <Button
            variant="ghost"
            className="justify-start gap-3 h-11 text-foreground"
            onClick={() => { toggleTheme() }}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
            {isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          </Button>

          {isAdmin && (
            <Button
              variant="ghost"
              className="justify-start gap-3 h-11 text-foreground"
              onClick={() => { setShowMenu(false); setShowDC(true) }}
            >
              <Settings size={16} />
              Settings
            </Button>
          )}

          <Button
            variant="ghost"
            className="justify-start gap-3 h-11 text-foreground"
            onClick={() => { setShowMenu(false); setShowAccount(true) }}
          >
            <UserCircle size={16} />
            My Account
          </Button>

          <div className="mt-auto pt-2 border-t border-border">
            <Button
              variant="ghost"
              className="justify-start gap-3 h-11 w-full text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => { setShowMenu(false); supabase.auth.signOut() }}
            >
              <LogOut size={16} />
              Sign out
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
