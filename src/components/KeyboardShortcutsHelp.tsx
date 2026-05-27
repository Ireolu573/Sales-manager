/**
 * KeyboardShortcutsHelp.tsx
 * Modal overlay listing all keyboard shortcuts. Press ? to toggle.
 */
import { X, Keyboard } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { SHORTCUTS } from '@/hooks/useKeyboardShortcuts'

interface Props { onClose: () => void }

export default function KeyboardShortcutsHelp({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-xs shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-foreground text-sm">Keyboard Shortcuts</h3>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-5 py-3 space-y-1.5">
            {SHORTCUTS.map(s => (
              <div key={s.key} className="flex items-center justify-between gap-4 py-1">
                <span className="text-sm text-muted-foreground">{s.description}</span>
                <kbd className="text-xs font-mono font-semibold bg-muted border border-border/80 rounded px-2 py-0.5 text-foreground min-w-[28px] text-center">
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
          <div className="px-5 pb-4 pt-1">
            <p className="text-[11px] text-muted-foreground text-center">
              Shortcuts only work when not typing in a field
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
