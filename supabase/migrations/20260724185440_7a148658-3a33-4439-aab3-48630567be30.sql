ALTER TABLE public.sms_conversation_log
  ADD COLUMN IF NOT EXISTS delivery_status TEXT,
  ADD COLUMN IF NOT EXISTS error_code TEXT;

CREATE INDEX IF NOT EXISTS idx_sms_conversation_log_provider_message_id
  ON public.sms_conversation_log(provider_message_id);