/**
 * useKeyboardShortcuts.ts
 * Global keyboard shortcut handler for the Dashboard.
 *
 * Shortcuts (only fire when no input/textarea is focused):
 *   R  → Record tab
 *   H  → History tab
 *   S  → Stock tab
 *   A  → Analytics tab
 *   C  → Credit tab
 *   B  → leaderBoard tab
 *   D  → toggle Dark mode
 *   ?  → show shortcut help overlay
 *
 * Returns { showHelp, setShowHelp } so the caller can render the help modal.
 */
import { useEffect, useState, useCallback } from 'react'
import type { Tab } from '@/lib/types'

interface Options {
  onTabSwitch: (tab: Tab) => void
  onToggleDark: () => void
}

const TAB_KEYS: Record<string, Tab> = {
  r: 'record',
  h: 'history',
  s: 'stock',
  a: 'analytics',
  c: 'credit',
  b: 'leaderboard',
}

export function useKeyboardShortcuts({ onTabSwitch, onToggleDark }: Options) {
  const [showHelp, setShowHelp] = useState(false)

  const handleKey = useCallback((e: KeyboardEvent) => {
    // Don't fire when typing in an input, textarea, or select
    const tag = (e.target as HTMLElement).tagName
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return
    if (e.ctrlKey || e.metaKey || e.altKey) return

    const key = e.key.toLowerCase()

    if (key === '?') { setShowHelp(v => !v); return }
    if (key === 'd') { onToggleDark(); return }
    if (TAB_KEYS[key]) { onTabSwitch(TAB_KEYS[key]); return }
    if (key === 'escape') { setShowHelp(false); return }
  }, [onTabSwitch, onToggleDark])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  return { showHelp, setShowHelp }
}

export const SHORTCUTS = [
  { key: 'R', description: 'Record Sale tab' },
  { key: 'H', description: 'History tab' },
  { key: 'S', description: 'Stock tab' },
  { key: 'A', description: 'Analytics tab' },
  { key: 'C', description: 'Credit tab' },
  { key: 'B', description: 'Leaderboard tab' },
  { key: 'D', description: 'Toggle Dark / Light mode' },
  { key: '?', description: 'Show / hide this help' },
  { key: 'Esc', description: 'Close help overlay' },
]
