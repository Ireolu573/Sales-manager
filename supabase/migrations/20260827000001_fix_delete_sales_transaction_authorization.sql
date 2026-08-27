-- Fix delete_sales_transaction authorization so it does not depend solely on current_tenant_id()
-- when a user/profile mapping is stale or missing. The intended rule remains unchanged:
-- only the sale owner or the current tenant admin may delete the row.

CREATE OR REPLACE FUNCTION public.delete_sales_transaction(
  p_sale_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_sale public.sales%ROWTYPE;
  v_current_tenant_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_sale
  FROM public.sales
  WHERE id = p_sale_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found or access denied';
  END IF;

  v_current_tenant_id := public.current_tenant_id();

  IF v_sale.user_id = auth.uid() THEN
    NULL;
  ELSIF v_current_tenant_id IS NOT NULL
      AND v_sale.tenant_id = v_current_tenant_id
      AND public.is_tenant_admin() THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Sale not found or access denied';
  END IF;

  DELETE FROM public.sales
  WHERE id = p_sale_id
    AND (
      user_id = auth.uid()
      OR (tenant_id = v_current_tenant_id AND public.is_tenant_admin())
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found or access denied';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_sales_transaction(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_sales_transaction(uuid) TO authenticated;
