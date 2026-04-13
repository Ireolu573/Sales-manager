import { supabase } from '@/integrations/supabase/client'

export async function getCurrentTenant() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  return profile?.tenant_id
}

export async function getProductsForTenant(tenantId: string) {
  return supabase
    .from('products')
    .select('id, name, product_units(id, unit_label, unit_price), is_active')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name')
}

export async function getSalesForUser(userId: string, tenantId: string) {
  return supabase
    .from('sales')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .order('sale_date', { ascending: false })
    .limit(300)
}

export async function getStockRecordsForUser(userId: string, tenantId: string) {
  return supabase
    .from('stock_records')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .order('stock_date', { ascending: false })
    .limit(30)
}

export async function getProfileWithTenant(userId: string) {
  return supabase
    .from('profiles')
    .select('id, email, is_admin, permissions, tenant_id')
    .eq('id', userId)
    .single()
}

export async function insertSale(saleData: Record<string, unknown>, tenantId: string, userId: string) {
  return supabase
    .from('sales')
    .insert({ ...saleData, tenant_id: tenantId, user_id: userId } as any)
}

export async function insertStockRecord(recordData: Record<string, unknown>, tenantId: string, userId: string) {
  return supabase
    .from('stock_records')
    .insert({ ...recordData, tenant_id: tenantId, user_id: userId } as any)
}

export async function getCreditSalesForTenant(tenantId: string) {
  return supabase
    .from('sales')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('payment_method', 'credit')
    .is('paid_at', null)
    .order('sale_date', { ascending: false })
}

export async function getCompanySettingsForTenant(tenantId: string) {
  return supabase
    .from('company_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()
}
