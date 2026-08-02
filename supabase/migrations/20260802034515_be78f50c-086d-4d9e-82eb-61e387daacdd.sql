ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS referrals_lead_id_idx ON public.referrals(lead_id);