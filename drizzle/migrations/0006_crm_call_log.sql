CREATE TABLE public.crm_call_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL,
  opportunity_id uuid,
  initiated_by uuid NOT NULL,
  twilio_call_sid text UNIQUE,
  dial_call_sid text,
  status text NOT NULL DEFAULT 'initiating',
  initiated_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  completed_at timestamptz,
  duration_seconds integer,
  error_code text,
  error_message text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.crm_call_log TO authenticated;
GRANT ALL ON public.crm_call_log TO service_role;
ALTER TABLE public.crm_call_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and admins read call log" ON public.crm_call_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE UNIQUE INDEX crm_call_log_one_active_per_contact ON public.crm_call_log (contact_id)
  WHERE status IN ('initiating','queued','ringing','in-progress');
CREATE INDEX crm_call_log_contact_idx ON public.crm_call_log (contact_id, initiated_at DESC);