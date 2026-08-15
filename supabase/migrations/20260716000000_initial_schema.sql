-- Initial Schema setup for Sales Manager database

-- 1. Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  email text,
  is_admin boolean DEFAULT false,
  permissions jsonb DEFAULT '{"can_record_sales":true,"can_view_history":true,"can_view_stock":true,"can_add_stock":false,"can_view_analytics":false,"can_manage_credit":false}'::jsonb,
  created_at timestamptz DEFAULT now(),
  tenant_id uuid,
  clerk_user_id text
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (true);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Tenants table
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  plan text DEFAULT 'free',
  monthly_sales_limit integer DEFAULT 50,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  invite_code text UNIQUE,
  clerk_org_id text,
  created_by_clerk_user_id text
);
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenants_select" ON public.tenants;
DROP POLICY IF EXISTS "tenants_insert" ON public.tenants;
DROP POLICY IF EXISTS "tenants_update" ON public.tenants;
CREATE POLICY "tenants_select" ON public.tenants FOR SELECT USING (true);
CREATE POLICY "tenants_insert" ON public.tenants FOR INSERT WITH CHECK (true);
CREATE POLICY "tenants_update" ON public.tenants FOR UPDATE USING (true);

-- Add FK from profiles to tenants
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_tenant_id_fkey;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- 3. Company settings table
CREATE TABLE IF NOT EXISTS public.company_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid,
  company_name text NOT NULL DEFAULT 'My Business',
  app_name text NOT NULL DEFAULT 'Sales Manager',
  brand_color text NOT NULL DEFAULT '#d97706',
  logo_emoji text NOT NULL DEFAULT '🏢',
  onboarding_step integer NOT NULL DEFAULT 1,
  onboarding_complete boolean NOT NULL DEFAULT false,
  business_category text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  admin_clerk_user_id text
);
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_settings_select" ON public.company_settings;
DROP POLICY IF EXISTS "company_settings_insert" ON public.company_settings;
DROP POLICY IF EXISTS "company_settings_update" ON public.company_settings;
CREATE POLICY "company_settings_select" ON public.company_settings FOR SELECT USING (true);
CREATE POLICY "company_settings_insert" ON public.company_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "company_settings_update" ON public.company_settings FOR UPDATE USING (true);

-- 4. Products table
CREATE TABLE IF NOT EXISTS public.products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  unit_label text DEFAULT 'unit',
  unit_price numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "products_select" ON public.products;
DROP POLICY IF EXISTS "products_insert" ON public.products;
DROP POLICY IF EXISTS "products_update" ON public.products;
DROP POLICY IF EXISTS "products_delete" ON public.products;
CREATE POLICY "products_select" ON public.products FOR SELECT USING (true);
CREATE POLICY "products_insert" ON public.products FOR INSERT WITH CHECK (true);
CREATE POLICY "products_update" ON public.products FOR UPDATE USING (true);
CREATE POLICY "products_delete" ON public.products FOR DELETE USING (true);

-- 5. Product units table
CREATE TABLE IF NOT EXISTS public.product_units (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  unit_label text NOT NULL,
  unit_price numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.product_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_units_select" ON public.product_units;
DROP POLICY IF EXISTS "product_units_all" ON public.product_units;
CREATE POLICY "product_units_select" ON public.product_units FOR SELECT USING (true);
CREATE POLICY "product_units_all" ON public.product_units FOR ALL USING (true);

-- 6. Sales table
CREATE TABLE IF NOT EXISTS public.sales (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  unit_label text DEFAULT 'unit',
  quantity numeric NOT NULL,
  unit_price numeric NOT NULL,
  total_amount numeric GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sale_date date DEFAULT CURRENT_DATE,
  payment_method text DEFAULT 'cash',
  customer_name text,
  notes text,
  paid_at timestamptz,
  paid_via text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  transaction_id text,
  clerk_user_id text
);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sales_select" ON public.sales;
DROP POLICY IF EXISTS "sales_insert" ON public.sales;
DROP POLICY IF EXISTS "sales_update" ON public.sales;
DROP POLICY IF EXISTS "sales_delete" ON public.sales;
CREATE POLICY "sales_select" ON public.sales FOR SELECT USING (true);
CREATE POLICY "sales_insert" ON public.sales FOR INSERT WITH CHECK (true);
CREATE POLICY "sales_update" ON public.sales FOR UPDATE USING (true);
CREATE POLICY "sales_delete" ON public.sales FOR DELETE USING (true);

-- 7. Stock records table
CREATE TABLE IF NOT EXISTS public.stock_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  quantity numeric NOT NULL,
  cost_price numeric NOT NULL,
  total_cost numeric GENERATED ALWAYS AS (quantity * cost_price) STORED,
  stock_date date DEFAULT CURRENT_DATE,
  notes text,
  unit_label text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  clerk_user_id text
);
ALTER TABLE public.stock_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stock_select" ON public.stock_records;
DROP POLICY IF EXISTS "stock_insert" ON public.stock_records;
DROP POLICY IF EXISTS "stock_delete" ON public.stock_records;
CREATE POLICY "stock_select" ON public.stock_records FOR SELECT USING (true);
CREATE POLICY "stock_insert" ON public.stock_records FOR INSERT WITH CHECK (true);
CREATE POLICY "stock_delete" ON public.stock_records FOR DELETE USING (true);

-- Grant privileges
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role;
