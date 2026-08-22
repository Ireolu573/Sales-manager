-- Migration: Add authoritative get_inventory_summary RPC matching record_sales_transaction accounting

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
  SELECT
    p.id AS product_id,
    p.name AS item_name,
    inv.tot_stock::numeric AS total_stock,
    inv.tot_sold::numeric AS total_sold,
    GREATEST(inv.tot_stock - inv.tot_sold, 0)::numeric AS available_stock,
    GREATEST(inv.tot_stock - inv.tot_sold, 0)::numeric AS available_base_quantity,
    CASE
      WHEN (inv.tot_stock - inv.tot_sold) <= 0 THEN 'out_of_stock'
      WHEN (inv.tot_stock - inv.tot_sold) <= 5 THEN 'low_stock'
      ELSE 'in_stock'
    END::text AS status
  FROM public.products p
  CROSS JOIN LATERAL (
    SELECT
      COALESCE((
        SELECT SUM(COALESCE(sr.base_quantity, sr.quantity, 0))
        FROM public.stock_records sr
        WHERE (sr.tenant_id = p_tenant_id OR sr.tenant_id IS NULL)
          AND (
            sr.product_id = p.id 
            OR LOWER(TRIM(sr.item_name)) = LOWER(TRIM(p.name))
          )
      ), 0) AS tot_stock,
      COALESCE((
        SELECT SUM(COALESCE(s.base_quantity, s.quantity, 0))
        FROM public.sales s
        WHERE (s.tenant_id = p_tenant_id OR s.tenant_id IS NULL)
          AND (
            s.product_id = p.id 
            OR LOWER(TRIM(s.item_name)) = LOWER(TRIM(p.name))
          )
      ), 0) AS tot_sold
  ) inv
  WHERE p.tenant_id = p_tenant_id AND p.is_active = true
  ORDER BY p.name;
END;
$$;

REVOKE ALL ON FUNCTION public.get_inventory_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_inventory_summary(uuid) TO authenticated;
