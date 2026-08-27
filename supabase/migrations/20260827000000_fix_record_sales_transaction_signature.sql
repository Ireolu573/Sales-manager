-- Migration: Fix record_sales_transaction signature and permissions
-- Repair migration to change 9th parameter p_transaction_id from uuid to text on remote instances.
-- PostgreSQL requires dropping the old signature before replacing parameter types.

DROP FUNCTION IF EXISTS public.record_sales_transaction(uuid, jsonb, date, text, text, text, boolean, text, uuid);
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
  p_transaction_id text DEFAULT NULL
)
RETURNS TABLE(id uuid, transaction_id text, total_amount numeric)
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
  v_transaction_id text := COALESCE(p_transaction_id, 'TXN-' || gen_random_uuid()::text);
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

    SELECT COALESCE(SUM(COALESCE(sr.base_quantity, sr.quantity, 0)), 0) INTO v_available_base
      FROM public.stock_records sr 
      WHERE (sr.tenant_id = p_tenant_id OR sr.tenant_id IS NULL)
        AND (
          sr.product_id = v_product.id 
          OR LOWER(TRIM(sr.item_name)) = LOWER(TRIM(v_product.name))
          OR sr.item_name ILIKE '%' || v_product.name || '%'
        );

    v_available_base := v_available_base - COALESCE((
      SELECT SUM(COALESCE(s.base_quantity, s.quantity, 0)) 
      FROM public.sales s 
      WHERE (s.tenant_id = p_tenant_id OR s.tenant_id IS NULL)
        AND (
          s.product_id = v_product.id 
          OR LOWER(TRIM(s.item_name)) = LOWER(TRIM(v_product.name))
          OR s.item_name ILIKE '%' || v_product.name || '%'
        )
    ), 0);

    IF v_requested_base > v_available_base AND NOT p_allow_override THEN
      RAISE EXCEPTION 'Insufficient stock for %: % base units available, % requested', v_product.name, GREATEST(v_available_base, 0), v_requested_base;
    END IF;

    SELECT COALESCE(SUM(COALESCE(sr.base_cost, sr.total_cost, 0)), 0) INTO v_available_cost
      FROM public.stock_records sr 
      WHERE (sr.tenant_id = p_tenant_id OR sr.tenant_id IS NULL)
        AND (
          sr.product_id = v_product.id 
          OR LOWER(TRIM(sr.item_name)) = LOWER(TRIM(v_product.name))
          OR sr.item_name ILIKE '%' || v_product.name || '%'
        );

    v_available_cost := v_available_cost - COALESCE((
      SELECT SUM(COALESCE(s.cogs_amount, 0)) 
      FROM public.sales s 
      WHERE (s.tenant_id = p_tenant_id OR s.tenant_id IS NULL)
        AND (
          s.product_id = v_product.id 
          OR LOWER(TRIM(s.item_name)) = LOWER(TRIM(v_product.name))
          OR s.item_name ILIKE '%' || v_product.name || '%'
        )
    ), 0);
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

REVOKE ALL ON FUNCTION public.record_sales_transaction(uuid, jsonb, date, text, text, text, boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_sales_transaction(uuid, jsonb, date, text, text, text, boolean, text, text) TO authenticated;
