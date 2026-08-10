-- Supabase Local Schema Setup for Sales Manager

-- 1. Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email text,
  is_admin boolean DEFAULT false,
  permissions jsonb DEFAULT '{"can_record_sales":true,"can_view_history":true,"can_view_stock":true,"can_add_stock":false,"can_view_analytics":false,"can_manage_credit":false}'::jsonb,
  created_at timestamptz DEFAULT now(),
  tenant_id uuid
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

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
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Tenants table
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  plan text DEFAULT 'free',
  monthly_sales_limit integer DEFAULT 50,
  created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  invite_code text UNIQUE
);
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenants_select" ON tenants;
DROP POLICY IF EXISTS "tenants_insert" ON tenants;
DROP POLICY IF EXISTS "tenants_update" ON tenants;
CREATE POLICY "tenants_select" ON tenants FOR SELECT
  USING (created_by = auth.uid() OR id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "tenants_insert" ON tenants FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "tenants_update" ON tenants FOR UPDATE
  USING (id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Add FK from profiles to tenants
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_tenant_id_fkey;
ALTER TABLE profiles ADD CONSTRAINT profiles_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- 3. Products table
CREATE TABLE IF NOT EXISTS public.products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  unit_label text DEFAULT 'unit',
  unit_price numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "products_select" ON products;
DROP POLICY IF EXISTS "products_insert" ON products;
DROP POLICY IF EXISTS "products_update" ON products;
DROP POLICY IF EXISTS "products_delete" ON products;
CREATE POLICY "products_select" ON products FOR SELECT USING (true);
CREATE POLICY "products_insert" ON products FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "products_update" ON products FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "products_delete" ON products FOR DELETE USING (auth.role() = 'authenticated');

-- 4. Product units
CREATE TABLE IF NOT EXISTS public.product_units (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  unit_label text NOT NULL,
  unit_price numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE product_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_units_select" ON product_units;
DROP POLICY IF EXISTS "product_units_all" ON product_units;
CREATE POLICY "product_units_select" ON product_units FOR SELECT USING (true);
CREATE POLICY "product_units_all" ON product_units FOR ALL USING (auth.role() = 'authenticated');

-- 5. Sales table
CREATE TABLE IF NOT EXISTS public.sales (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
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
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE
);
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sales_select" ON sales;
DROP POLICY IF EXISTS "sales_insert" ON sales;
DROP POLICY IF EXISTS "sales_update" ON sales;
DROP POLICY IF EXISTS "sales_delete" ON sales;
CREATE POLICY "sales_select" ON sales FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "sales_insert" ON sales FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sales_update" ON sales FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "sales_delete" ON sales FOR DELETE USING (auth.uid() = user_id);

-- 6. Stock records
CREATE TABLE IF NOT EXISTS public.stock_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  quantity numeric NOT NULL,
  cost_price numeric NOT NULL,
  total_cost numeric GENERATED ALWAYS AS (quantity * cost_price) STORED,
  stock_date date DEFAULT CURRENT_DATE,
  notes text,
  unit_label text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE
);
ALTER TABLE stock_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stock_select" ON stock_records;
DROP POLICY IF EXISTS "stock_insert" ON stock_records;
DROP POLICY IF EXISTS "stock_delete" ON stock_records;
CREATE POLICY "stock_select" ON stock_records FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "stock_insert" ON stock_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "stock_delete" ON stock_records FOR DELETE USING (auth.uid() = user_id);

-- 7. Company settings
CREATE TABLE IF NOT EXISTS public.company_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid REFERENCES auth.users(id),
  company_name text NOT NULL DEFAULT 'My Business',
  app_name text NOT NULL DEFAULT 'Sales Manager',
  brand_color text NOT NULL DEFAULT '#d97706',
  logo_emoji text NOT NULL DEFAULT '🏢',
  onboarding_step integer NOT NULL DEFAULT 1,
  onboarding_complete boolean NOT NULL DEFAULT false,
  business_category text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE
);
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_settings_select" ON company_settings;
DROP POLICY IF EXISTS "company_settings_insert" ON company_settings;
DROP POLICY IF EXISTS "company_settings_update" ON company_settings;
CREATE POLICY "company_settings_select" ON company_settings FOR SELECT USING (true);
CREATE POLICY "company_settings_insert" ON company_settings FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "company_settings_update" ON company_settings FOR UPDATE USING (auth.role() = 'authenticated');

-- 8. Grant schema & table permissions to Supabase roles
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
