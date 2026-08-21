-- Inventory, accounting and tenant-safety hardening.
-- Quantities are stored in the chosen display unit and also in a product base unit.

ALTER TABLE public.product_units
  ADD COLUMN IF NOT EXISTS base_unit_quantity numeric NOT NULL DEFAULT 1 CHECK (base_unit_quantity > 0);

ALTER TABLE public.stock_records
  ADD COLUMN IF NOT EXISTS base_quantity numeric,
  ADD COLUMN IF NOT EXISTS base_cost numeric;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS base_quantity numeric,
  ADD COLUMN IF NOT EXISTS cogs_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inventory_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS override_reason text;

CREATE TABLE IF NOT EXISTS public.credit_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL DEFAULT 'cash',
  note text,
  received_at timestamptz NOT NULL DEFAULT now(),
  received_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_payments_sale_id_idx ON public.credit_payments(sale_id);
CREATE INDEX IF NOT EXISTS sales_tenant_product_idx ON public.sales(tenant_id, product_id);
CREATE INDEX IF NOT EXISTS stock_records_tenant_product_idx ON public.stock_records(tenant_id, product_id);

-- Backfill legacy values. Existing records had no unit conversion so one display unit is
-- considered one base unit until the catalog is explicitly configured.
UPDATE public.stock_records SET base_quantity = quantity, base_cost = total_cost
WHERE base_quantity IS NULL;
UPDATE public.sales SET base_quantity = quantity WHERE base_quantity IS NULL;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT tenant_id FROM public.profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE(is_admin, false) FROM public.profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.create_business(
  p_name text, p_app_name text, p_brand_color text, p_logo_emoji text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_tenant_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NULLIF(trim(p_name), '') IS NULL THEN RAISE EXCEPTION 'A business name is required'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND tenant_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Your account already belongs to a business';
  END IF;
  INSERT INTO public.tenants(name, created_by) VALUES (trim(p_name), auth.uid()) RETURNING id INTO v_tenant_id;
  UPDATE public.profiles SET tenant_id = v_tenant_id, is_admin = true,
    permissions = '{"can_record_sales":true,"can_view_history":true,"can_view_stock":true,"can_add_stock":true,"can_view_analytics":true,"can_manage_credit":true}'::jsonb
    WHERE id = auth.uid();
  INSERT INTO public.company_settings(tenant_id, admin_id, company_name, app_name, brand_color, logo_emoji, onboarding_step, onboarding_complete)
    VALUES (v_tenant_id, auth.uid(), trim(p_name), COALESCE(NULLIF(trim(p_app_name), ''), 'Sales Manager'), COALESCE(NULLIF(trim(p_brand_color), ''), '#d97706'), COALESCE(NULLIF(trim(p_logo_emoji), ''), '🏢'), 2, false);
  RETURN v_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_business(p_invite_code text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_tenant_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to join a business'; END IF;
  SELECT id INTO v_tenant_id FROM public.tenants WHERE invite_code = lower(trim(p_invite_code));
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid invite code'; END IF;
  UPDATE public.profiles SET tenant_id = v_tenant_id, is_admin = false,
    permissions = '{"can_record_sales":true,"can_view_history":true,"can_view_stock":false,"can_add_stock":false,"can_view_analytics":false,"can_manage_credit":false}'::jsonb
    WHERE id = auth.uid() AND tenant_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Your account already belongs to a business'; END IF;
  RETURN v_tenant_id;
END;
$$;

-- Drop legacy text-signature overload if present from earlier dumps
DROP FUNCTION IF EXISTS public.record_sales_transaction(uuid, jsonb, date, text, text, text, boolean, text, text);

CREATE OR REPLACE FUNCTION public.record_sales_transaction(
  p_tenant_id uuid,
  p_items jsonb,
  p_sale_date date DEFAULT current_date,
  p_payment_method text DEFAULT 'cash',
  p_customer_name text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_allow_override boolean DEFAULT false,
  p_override_reason text DEFAULT NULL,
  p_transaction_id uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, transaction_id uuid, total_amount numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_item jsonb;
  v_product public.products%ROWTYPE;
  v_unit public.product_units%ROWTYPE;
  v_requested_base numeric;
  v_available_base numeric;
  v_available_cost numeric;
  v_unit_cost numeric;
  v_cogs numeric;
  v_transaction_id uuid := COALESCE(p_transaction_id, gen_random_uuid());
  v_sale_id uuid;
  v_total numeric;
BEGIN
  IF auth.uid() IS NULL OR public.current_tenant_id() IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'You cannot record sales for this business';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one sale item is required';
  END IF;
  IF p_allow_override AND (NOT public.is_tenant_admin() OR NULLIF(trim(COALESCE(p_override_reason, '')), '') IS NULL) THEN
    RAISE EXCEPTION 'Only an administrator may override inventory, with a reason';
  END IF;

  -- Stable lock order prevents concurrent sales of the same product from racing.
  PERFORM pg_advisory_xact_lock(hashtext(value->>'product_id'))
  FROM jsonb_array_elements(p_items)
  ORDER BY value->>'product_id';

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_product FROM public.products p
      WHERE p.id = (v_item->>'product_id')::uuid AND p.tenant_id = p_tenant_id AND p.is_active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product is unavailable'; END IF;

    SELECT * INTO v_unit FROM public.product_units pu
      WHERE pu.id = (v_item->>'product_unit_id')::uuid AND pu.product_id = v_product.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Selected unit does not belong to this product'; END IF;

    IF COALESCE((v_item->>'quantity')::numeric, 0) <= 0 OR COALESCE((v_item->>'unit_price')::numeric, -1) < 0 THEN
      RAISE EXCEPTION 'Quantity must be positive and price cannot be negative';
    END IF;

    v_requested_base := (v_item->>'quantity')::numeric * v_unit.base_unit_quantity;
    SELECT COALESCE(SUM(sr.base_quantity), 0) INTO v_available_base
      FROM public.stock_records sr WHERE sr.tenant_id = p_tenant_id AND sr.product_id = v_product.id;
    v_available_base := v_available_base - COALESCE((SELECT SUM(s.base_quantity) FROM public.sales s WHERE s.tenant_id = p_tenant_id AND s.product_id = v_product.id), 0);

    IF v_requested_base > v_available_base AND NOT p_allow_override THEN
      RAISE EXCEPTION 'Insufficient stock for %: % base units available, % requested', v_product.name, GREATEST(v_available_base, 0), v_requested_base;
    END IF;

    SELECT COALESCE(SUM(sr.base_cost), 0) INTO v_available_cost
      FROM public.stock_records sr WHERE sr.tenant_id = p_tenant_id AND sr.product_id = v_product.id;
    v_available_cost := v_available_cost - COALESCE((SELECT SUM(s.cogs_amount) FROM public.sales s WHERE s.tenant_id = p_tenant_id AND s.product_id = v_product.id), 0);
    v_unit_cost := CASE WHEN v_available_base > 0 THEN GREATEST(v_available_cost, 0) / v_available_base ELSE 0 END;
    v_cogs := ROUND(v_requested_base * v_unit_cost, 2);

    INSERT INTO public.sales (
      user_id, tenant_id, product_id, item_name, unit_label, quantity, unit_price,
      sale_date, payment_method, customer_name, notes, paid_at, transaction_id,
      base_quantity, cogs_amount, inventory_override, override_reason
    ) VALUES (
      auth.uid(), p_tenant_id, v_product.id, v_product.name, v_unit.unit_label,
      (v_item->>'quantity')::numeric, (v_item->>'unit_price')::numeric,
      p_sale_date, p_payment_method, p_customer_name, p_notes,
      CASE WHEN p_payment_method = 'credit' THEN NULL ELSE now() END,
      v_transaction_id, v_requested_base, v_cogs, p_allow_override,
      CASE WHEN p_allow_override THEN trim(p_override_reason) ELSE NULL END
    ) RETURNING sales.id, sales.total_amount INTO v_sale_id, v_total;

    id := v_sale_id; transaction_id := v_transaction_id; total_amount := v_total; RETURN NEXT;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_credit_payment(
  p_sale_id uuid, p_amount numeric, p_payment_method text, p_note text DEFAULT NULL
)
RETURNS public.credit_payments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_sale public.sales%ROWTYPE; v_payment public.credit_payments%ROWTYPE; v_paid numeric;
BEGIN
  SELECT * INTO v_sale FROM public.sales s WHERE s.id = p_sale_id AND s.tenant_id = public.current_tenant_id() FOR UPDATE;
  IF NOT FOUND OR NOT public.is_tenant_admin() THEN RAISE EXCEPTION 'Credit payment is not permitted'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Payment must be greater than zero'; END IF;
  SELECT COALESCE(SUM(cp.amount), 0) INTO v_paid FROM public.credit_payments cp WHERE cp.sale_id = p_sale_id;
  IF p_amount > v_sale.total_amount - v_paid THEN RAISE EXCEPTION 'Payment exceeds the outstanding balance'; END IF;
  INSERT INTO public.credit_payments(tenant_id, sale_id, amount, payment_method, note, received_by)
  VALUES (v_sale.tenant_id, p_sale_id, p_amount, p_payment_method, p_note, auth.uid()) RETURNING * INTO v_payment;
  IF v_paid + p_amount >= v_sale.total_amount THEN
    UPDATE public.sales s SET paid_at = now(), paid_via = p_payment_method WHERE s.id = p_sale_id;
  END IF;
  RETURN v_payment;
END;
$$;

-- Tenant-scoped RLS. Policies deliberately use auth identity, never request-supplied tenant ids.
ALTER TABLE public.credit_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS credit_payments_tenant_access ON public.credit_payments;
CREATE POLICY credit_payments_tenant_access ON public.credit_payments FOR SELECT
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_read_self_or_admin ON public.profiles FOR SELECT
  USING (id = auth.uid() OR (tenant_id = public.current_tenant_id() AND public.is_tenant_admin()));
CREATE POLICY profiles_block_direct_update ON public.profiles FOR UPDATE USING (false);

DROP POLICY IF EXISTS tenants_select ON public.tenants;
DROP POLICY IF EXISTS tenants_insert ON public.tenants;
DROP POLICY IF EXISTS tenants_update ON public.tenants;
CREATE POLICY tenants_read_current ON public.tenants FOR SELECT USING (id = public.current_tenant_id());
CREATE POLICY tenants_admin_update ON public.tenants FOR UPDATE
  USING (id = public.current_tenant_id() AND public.is_tenant_admin())
  WITH CHECK (id = public.current_tenant_id() AND public.is_tenant_admin());

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sales', 'stock_records', 'products', 'company_settings'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', replace(t, '_records', '') || '_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', replace(t, '_records', '') || '_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', replace(t, '_records', '') || '_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', replace(t, '_records', '') || '_delete', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_tenant_access', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id())', t || '_tenant_access', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS products_tenant_access ON public.products;
CREATE POLICY products_read_tenant ON public.products FOR SELECT USING (tenant_id = public.current_tenant_id());
CREATE POLICY products_admin_write ON public.products FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.is_tenant_admin())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_tenant_admin());

DROP POLICY IF EXISTS company_settings_tenant_access ON public.company_settings;
CREATE POLICY company_settings_read_tenant ON public.company_settings FOR SELECT USING (tenant_id = public.current_tenant_id());
CREATE POLICY company_settings_admin_write ON public.company_settings FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.is_tenant_admin())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_tenant_admin());

