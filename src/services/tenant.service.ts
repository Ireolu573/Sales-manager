import { supabase } from '@/integrations/supabase/client'
import type { CompanySettings, Product } from '@/lib/types'

export class TenantService {
  static async getCompanySettings(tenantId: string): Promise<CompanySettings | null> {
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data as CompanySettings | null
  }

  static async updateCompanySettings(tenantId: string, settings: Partial<CompanySettings>): Promise<CompanySettings> {
    const { data, error } = await supabase
      .from('company_settings')
      .update(settings)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data as CompanySettings
  }

  static async getProducts(tenantId: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, category, low_stock_threshold, is_active, product_units(id, unit_label, unit_price, base_unit_quantity)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name')

    if (error) throw new Error(error.message)
    return (data as Product[]) || []
  }

  static async addProduct(
    name: string,
    tenantId: string,
    units: { unit_label: string; unit_price: number; base_unit_quantity?: number }[],
    details: { category: string; low_stock_threshold: number; opening_stock?: { quantity: number; cost_price: number; unit_label: string; base_unit_quantity: number; stock_date: string; user_id: string } },
  ): Promise<Product> {
    const { data: product, error: prodErr } = await supabase
      .from('products')
      .insert({ name, tenant_id: tenantId, is_active: true, category: details.category, low_stock_threshold: details.low_stock_threshold })
      .select('id, name')
      .single()

    if (prodErr || !product) throw new Error(prodErr?.message || 'Failed to create product')

    try {
      const { data: createdUnits, error: unitErr } = await supabase.from('product_units').insert(
        units.map(u => ({
          product_id: product.id,
          unit_label: u.unit_label,
          unit_price: u.unit_price,
          base_unit_quantity: u.base_unit_quantity || 1,
        }))
      ).select('id')

      if (unitErr) throw new Error(unitErr.message)

      if (details.opening_stock && details.opening_stock.quantity > 0) {
        const opening = details.opening_stock
        const { error: stockErr } = await supabase.from('stock_records').insert({
          product_id: product.id,
          item_name: name,
          tenant_id: tenantId,
          user_id: opening.user_id,
          quantity: opening.quantity,
          cost_price: opening.cost_price,
          unit_label: opening.unit_label,
          stock_date: opening.stock_date,
          base_quantity: opening.quantity * opening.base_unit_quantity,
          base_cost: opening.quantity * opening.cost_price,
          notes: 'Opening stock',
        })
        if (stockErr) throw new Error(stockErr.message)
      }

      const created = await this.getProducts(tenantId)
      const saved = created.find(p => p.id === product.id)
      if (!saved) throw new Error('Product was created but could not be loaded')
      return saved
    } catch (error) {
      // Best-effort cleanup prevents a half-created catalogue item when a later step fails.
      await supabase.from('products').delete().eq('id', product.id).eq('tenant_id', tenantId)
      throw error
    }
  }

  static async deleteProduct(productId: string): Promise<void> {
    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', productId)

    if (error) throw new Error(error.message)
  }

  static async updateProductUnitPrices(unitPrices: { id: string; unit_price: number; base_unit_quantity?: number }[]): Promise<void> {
    for (const item of unitPrices) {
      const { error } = await supabase
        .from('product_units')
        .update({ unit_price: item.unit_price, ...(item.base_unit_quantity ? { base_unit_quantity: item.base_unit_quantity } : {}) } as any)
        .eq('id', item.id)
      if (error) throw new Error(error.message)
    }
  }
}
