
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_type text NOT NULL DEFAULT 'customer_lead',
  ADD COLUMN IF NOT EXISTS lead_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS should_notify boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS spam_reason text;

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_lead_type_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_lead_type_check
  CHECK (lead_type IN ('customer_lead','vendor_solicitation','spam'));

CREATE INDEX IF NOT EXISTS leads_lead_type_idx ON public.leads(lead_type);
