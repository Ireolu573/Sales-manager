export type Tab = 'record' | 'history' | 'stock' | 'credit' | 'analytics' | 'leaderboard'
export type PaymentMethod = 'cash' | 'transfer' | 'credit' | 'pos'

export interface Permissions {
  can_record_sales: boolean
  can_view_history: boolean
  can_view_stock: boolean
  can_add_stock: boolean
  can_view_analytics: boolean
  can_manage_credit: boolean
}

export interface CompanySettings {
  admin_id: string
  company_name: string
  app_name: string
  brand_color: string
  logo_emoji: string
  onboarding_step?: number
  onboarding_complete?: boolean
  business_category?: string | null
}

export interface ProductUnit {
  id: string
  unit_label: string
  unit_price: number
}

export interface Product {
  id: string
  name: string
  product_units: ProductUnit[]
  is_active?: boolean
}

export interface Sale {
  id: string
  item_name: string
  unit_label: string
  quantity: number
  unit_price: number
  total_amount: number
  sale_date: string
  payment_method: string
  customer_name: string | null
  paid_at: string | null
  notes: string | null
  user_id?: string
  tenant_id?: string
  created_at?: string
}

export interface StockRecord {
  id: string
  item_name: string
  quantity: number
  cost_price: number
  total_cost: number
  stock_date: string
  user_id?: string
  tenant_id?: string
  notes?: string
}

export const DEFAULT_PERMS: Permissions = {
  can_record_sales: true,
  can_view_history: true,
  can_view_stock: true,
  can_add_stock: false,
  can_view_analytics: false,
  can_manage_credit: false,
}

export const ADMIN_PERMS: Permissions = {
  can_record_sales: true,
  can_view_history: true,
  can_view_stock: true,
  can_add_stock: true,
  can_view_analytics: true,
  can_manage_credit: true,
}

export const DEFAULT_COMPANY: CompanySettings = {
  admin_id: '',
  company_name: 'My Business',
  app_name: 'Sales Manager',
  brand_color: '#d97706',
  logo_emoji: '🏢',
  onboarding_step: 1,
  onboarding_complete: false,
  business_category: null,
}
