ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS onboarding_step integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS business_category text;

-- Existing tenants already have products and staff in real use, so treat them as already onboarded.
UPDATE public.company_settings SET onboarding_complete = true, onboarding_step = 5 WHERE onboarding_complete = false;;
