import { ReactNode } from 'react'
import { Progress } from '@/components/ui/progress'

interface Props {
  step: number
  totalSteps: number
  title: string
  subtitle?: string
  children: ReactNode
}

export default function WizardShell({ step, totalSteps, title, subtitle, children }: Props) {
  const pct = Math.round((step / totalSteps) * 100)

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-b from-background to-muted/30">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Step {step} of {totalSteps}
            </span>
            <span className="text-xs font-semibold text-primary">{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>

        <div className="text-center mb-6 slide-up">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>}
        </div>

        {children}
      </div>
    </div>
  )
}
