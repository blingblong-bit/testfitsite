CREATE TABLE public.lead_alert_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'sending',
  to_phone text,
  twilio_sid text,
  sent_at timestamptz,
  error_message text,
  is_test boolean NOT NULL DEFAULT false,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lead_alert_log TO authenticated;
GRANT ALL ON public.lead_alert_log TO service_role;
ALTER TABLE public.lead_alert_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and admins can view lead alerts" ON public.lead_alert_log
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));