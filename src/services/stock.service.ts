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

  const getCanonicalKey = (item: { product_id?: string | null; item_name: string }) =>
    (item.item_name || '').trim().toLowerCase()

  stockRows.forEach(item => {
    const canonicalKey = getCanonicalKey(item)
    if (!canonicalKey) return
    if (!keyToMeta[canonicalKey]) keyToMeta[canonicalKey] = { productId: item.product_id, itemName: item.item_name }
    else if (item.product_id && !keyToMeta[canonicalKey].productId) keyToMeta[canonicalKey].productId = item.product_id

    if (!summary[canonicalKey]) {
      summary[canonicalKey] = { productId: item.product_id, itemName: item.item_name, totalStock: 0, totalSold: 0, availableStock: 0, availableBaseQuantity: 0, status: 'out_of_stock' }
    }
    summary[canonicalKey].totalStock += Number(item.base_quantity ?? item.quantity ?? 0)
  })

  salesRows.forEach(item => {
    const canonicalKey = getCanonicalKey(item)
    if (!canonicalKey) return
    if (!summary[canonicalKey]) {
      summary[canonicalKey] = { productId: item.product_id, itemName: item.item_name, totalStock: 0, totalSold: 0, availableStock: 0, availableBaseQuantity: 0, status: 'out_of_stock' }
    }
    summary[canonicalKey].totalSold += Number(item.base_quantity ?? item.quantity ?? 0)
  })

  Object.values(summary).forEach(item => {
    item.availableStock = Math.max(item.totalStock - item.totalSold, 0)
    item.availableBaseQuantity = item.availableStock
    if (item.availableStock <= 0) item.status = 'out_of_stock'
    else if (item.availableStock <= 5) item.status = 'low_stock'
    else item.status = 'in_stock'
  })

  const result: Record<string, InventorySummary> = {}
  Object.keys(summary).forEach(key => {
    const item = summary[key]
    const meta = keyToMeta[key]
    result[key] = item
    if (meta?.itemName) result[meta.itemName] = item
    if (meta?.productId) result[meta.productId] = item
    if (item.productId) result[item.productId] = item
  })
  return result
}

export class StockService {
  static async getStockRecords(tenantId: string, userId?: string, limit = 50): Promise<StockRecord[]> {
    let query = supabase.from('stock_records').select('*').eq('tenant_id', tenantId).order('stock_date', { ascending: false }).order('created_at', { ascending: false }).limit(limit)
    if (userId) query = query.eq('user_id', userId)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data as StockRecord[]) || []
  }

  static async getInventorySummary(tenantId: string): Promise<Record<string, InventorySummary>> {
    const { data, error } = await supabase.rpc('get_inventory_summary' as never, { p_tenant_id: tenantId } as never)
    if (error) throw new Error(`Unable to load inventory summary: ${error.message}`)
    if (!Array.isArray(data)) throw new Error('Unable to load inventory summary: invalid response from database')

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
    const { data, error } = await supabase.from('stock_records').insert({ ...record, tenant_id: tenantId, user_id: userId }).select().single()
    if (error) throw new Error(error.message)
    return data as StockRecord
  }

  static async deleteStockRecord(recordId: string): Promise<void> {
    const { error } = await supabase.from('stock_records').delete().eq('id', recordId)
    if (error) throw new Error(error.message)
  }
}
