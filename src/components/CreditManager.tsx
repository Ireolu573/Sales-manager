import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { getCreditSalesForTenant } from '@/lib/tenant-queries'
import type { Sale } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CreditCard, CheckCircle2, AlertCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { SkeletonRowList } from '@/components/ui/loading-skeletons'

interface Props {
  isAdmin: boolean
  userId: string
  tenantId: string
}

export default function CreditManager({ isAdmin, userId, tenantId }: Props) {
  const { toast } = useToast()
  const [credits, setCredits] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCredits = async () => {
    setLoading(true)
    const { data } = await getCreditSalesForTenant(tenantId)
    if (data) setCredits(data as unknown as Sale[])
    setLoading(false)
  }

  useEffect(() => {
    fetchCredits()
  }, [tenantId])

  const handleSettle = async (saleId: string) => {
    const { error } = await supabase
      .from('sales')
      .update({ paid_at: new Date().toISOString() })
      .eq('id', saleId)

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Credit settled!' })
      fetchCredits()
    }
  }

  const totalOutstanding = credits.reduce((sum, s) => sum + Number(s.total_amount), 0)

  const byCustomer: Record<string, Sale[]> = {}
  credits.forEach(c => {
    const name = c.customer_name || 'Unknown'
    if (!byCustomer[name]) byCustomer[name] = []
    byCustomer[name].push(c)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-warning" />
        </div>
        <div>
          <h2 className="font-bold text-foreground text-lg">Credit Manager</h2>
          <p className="text-sm text-muted-foreground">Track outstanding payments</p>
        </div>
      </div>

      <Card className="border-warning/20 bg-warning/5 shadow-sm">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total Outstanding</p>
            <p className="text-2xl font-bold text-warning">₦{totalOutstanding.toLocaleString()}</p>
          </div>
          <AlertCircle className="w-8 h-8 text-warning/40" />
        </CardContent>
      </Card>

      {loading ? (
        <SkeletonRowList count={3} />
      ) : credits.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center text-muted-foreground">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-success/40" />
            No outstanding credits
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {Object.entries(byCustomer).map(([customer, customerCredits]) => {
            const customerTotal = customerCredits.reduce((sum, s) => sum + Number(s.total_amount), 0)
            return (
              <Card key={customer} className="border-border/50 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-foreground">{customer}</h3>
                    <span className="text-sm font-bold text-warning">₦{customerTotal.toLocaleString()}</span>
                  </div>
                  <div className="space-y-2">
                    {customerCredits.map(credit => (
                      <div key={credit.id} className="flex items-center justify-between py-2 border-t border-border/50">
                        <div>
                          <p className="text-sm font-medium">{credit.item_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(credit.sale_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {' · '}{credit.quantity} {credit.unit_label}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">₦{Number(credit.total_amount).toLocaleString()}</span>
                          {isAdmin && (
                            <Button size="sm" variant="outline" onClick={() => handleSettle(credit.id)} className="h-7 text-xs gap-1 border-success/30 text-success hover:bg-success/10">
                              <CheckCircle2 className="w-3 h-3" /> Settle
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
