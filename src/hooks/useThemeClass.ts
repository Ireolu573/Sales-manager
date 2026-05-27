/**
 * useThemeClass.ts
 * Returns 'dark' when the document root has the dark class,
 * and updates reactively when toggleTheme() changes it.
 *
 * Use this in any Radix UI portaled component (Dialog, Sheet,
 * Popover, DropdownMenu, Select, etc.) so the portal inherits
 * the correct CSS variable set even though Radix renders it
 * directly on <body>, outside the <html class="dark"> cascade.
 *
 * Usage:
 *   const themeClass = useThemeClass()
 *   <PopoverContent className={cn(themeClass, 'your-classes')} />
 */
import { useState, useEffect } from 'react'

export function useThemeClass(): 'dark' | '' {
  const [isDark, setIsDark] = useState<boolean>(
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  )

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => observer.disconnect()
  }, [])

  return isDark ? 'dark' : ''
}
