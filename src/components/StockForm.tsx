import { useState, useEffect } from 'react'
import { getProductsForTenant, insertStockRecord, getStockRecordsForUser } from '@/lib/tenant-queries'
import type { Product, StockRecord } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Package, PlusCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Props {
  userId: string
  tenantId: string
  isAdmin: boolean
}

export default function StockForm({ userId, tenantId, isAdmin }: Props) {
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [records, setRecords] = useState<StockRecord[]>([])
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [stockDate, setStockDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const totalCost = Number(quantity) * Number(costPrice) || 0

  useEffect(() => {
    getProductsForTenant(tenantId).then(({ data }) => {
      if (data) setProducts(data)
    })
    getStockRecordsForUser(userId, tenantId).then(({ data }) => {
      if (data) setRecords(data as unknown as StockRecord[])
    })
  }, [userId, tenantId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const product = products.find(p => p.id === productId)
    if (!product) return
    setLoading(true)

    const recordData = {
      product_id: productId,
      item_name: product.name,
      quantity: Number(quantity),
      cost_price: Number(costPrice),
      total_cost: totalCost,
      stock_date: stockDate,
      notes: notes || null,
    }

    const { error } = await insertStockRecord(recordData, tenantId, userId)
    setLoading(false)

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Stock recorded!', description: `${product.name} — ₦${totalCost.toLocaleString()}` })
      setQuantity('')
      setCostPrice('')
      setNotes('')
      getStockRecordsForUser(userId, tenantId).then(({ data }) => {
        if (data) setRecords(data as unknown as StockRecord[])
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Package className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-bold text-foreground text-lg">Stock Management</h2>
          <p className="text-sm text-muted-foreground">Track inventory purchases</p>
        </div>
      </div>

      {isAdmin && (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Product</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" required />
                </div>
                <div className="space-y-2">
                  <Label>Cost Price (₦)</Label>
                  <Input type="number" min="0" step="0.01" value={costPrice} onChange={e => setCostPrice(e.target.value)} placeholder="0.00" required />
                </div>
              </div>

              {totalCost > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 text-center">
                  <span className="text-sm text-muted-foreground">Total Cost: </span>
                  <span className="text-xl font-bold text-primary">₦{totalCost.toLocaleString()}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={stockDate} onChange={e => setStockDate(e.target.value)} />
              </div>

              <Button type="submit" disabled={loading || !productId || !quantity} className="w-full h-11 gap-2 font-semibold">
                <PlusCircle className="w-4 h-4" />
                {loading ? 'Recording...' : 'Add Stock'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {records.length > 0 && (
        <Card className="border-border/50 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(r.stock_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </TableCell>
                    <TableCell className="font-medium text-sm">{r.item_name}</TableCell>
                    <TableCell className="text-right text-sm">{r.quantity}</TableCell>
                    <TableCell className="text-right font-semibold text-sm">₦{Number(r.total_cost).toLocaleString()}</TableCell>
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
