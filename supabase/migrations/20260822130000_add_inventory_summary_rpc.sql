-- Inventory summary RPC.
-- Keeps inventory display calculations aligned with record_sales_transaction.
-- PostgreSQL is the authoritative source for stock availability.

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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := public.current_tenant_id();

  IF auth.uid() IS NULL OR v_tenant_id IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'You cannot view inventory for this business';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS product_id,
    p.name AS item_name,
    COALESCE(stock.total_stock, 0) AS total_stock,
    COALESCE(sales.total_sold, 0) AS total_sold,
    GREATEST(COALESCE(stock.total_stock, 0) - COALESCE(sales.total_sold, 0), 0) AS available_stock,
    GREATEST(COALESCE(stock.total_stock, 0) - COALESCE(sales.total_sold, 0), 0) AS available_base_quantity,
    CASE
      WHEN GREATEST(COALESCE(stock.total_stock, 0) - COALESCE(sales.total_sold, 0), 0) <= 0 THEN 'out_of_stock'
      WHEN GREATEST(COALESCE(stock.total_stock, 0) - COALESCE(sales.total_sold, 0), 0) <= 5 THEN 'low_stock'
      ELSE 'in_stock'
    END AS status
  FROM public.products p
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(COALESCE(sr.base_quantity, sr.quantity, 0)), 0) AS total_stock
    FROM public.stock_records sr
    WHERE (sr.tenant_id = p_tenant_id OR sr.tenant_id IS NULL)
      AND (
        sr.product_id = p.id
        OR LOWER(TRIM(sr.item_name)) = LOWER(TRIM(p.name))
        OR sr.item_name ILIKE '%' || p.name || '%'
      )
  ) stock ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(COALESCE(s.base_quantity, s.quantity, 0)), 0) AS total_sold
    FROM public.sales s
    WHERE (s.tenant_id = p_tenant_id OR s.tenant_id IS NULL)
      AND (
        s.product_id = p.id
        OR LOWER(TRIM(s.item_name)) = LOWER(TRIM(p.name))
        OR s.item_name ILIKE '%' || p.name || '%'
      )
  ) sales ON true
  WHERE p.tenant_id = p_tenant_id
    AND p.is_active = true
  ORDER BY p.name;
END;
$$;

REVOKE ALL ON FUNCTION public.get_inventory_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_inventory_summary(uuid) TO authenticated;
