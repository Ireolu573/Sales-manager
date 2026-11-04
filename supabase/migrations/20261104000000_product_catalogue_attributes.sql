-- Add the product attributes required by the AgriLedger product form.
-- Existing products remain valid: legacy rows receive a neutral category and threshold.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS low_stock_threshold numeric NOT NULL DEFAULT 5
    CHECK (low_stock_threshold >= 0);

COMMENT ON COLUMN public.products.category IS 'Inventory grouping: feeds, livestock, drugs, or other.';
COMMENT ON COLUMN public.products.low_stock_threshold IS 'Reorder alert threshold expressed in the product base unit.';

-- Make the configured product threshold drive the inventory status.
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
    p.id,
    p.name,
    inv.tot_stock::numeric,
    inv.tot_sold::numeric,
    GREATEST(inv.tot_stock - inv.tot_sold, 0)::numeric,
    GREATEST(inv.tot_stock - inv.tot_sold, 0)::numeric,
    CASE
      WHEN (inv.tot_stock - inv.tot_sold) <= 0 THEN 'out_of_stock'
      WHEN (inv.tot_stock - inv.tot_sold) <= p.low_stock_threshold THEN 'low_stock'
      ELSE 'in_stock'
    END::text
  FROM public.products p
  CROSS JOIN LATERAL (
    SELECT
      COALESCE((
        SELECT SUM(COALESCE(sr.base_quantity, sr.quantity, 0))
        FROM public.stock_records sr
        WHERE (sr.tenant_id = p_tenant_id OR sr.tenant_id IS NULL)
          AND (sr.product_id = p.id OR LOWER(TRIM(sr.item_name)) = LOWER(TRIM(p.name)))
      ), 0) AS tot_stock,
      COALESCE((
        SELECT SUM(COALESCE(s.base_quantity, s.quantity, 0))
        FROM public.sales s
        WHERE (s.tenant_id = p_tenant_id OR s.tenant_id IS NULL)
          AND (s.product_id = p.id OR LOWER(TRIM(s.item_name)) = LOWER(TRIM(p.name)))
      ), 0) AS tot_sold
  ) inv
  WHERE p.tenant_id = p_tenant_id AND p.is_active = true
  ORDER BY p.name;
END;
$$;

REVOKE ALL ON FUNCTION public.get_inventory_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_inventory_summary(uuid) TO authenticated;
