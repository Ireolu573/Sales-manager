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
  availableBaseQuantity: number
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
    const { data, error } = await supabase.rpc('get_inventory_summary' as never, {
      p_tenant_id: tenantId,
    } as never)

    if (error) {
      throw new Error(`Unable to load inventory summary: ${error.message}`)
    }

    if (!Array.isArray(data)) {
      throw new Error('Unable to load inventory summary: invalid response from database')
    }

    const summary: Record<string, InventorySummary> = {}

    ;(data as any[]).forEach(row => {
      const item: InventorySummary = {
        productId: row.product_id ?? null,
        itemName: String(row.item_name ?? ''),
        totalStock: Number(row.total_stock ?? 0),
        totalSold: Number(row.total_sold ?? 0),
        availableStock: Number(row.available_stock ?? 0),
        availableBaseQuantity: Number(row.available_base_quantity ?? 0),
        status: row.status as InventorySummary['status'],
      }

      if (item.productId) summary[item.productId] = item
      if (item.itemName) {
        summary[item.itemName] = item
        summary[item.itemName.trim().toLowerCase()] = item
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
