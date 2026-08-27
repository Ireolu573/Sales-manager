-- Align the production sales.transaction_id column with the application/RPC contract.
-- record_sales_transaction accepts p_transaction_id as text, and the canonical
-- sales schema stores transaction identifiers as text.

ALTER TABLE public.sales
  ALTER COLUMN transaction_id TYPE text
  USING transaction_id::text;
