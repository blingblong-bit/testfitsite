ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_contact_method TEXT,
  ADD COLUMN IF NOT EXISTS primary_goal TEXT,
  ADD COLUMN IF NOT EXISTS next_action TEXT,
  ADD COLUMN IF NOT EXISTS next_follow_up_date DATE;