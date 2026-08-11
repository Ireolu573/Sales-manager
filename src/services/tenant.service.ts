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
      .select('id, name, is_active, product_units(id, unit_label, unit_price)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name')

    if (error) throw new Error(error.message)
    return (data as Product[]) || []
  }

  static async addProduct(name: string, tenantId: string, units: { unit_label: string; unit_price: number }[]): Promise<Product> {
    const { data: product, error: prodErr } = await supabase
      .from('products')
      .insert({ name, tenant_id: tenantId, is_active: true })
      .select('id, name')
      .single()

    if (prodErr || !product) throw new Error(prodErr?.message || 'Failed to create product')

    if (units.length > 0) {
      const { error: unitErr } = await supabase.from('product_units').insert(
        units.map(u => ({
          product_id: product.id,
          unit_label: u.unit_label,
          unit_price: u.unit_price,
        }))
      )
      if (unitErr) throw new Error(unitErr.message)
    }

    return this.getProducts(tenantId).then(prods => prods.find(p => p.id === product.id)!)
  }

  static async deleteProduct(productId: string): Promise<void> {
    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', productId)

    if (error) throw new Error(error.message)
  }

  static async updateProductUnitPrices(unitPrices: { id: string; unit_price: number }[]): Promise<void> {
    for (const item of unitPrices) {
      const { error } = await supabase
        .from('product_units')
        .update({ unit_price: item.unit_price })
        .eq('id', item.id)
      if (error) throw new Error(error.message)
    }
  }
}
