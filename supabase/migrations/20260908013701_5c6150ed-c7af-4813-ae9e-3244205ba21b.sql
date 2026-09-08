ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS day_pass_purchased_at timestamptz;

COMMENT ON COLUMN public.leads.day_pass_purchased_at IS
  'Set only when this person actually paid for a day pass. NULL means prospect (asking about a day pass does not count).';

CREATE INDEX IF NOT EXISTS leads_day_pass_purchased_at_idx
  ON public.leads (day_pass_purchased_at)
  WHERE day_pass_purchased_at IS NOT NULL;