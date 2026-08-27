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

export interface TransactionSaleItem {
  product_id: string
  product_unit_id: string
  quantity: number
  unit_price: number
}

export interface RecordSaleTransactionDTO {
  items: TransactionSaleItem[]
  sale_date: string
  payment_method: string
  customer_name?: string | null
  notes?: string | null
  allow_override?: boolean
  override_reason?: string | null
  transaction_id?: string
}

export class SalesService {
  private static directWriteDisabledError(): Error {
    return new Error('Direct sales table writes are disabled. Use recordTransaction() with the secure sales RPC.')
  }

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
    throw this.directWriteDisabledError()
  }

  static async recordTransaction(payload: RecordSaleTransactionDTO, tenantId: string): Promise<Sale[]> {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('You must be signed in to record a sale.')
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      throw new Error(profileError.message)
    }

    if (!profile?.tenant_id) {
      throw new Error('This account is not assigned to a business yet.')
    }

    console.debug('[SalesService.recordTransaction]', {
      authUserId: user.id,
      profileTenantId: profile.tenant_id,
      currentTenantId: tenantId,
      match: profile.tenant_id === tenantId,
      payload,
    })

    if (profile.tenant_id !== tenantId) {
      throw new Error('Tenant mismatch: refresh the current business before recording a sale.')
    }

    const { data, error } = await supabase.rpc('record_sales_transaction' as never, {
      p_tenant_id: tenantId,
      p_items: payload.items,
      p_sale_date: payload.sale_date,
      p_payment_method: payload.payment_method,
      p_customer_name: payload.customer_name || null,
      p_notes: payload.notes || null,
      p_allow_override: Boolean(payload.allow_override),
      p_override_reason: payload.override_reason || null,
      p_transaction_id: payload.transaction_id || null,
    } as never)

    if (error) throw new Error(error.message)
    return (data || []) as Sale[]
  }

  static async updateSale(saleId: string, updates: Partial<Sale>): Promise<Sale> {
    throw this.directWriteDisabledError()
  }

  static async deleteSale(saleId: string): Promise<void> {
    const { error } = await supabase.rpc('delete_sales_transaction' as never, {
      p_sale_id: saleId,
    } as never)

    if (error) throw new Error(error.message)
  }

  static async markCreditAsPaid(saleId: string, paidVia: string): Promise<Sale> {
    throw this.directWriteDisabledError()
  }

  static async recordCreditPayment(saleId: string, amount: number, paidVia: string, note?: string): Promise<void> {
    const { error } = await supabase.rpc('record_credit_payment' as never, {
      p_sale_id: saleId,
      p_amount: amount,
      p_payment_method: paidVia,
      p_note: note || null,
    } as never)
    if (error) throw new Error(error.message)
  }
}
