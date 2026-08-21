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

export function calculateInventorySummaryFromRecords(
  stockRows: Array<{ product_id?: string | null; item_name: string; quantity?: number | null; base_quantity?: number | null }>,
  salesRows: Array<{ product_id?: string | null; item_name: string; quantity?: number | null; base_quantity?: number | null }>,
): Record<string, InventorySummary> {
  const summary: Record<string, InventorySummary> = {}
  const keyToMeta: Record<string, { productId?: string | null; itemName: string }> = {}

  const getCanonicalKey = (item: { product_id?: string | null; item_name: string }) => {
    return (item.item_name || '').trim().toLowerCase()
  }

  stockRows.forEach(item => {
    const canonicalKey = getCanonicalKey(item)
    if (!canonicalKey) return

    if (!keyToMeta[canonicalKey]) {
      keyToMeta[canonicalKey] = { productId: item.product_id, itemName: item.item_name }
    } else if (item.product_id && !keyToMeta[canonicalKey].productId) {
      keyToMeta[canonicalKey].productId = item.product_id
    }

    if (!summary[canonicalKey]) {
      summary[canonicalKey] = {
        productId: item.product_id,
        itemName: item.item_name,
        totalStock: 0,
        totalSold: 0,
        availableStock: 0,
        availableBaseQuantity: 0,
        status: 'out_of_stock',
      }
    }
    summary[canonicalKey].totalStock += Number(item.base_quantity ?? item.quantity ?? 0)
  })

  salesRows.forEach(item => {
    const canonicalKey = getCanonicalKey(item)
    if (!canonicalKey) return

    if (!summary[canonicalKey]) {
      summary[canonicalKey] = {
        productId: item.product_id,
        itemName: item.item_name,
        totalStock: 0,
        totalSold: 0,
        availableStock: 0,
        availableBaseQuantity: 0,
        status: 'out_of_stock',
      }
    }
    summary[canonicalKey].totalSold += Number(item.base_quantity ?? item.quantity ?? 0)
  })

  Object.keys(summary).forEach(key => {
    const item = summary[key]
    const rawAvailable = item.totalStock - item.totalSold
    item.availableStock = Math.max(rawAvailable, 0)
    item.availableBaseQuantity = item.availableStock

    if (item.totalStock === 0 && item.totalSold === 0) {
      item.status = 'out_of_stock'
    } else if (item.availableStock <= 0) {
      item.status = 'out_of_stock'
    } else if (item.availableStock <= 5) {
      item.status = 'low_stock'
    } else {
      item.status = 'in_stock'
    }
  })

  // Map result so lookups work by canonical key, item_name, and product_id
  const result: Record<string, InventorySummary> = {}
  Object.keys(summary).forEach(key => {
    const item = summary[key]
    const meta = keyToMeta[key]
    result[key] = item
    if (meta?.itemName) {
      result[meta.itemName] = item
    }
    if (meta?.productId) {
      result[meta.productId] = item
    }
    if (item.productId) {
      result[item.productId] = item
    }
  })

  return result
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
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_inventory_summary' as never, {
      p_tenant_id: tenantId,
    } as never)

    if (!rpcErr && Array.isArray(rpcData)) {
      const summary: Record<string, InventorySummary> = {}
      ;(rpcData as any[]).forEach(row => {
        const key = row.product_id || row.item_name
        summary[key] = {
          productId: row.product_id,
          itemName: row.item_name,
          totalStock: Number(row.total_stock || 0),
          totalSold: Number(row.total_sold || 0),
          availableStock: Number(row.available_stock || 0),
          availableBaseQuantity: Number(row.available_base_quantity || 0),
          status: row.status as 'in_stock' | 'low_stock' | 'out_of_stock',
        }
      })
      return summary
    }

    // Fallback client-side calculation if RPC is unavailable
    const [{ data: stockData, error: stockErr }, { data: salesData, error: salesErr }] = await Promise.all([
      supabase.from('stock_records').select('product_id, item_name, quantity, base_quantity').eq('tenant_id', tenantId).limit(5000),
      supabase.from('sales').select('product_id, item_name, quantity, base_quantity').eq('tenant_id', tenantId).limit(5000),
    ])

    if (stockErr) throw new Error(stockErr.message)
    if (salesErr) throw new Error(salesErr.message)

    return calculateInventorySummaryFromRecords(stockData || [], salesData || [])
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
