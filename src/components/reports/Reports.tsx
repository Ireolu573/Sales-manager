import { useState } from 'react'
import { Receipt, TrendingUp, BookOpen } from 'lucide-react'
import ExpenseForm from '@/components/ExpenseForm'
import ProfitLossReport from './ProfitLossReport'
import Ledger from './Ledger'

interface Props {
  userId: string
  tenantId: string
  isAdmin: boolean
}

type ReportView = 'pl' | 'ledger' | 'expenses'

export default function Reports({ userId, tenantId, isAdmin }: Props) {
  const [view, setView] = useState<ReportView>('pl')

  const views: { id: ReportView; label: string; icon: typeof Receipt }[] = [
    { id: 'pl', label: 'Profit & Loss', icon: TrendingUp },
    { id: 'ledger', label: 'Ledger', icon: BookOpen },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
  ]

  return (
    <div className="space-y-5">
      <div className="flex bg-muted rounded-lg p-0.5 w-fit">
        {views.map(v => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-all ${
              view === v.id ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'
            }`}
          >
            <v.icon className="w-3.5 h-3.5" />
            {v.label}
          </button>
        ))}
      </div>

      {view === 'pl' && <ProfitLossReport tenantId={tenantId} />}
      {view === 'ledger' && <Ledger tenantId={tenantId} />}
      {view === 'expenses' && <ExpenseForm userId={userId} tenantId={tenantId} isAdmin={isAdmin} />}
    </div>
  )
}
