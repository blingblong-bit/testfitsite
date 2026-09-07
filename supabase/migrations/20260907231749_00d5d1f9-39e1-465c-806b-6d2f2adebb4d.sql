ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS high_intent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS high_intent_note text,
  ADD COLUMN IF NOT EXISTS high_intent_at timestamptz,
  ADD COLUMN IF NOT EXISTS high_intent_bucket text,
  ADD COLUMN IF NOT EXISTS lost_reasons text[],
  ADD COLUMN IF NOT EXISTS objections text[];