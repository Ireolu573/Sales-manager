import { useState, useEffect } from 'react'
import { getExpensesForTenant, insertExpense } from '@/lib/tenant-queries'
import { supabase } from '@/integrations/supabase/client'
import type { Expense } from '@/lib/types'
import { EXPENSE_CATEGORIES } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Receipt, PlusCircle, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { SkeletonRowList } from '@/components/ui/loading-skeletons'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface Props {
  userId: string
  tenantId: string
  isAdmin: boolean
}

export default function ExpenseForm({ userId, tenantId, isAdmin }: Props) {
  const { toast } = useToast()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expensesLoading, setExpensesLoading] = useState(true)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const fetchExpenses = () => {
    setExpensesLoading(true)
    getExpensesForTenant(tenantId).then(({ data }) => {
      if (data) setExpenses(data as unknown as Expense[])
      setExpensesLoading(false)
    })
  }

  useEffect(() => { fetchExpenses() }, [tenantId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!category || !amount) return
    setLoading(true)

    const { error } = await insertExpense({
      category,
      description: description || null,
      amount: Number(amount),
      expense_date: expenseDate,
    }, tenantId, userId)

    setLoading(false)

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Expense logged!', description: `${category} — ₦${Number(amount).toLocaleString()}` })
      setCategory(''); setAmount(''); setDescription('')
      fetchExpenses()
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    setDeletingId(null)
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      setExpenses(prev => prev.filter(e => e.id !== id))
      toast({ title: 'Expense deleted' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Receipt className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-bold text-foreground text-lg">Expenses</h2>
          <p className="text-sm text-muted-foreground">Track rent, transport, salaries and more</p>
        </div>
      </div>

      {isAdmin && (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount (₦)</Label>
                  <Input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Note <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. April shop rent" />
              </div>

              <Button type="submit" disabled={loading || !category || !amount} className="w-full h-11 gap-2 font-semibold">
                <PlusCircle className="w-4 h-4" />
                {loading ? 'Logging...' : 'Log Expense'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {expensesLoading ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Recent Expenses</p>
          <SkeletonRowList count={3} />
        </div>
      ) : expenses.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Recent Expenses</p>
          {expenses.map(exp => (
            <Card key={exp.id} className="border-border/50 shadow-sm">
              <CardContent className="p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Receipt className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-foreground truncate">{exp.category}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {new Date(exp.expense_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      {exp.description && <div className="text-xs text-muted-foreground/70 mt-0.5 truncate">{exp.description}</div>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="font-bold text-sm text-foreground">₦{Number(exp.amount).toLocaleString()}</div>
                    {isAdmin && (
                      <button
                        onClick={() => setConfirmDeleteId(exp.id)}
                        disabled={deletingId === exp.id}
                        className="text-destructive/60 hover:text-destructive transition-colors p-1 rounded-lg hover:bg-destructive/10 disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!expensesLoading && expenses.length === 0 && !isAdmin && (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center text-muted-foreground text-sm">No expenses logged yet</CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete this expense?"
        description="This removes the expense entry permanently. This can't be undone."
        confirmLabel="Delete expense"
        onConfirm={() => { if (confirmDeleteId) handleDelete(confirmDeleteId); setConfirmDeleteId(null) }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}
