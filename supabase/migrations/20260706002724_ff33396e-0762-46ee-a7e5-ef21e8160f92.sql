ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS sequence_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS sms_opted_out BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_sms_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.sms_conversation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  body TEXT NOT NULL,
  from_ai BOOLEAN NOT NULL DEFAULT false,
  provider_message_id TEXT,
  status TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_conversation_log TO authenticated;
GRANT ALL ON public.sms_conversation_log TO service_role;

ALTER TABLE public.sms_conversation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sms log"
  ON public.sms_conversation_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert sms log"
  ON public.sms_conversation_log FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update sms log"
  ON public.sms_conversation_log FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_sms_log_lead ON public.sms_conversation_log(lead_id);
CREATE INDEX idx_sms_log_phone ON public.sms_conversation_log(phone);

CREATE TRIGGER trg_sms_log_updated_at
  BEFORE UPDATE ON public.sms_conversation_log
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();