# Sales Manager — Complete Setup Guide

A multi-tenant sales management web app. Businesses can record sales, track stock, manage credit, and view analytics.

---

## Tech Stack
- React + TypeScript + Vite
- Tailwind CSS + Shadcn/ui
- Supabase (Auth + Database)
- React Router + React Query

---

## Step 1 — Database Setup (Supabase)

Go to your Supabase project → SQL Editor and run this:

```sql
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
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  invite_code text UNIQUE
);
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenants_select" ON tenants FOR SELECT
  USING (id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "tenants_insert" ON tenants FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "tenants_update" ON tenants FOR UPDATE
  USING (id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Add FK from profiles to tenants
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
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE
);
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_settings_select" ON company_settings FOR SELECT USING (true);
CREATE POLICY "company_settings_insert" ON company_settings FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "company_settings_update" ON company_settings FOR UPDATE USING (auth.role() = 'authenticated');
```

---

## Step 2 — Edge Function (Delete User)

Go to **Supabase → Edge Functions → New Function**, name it `delete-user`, paste:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })
  }
  try {
    const body = await req.text()
    if (!body) return new Response(JSON.stringify({ error: 'Empty body' }), { status: 400 })
    const { userId } = JSON.parse(body)
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    const { data: profile } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403 })
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 })
    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
```

Click **Deploy**.

---

## Step 3 — Google OAuth Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create OAuth credentials (Web application)
3. Add redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
4. Go to **Supabase → Authentication → Providers → Google**
5. Add your Client ID and Client Secret
6. Go to **Supabase → Authentication → URL Configuration**
   - Site URL: `https://your-app.vercel.app`
   - Redirect URLs: `https://your-app.vercel.app`

---

## Step 4 — Local Development

```bash
# 1. Clone or copy this folder
cd your-project-folder

# 2. Install dependencies
npm install

# 3. Create .env file
cp .env.example .env
# Edit .env with your Supabase URL and anon key

# 4. Run locally
npm run dev
# Opens at http://localhost:8080
```

---

## Step 5 — Deploy to Vercel

```bash
# 1. Push to GitHub
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR-USERNAME/your-repo.git
git push -u origin main

# 2. Go to vercel.com → Import your GitHub repo
# 3. Add environment variables:
#    VITE_SUPABASE_URL = your supabase url
#    VITE_SUPABASE_ANON_KEY = your anon key
# 4. Deploy!
```

---

## Step 6 — First Time Setup in App

1. Sign up with your email or Google
2. You'll see a "Create Business" screen — fill in your business name
3. You'll be made admin automatically
4. Go to Settings (gear icon) → Products → Add your products
5. Share the invite code with staff so they can join

---

## Features

| Feature | Admin | Staff |
|---------|-------|-------|
| Record Sales | ✅ | ✅ |
| View History | ✅ All | ✅ Own only |
| Manage Stock | ✅ | ❌ |
| Analytics + CSV Export | ✅ | ❌ |
| Credit Management | ✅ | ❌ |
| Settings / Products | ✅ | ❌ |
| Delete Users | ✅ | ❌ |
| Customer Autocomplete | ✅ | ✅ |
| WhatsApp Receipt | ✅ | ✅ |

---

## Project Structure

```
src/
├── components/
│   ├── ui/                    ← Shadcn UI components
│   ├── AuthPage.tsx           ← Login/signup + Google OAuth
│   ├── BusinessRegistration.tsx ← Create or join a business
│   ├── SaleForm.tsx           ← Record sales + customer book + WhatsApp receipt
│   ├── SalesTable.tsx         ← Sales history with search
│   ├── StockForm.tsx          ← Stock management
│   ├── Analytics.tsx          ← Charts + CSV export
│   ├── CreditManager.tsx      ← Outstanding credit tracking
│   └── DomainController.tsx   ← Admin settings panel
├── hooks/
│   └── useAuth.tsx            ← Auth context (user, tenant, permissions)
├── lib/
│   ├── types.ts               ← TypeScript interfaces
│   ├── tenant-queries.ts      ← Database query helpers
│   └── utils.ts               ← Utility functions
├── integrations/supabase/
│   └── client.ts              ← Supabase client
└── pages/
    └── Dashboard.tsx          ← Main app layout
```
#   S a l e s - m a n a g e r  
 