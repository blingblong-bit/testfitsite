CREATE TABLE public.sms_consent_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  consent BOOLEAN NOT NULL DEFAULT true,
  consent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  consent_source TEXT NOT NULL DEFAULT 'website_sms_consent',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX sms_consent_records_phone_idx ON public.sms_consent_records (phone);

GRANT SELECT ON public.sms_consent_records TO authenticated;
GRANT ALL ON public.sms_consent_records TO service_role;

ALTER TABLE public.sms_consent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff and admins can view consent records"
ON public.sms_consent_records
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));