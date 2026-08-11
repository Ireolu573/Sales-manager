import { supabase } from '@/integrations/supabase/client'
import type { StockRecord } from '@/lib/types'

export interface InsertStockDTO {
  item_name: string
  quantity: number
  cost_price: number
  stock_date: string
  unit_label?: string
  notes?: string | null
  product_id?: string | null
}

export interface InventorySummary {
  productId?: string | null
  itemName: string
  totalStock: number
  totalSold: number
  availableStock: number
  status: 'in_stock' | 'low_stock' | 'out_of_stock'
}

export class StockService {
  static async getStockRecords(tenantId: string, userId?: string, limit = 50): Promise<StockRecord[]> {
    let query = supabase
      .from('stock_records')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('stock_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data as StockRecord[]) || []
  }

  static async getInventorySummary(tenantId: string): Promise<Record<string, InventorySummary>> {
    const [{ data: stockData, error: stockErr }, { data: salesData, error: salesErr }] = await Promise.all([
      supabase.from('stock_records').select('product_id, item_name, quantity').eq('tenant_id', tenantId),
      supabase.from('sales').select('product_id, item_name, quantity').eq('tenant_id', tenantId),
    ])

    if (stockErr) throw new Error(stockErr.message)
    if (salesErr) throw new Error(salesErr.message)

    const summary: Record<string, InventorySummary> = {}

    // Aggregate stock received
    stockData?.forEach(item => {
      const key = item.product_id || item.item_name
      if (!summary[key]) {
        summary[key] = {
          productId: item.product_id,
          itemName: item.item_name,
          totalStock: 0,
          totalSold: 0,
          availableStock: 0,
          status: 'out_of_stock',
        }
      }
      summary[key].totalStock += Number(item.quantity || 0)
    })

    // Aggregate sales made
    salesData?.forEach(item => {
      const key = item.product_id || item.item_name
      if (!summary[key]) {
        summary[key] = {
          productId: item.product_id,
          itemName: item.item_name,
          totalStock: 0,
          totalSold: 0,
          availableStock: 0,
          status: 'out_of_stock',
        }
      }
      summary[key].totalSold += Number(item.quantity || 0)
    })

    // Calculate available balance & status
    Object.values(summary).forEach(item => {
      item.availableStock = item.totalStock - item.totalSold
      if (item.totalStock === 0) {
        item.status = 'out_of_stock'
      } else if (item.availableStock <= 5) {
        item.status = item.availableStock <= 0 ? 'out_of_stock' : 'low_stock'
      } else {
        item.status = 'in_stock'
      }
    })

    return summary
  }

  static async getProductInventorySummary(tenantId: string): Promise<Record<string, InventorySummary>> {
    return this.getInventorySummary(tenantId)
  }

  static async addStockRecord(record: InsertStockDTO, tenantId: string, userId: string): Promise<StockRecord> {
    const { data, error } = await supabase
      .from('stock_records')
      .insert({
        ...record,
        tenant_id: tenantId,
        user_id: userId,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data as StockRecord
  }

  static async deleteStockRecord(recordId: string): Promise<void> {
    const { error } = await supabase
      .from('stock_records')
      .delete()
      .eq('id', recordId)

    if (error) throw new Error(error.message)
  }
}

