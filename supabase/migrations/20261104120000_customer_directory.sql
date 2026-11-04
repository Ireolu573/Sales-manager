-- Tenant-scoped customer directory for saved contact and credit details.
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  phone text,
  address text,
  credit_limit numeric CHECK (credit_limit IS NULL OR credit_limit >= 0),
  allow_credit boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS customers_tenant_normalized_name_uidx
  ON public.customers (tenant_id, lower(trim(name)));
CREATE INDEX IF NOT EXISTS customers_tenant_name_idx
  ON public.customers (tenant_id, name);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customers_tenant_select ON public.customers;
DROP POLICY IF EXISTS customers_tenant_insert ON public.customers;
DROP POLICY IF EXISTS customers_tenant_update ON public.customers;
DROP POLICY IF EXISTS customers_tenant_delete ON public.customers;
CREATE POLICY customers_tenant_select ON public.customers
  FOR SELECT USING (tenant_id = public.current_tenant_id());
CREATE POLICY customers_tenant_insert ON public.customers
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY customers_tenant_update ON public.customers
  FOR UPDATE USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY customers_tenant_delete ON public.customers
  FOR DELETE USING (tenant_id = public.current_tenant_id() AND public.is_tenant_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;

-- Preserve links from sales to a saved customer without changing the secure
-- record_sales_transaction RPC signature used by existing app versions.
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS customer_id uuid
  REFERENCES public.customers(id) ON DELETE SET NULL;

INSERT INTO public.customers (tenant_id, name)
SELECT DISTINCT ON (s.tenant_id, lower(trim(s.customer_name)))
  s.tenant_id, trim(s.customer_name)
FROM public.sales s
WHERE s.tenant_id IS NOT NULL
  AND NULLIF(trim(s.customer_name), '') IS NOT NULL
ORDER BY s.tenant_id, lower(trim(s.customer_name)), s.created_at NULLS LAST
ON CONFLICT DO NOTHING;

UPDATE public.sales s
SET customer_id = c.id
FROM public.customers c
WHERE s.customer_id IS NULL
  AND s.tenant_id = c.tenant_id
  AND lower(trim(s.customer_name)) = lower(trim(c.name));

CREATE OR REPLACE FUNCTION public.link_sale_to_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = NEW.customer_id AND c.tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'Customer does not belong to this business';
    END IF;
  ELSIF NEW.tenant_id IS NOT NULL AND NULLIF(trim(NEW.customer_name), '') IS NOT NULL THEN
    SELECT c.id INTO NEW.customer_id
    FROM public.customers c
    WHERE c.tenant_id = NEW.tenant_id
      AND lower(trim(c.name)) = lower(trim(NEW.customer_name))
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_link_customer ON public.sales;
CREATE TRIGGER sales_link_customer
  BEFORE INSERT OR UPDATE OF customer_id, customer_name, tenant_id
  ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.link_sale_to_customer();

COMMENT ON TABLE public.customers IS 'Saved customer contact and credit settings, isolated by tenant.';
COMMENT ON COLUMN public.customers.credit_limit IS 'Optional maximum outstanding credit in the tenant currency; NULL means no configured limit.';


CREATE OR REPLACE FUNCTION public.set_customer_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customers_set_updated_at ON public.customers;
CREATE TRIGGER customers_set_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_customer_updated_at();
