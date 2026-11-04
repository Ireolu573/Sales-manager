-- Add the product attributes required by the AgriLedger product form.
-- Existing products remain valid: legacy rows receive a neutral category and threshold.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS low_stock_threshold numeric NOT NULL DEFAULT 5
    CHECK (low_stock_threshold >= 0);

COMMENT ON COLUMN public.products.category IS 'Inventory grouping: feeds, livestock, drugs, or other.';
COMMENT ON COLUMN public.products.low_stock_threshold IS 'Reorder alert threshold expressed in the product base unit.';
