
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS crm_status text,
  ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS tour_scheduled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tour_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tour_date timestamptz,
  ADD COLUMN IF NOT EXISTS became_member boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS membership_start_date date;

-- Backfill: default crm_status to 'New Lead' for any existing customer lead without one
UPDATE public.leads
SET crm_status = 'New Lead'
WHERE crm_status IS NULL AND lead_type = 'customer_lead';

-- Constrain crm_status values (allow NULL for non-customer leads)
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_crm_status_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_crm_status_check
  CHECK (crm_status IS NULL OR crm_status IN (
    'New Lead','Contacted','Waiting on Response','Tour Scheduled','Tour Completed','Joined','Lost Lead'
  ));

CREATE INDEX IF NOT EXISTS leads_crm_status_idx ON public.leads(crm_status);
CREATE INDEX IF NOT EXISTS leads_last_contacted_idx ON public.leads(last_contacted_at);