DROP POLICY IF EXISTS product_units_tenant_access ON public.product_units;
DROP POLICY IF EXISTS product_units_select ON public.product_units;
DROP POLICY IF EXISTS product_units_all ON public.product_units;
CREATE POLICY product_units_read_tenant ON public.product_units FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_units.product_id AND p.tenant_id = public.current_tenant_id()));
CREATE POLICY product_units_admin_write ON public.product_units FOR ALL
  USING (public.is_tenant_admin() AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_units.product_id AND p.tenant_id = public.current_tenant_id()))
  WITH CHECK (public.is_tenant_admin() AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_units.product_id AND p.tenant_id = public.current_tenant_id()));

-- Do not allow a direct client insert into sales: it would bypass the atomic
-- stock and COGS calculation above. SECURITY DEFINER RPCs bypass these policies.
DROP POLICY IF EXISTS sales_tenant_access ON public.sales;
CREATE POLICY sales_read_tenant ON public.sales FOR SELECT USING (tenant_id = public.current_tenant_id());
CREATE POLICY sales_block_direct_write ON public.sales FOR INSERT WITH CHECK (false);
CREATE POLICY sales_block_direct_update ON public.sales FOR UPDATE USING (false);
CREATE POLICY sales_block_direct_delete ON public.sales FOR DELETE USING (false);

