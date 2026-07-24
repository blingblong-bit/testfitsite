CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  requested_time timestamptz NOT NULL,
  confirmed_time timestamptz,
  suggested_time timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','alternative_suggested','declined','canceled')),
  type text NOT NULL DEFAULT 'tour' CHECK (type IN ('tour','enrollment')),
  reminders_sent jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage appointments" ON public.appointments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX appointments_status_conf_idx ON public.appointments(status, confirmed_time);
CREATE INDEX appointments_lead_idx ON public.appointments(lead_id);