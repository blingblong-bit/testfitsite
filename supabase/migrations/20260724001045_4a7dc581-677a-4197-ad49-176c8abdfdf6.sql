CREATE TABLE public.day_pass_pending_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'paid_at_desk',
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  lead_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.day_pass_pending_checkins TO authenticated;
GRANT ALL ON public.day_pass_pending_checkins TO service_role;

ALTER TABLE public.day_pass_pending_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view pending day pass checkins"
  ON public.day_pass_pending_checkins FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update pending day pass checkins"
  ON public.day_pass_pending_checkins FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_day_pass_pending_status_requested
  ON public.day_pass_pending_checkins (status, requested_at DESC);

CREATE TRIGGER trg_day_pass_pending_updated_at
  BEFORE UPDATE ON public.day_pass_pending_checkins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();