DROP POLICY IF EXISTS stock_records_tenant_access ON public.stock_records;
CREATE POLICY stock_records_read_tenant ON public.stock_records FOR SELECT USING (tenant_id = public.current_tenant_id());
CREATE POLICY stock_records_admin_insert ON public.stock_records FOR INSERT
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_tenant_admin());
CREATE POLICY stock_records_admin_delete ON public.stock_records FOR DELETE
  USING (tenant_id = public.current_tenant_id() AND public.is_tenant_admin());

REVOKE ALL ON FUNCTION public.record_sales_transaction(uuid, jsonb, date, text, text, text, boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_sales_transaction(uuid, jsonb, date, text, text, text, boolean, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.record_credit_payment(uuid, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_credit_payment(uuid, numeric, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.create_business(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_business(text, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.join_business(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_business(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_inventory_summary(p_tenant_id uuid)
RETURNS TABLE (
  product_id uuid,
  item_name text,
  total_stock numeric,
  total_sold numeric,
  available_stock numeric,
  available_base_quantity numeric,
  status text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF auth.uid() IS NULL OR public.current_tenant_id() IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  WITH stock_totals AS (
    SELECT
      sr.product_id,
      COALESCE(SUM(sr.base_quantity), 0) AS total_stock
    FROM public.stock_records sr
    WHERE sr.tenant_id = p_tenant_id
    GROUP BY sr.product_id
  ),
  sales_totals AS (
    SELECT
      s.product_id,
      COALESCE(SUM(s.base_quantity), 0) AS total_sold
    FROM public.sales s
    WHERE s.tenant_id = p_tenant_id
    GROUP BY s.product_id
  )
  SELECT
    p.id AS product_id,
    p.name AS item_name,
    COALESCE(st.total_stock, 0)::numeric AS total_stock,
    COALESCE(sa.total_sold, 0)::numeric AS total_sold,
    GREATEST(COALESCE(st.total_stock, 0) - COALESCE(sa.total_sold, 0), 0)::numeric AS available_stock,
    GREATEST(COALESCE(st.total_stock, 0) - COALESCE(sa.total_sold, 0), 0)::numeric AS available_base_quantity,
    CASE
      WHEN COALESCE(st.total_stock, 0) = 0 AND COALESCE(sa.total_sold, 0) = 0 THEN 'out_of_stock'
      WHEN COALESCE(st.total_stock, 0) - COALESCE(sa.total_sold, 0) <= 0 THEN 'out_of_stock'
      WHEN COALESCE(st.total_stock, 0) - COALESCE(sa.total_sold, 0) <= 5 THEN 'low_stock'
      ELSE 'in_stock'
    END::text AS status
  FROM public.products p
  LEFT JOIN stock_totals st ON st.product_id = p.id
  LEFT JOIN sales_totals sa ON sa.product_id = p.id
  WHERE p.tenant_id = p_tenant_id AND p.is_active = true;
END;
$$;

REVOKE ALL ON FUNCTION public.get_inventory_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_inventory_summary(uuid) TO authenticated;
