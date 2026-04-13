import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { Sale } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Trash2, Search, FileText } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Props {
  userId: string
  tenantId: string
  isAdmin: boolean
  refreshKey: number
  onDelete: () => void
}

const PAYMENT_BADGE: Record<string, string> = {
  cash: 'bg-success/10 text-success border-success/20',
  transfer: 'bg-info/10 text-info border-info/20',
  pos: 'bg-primary/10 text-primary border-primary/20',
  credit: 'bg-warning/10 text-warning border-warning/20',
}

export default function SalesTable({ userId, tenantId, isAdmin, refreshKey, onDelete }: Props) {
  const { toast } = useToast()
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    const query = isAdmin
      ? supabase.from('sales').select('*').eq('tenant_id', tenantId).order('sale_date', { ascending: false }).limit(300)
      : supabase.from('sales').select('*').eq('user_id', userId).eq('tenant_id', tenantId).order('sale_date', { ascending: false }).limit(300)

    query.then(({ data }) => {
      if (data) setSales(data as unknown as Sale[])
      setLoading(false)
    })
  }, [userId, tenantId, isAdmin, refreshKey])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this sale record?')) return
    const { error } = await supabase.from('sales').delete().eq('id', id)
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      setSales(prev => prev.filter(s => s.id !== id))
      onDelete()
      toast({ title: 'Sale deleted' })
    }
  }

  const filtered = sales.filter(s =>
    s.item_name.toLowerCase().includes(search.toLowerCase()) ||
    s.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.payment_method.includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-bold text-foreground text-lg">Sales History</h2>
          <p className="text-sm text-muted-foreground">{sales.length} records</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search sales..."
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 rounded-full border-4 border-muted animate-spin border-t-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center text-muted-foreground">
            No sales found
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(sale => (
                  <TableRow key={sale.id} className="group">
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(sale.sale_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{sale.item_name}</div>
                      {sale.customer_name && <div className="text-xs text-muted-foreground">{sale.customer_name}</div>}
                    </TableCell>
                    <TableCell className="text-right text-sm">{sale.quantity} {sale.unit_label}</TableCell>
                    <TableCell className="text-right font-semibold text-sm">₦{Number(sale.total_amount).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${PAYMENT_BADGE[sale.payment_method] || ''}`}>
                        {sale.payment_method}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(sale.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  )
}
