-- Migration: Add delete_sales_transaction RPC for deleting sales securely

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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_sale
  FROM public.sales
  WHERE id = p_sale_id
    AND tenant_id = public.current_tenant_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found or access denied';
  END IF;

  IF NOT public.is_tenant_admin() AND v_sale.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only an administrator or the staff member who recorded this sale can delete it';
  END IF;

  DELETE FROM public.sales
  WHERE id = p_sale_id
    AND tenant_id = public.current_tenant_id();
END;
$$;

REVOKE ALL ON FUNCTION public.delete_sales_transaction(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_sales_transaction(uuid) TO authenticated;
