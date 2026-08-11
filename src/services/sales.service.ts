import { supabase } from '@/integrations/supabase/client'
import type { Sale } from '@/lib/types'

export interface InsertSaleDTO {
  item_name: string
  unit_label: string
  quantity: number
  unit_price: number
  sale_date: string
  payment_method: string
  customer_name?: string | null
  notes?: string | null
  paid_at?: string | null
  paid_via?: string | null
  product_id?: string | null
}

export class SalesService {
  static async getSales(tenantId: string, userId?: string, limit = 300): Promise<Sale[]> {
    let query = supabase
      .from('sales')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('sale_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data as Sale[]) || []
  }

  static async getCreditSales(tenantId: string): Promise<Sale[]> {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('payment_method', 'credit')
      .is('paid_at', null)
      .order('sale_date', { ascending: false })

    if (error) throw new Error(error.message)
    return (data as Sale[]) || []
  }

  static async addSale(saleData: InsertSaleDTO, tenantId: string, userId: string): Promise<Sale> {
    const { data, error } = await supabase
      .from('sales')
      .insert({
        ...saleData,
        tenant_id: tenantId,
        user_id: userId,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data as Sale
  }

  static async updateSale(saleId: string, updates: Partial<Sale>): Promise<Sale> {
    const { total_amount, ...safeUpdates } = updates
    const { data, error } = await supabase
      .from('sales')
      .update(safeUpdates)
      .eq('id', saleId)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data as Sale
  }

  static async deleteSale(saleId: string): Promise<void> {
    const { error } = await supabase
      .from('sales')
      .delete()
      .eq('id', saleId)

    if (error) throw new Error(error.message)
  }

  static async markCreditAsPaid(saleId: string, paidVia: string): Promise<Sale> {
    const { data, error } = await supabase
      .from('sales')
      .update({
        paid_at: new Date().toISOString(),
        paid_via: paidVia,
      })
      .eq('id', saleId)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data as Sale
  }
}
