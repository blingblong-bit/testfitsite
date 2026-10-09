ALTER TABLE public.lead_alert_log ADD COLUMN submission_id text;
ALTER TABLE public.lead_alert_log ADD COLUMN alert_kind text NOT NULL DEFAULT 'new';
UPDATE public.lead_alert_log SET submission_id = 'lead:' || lead_id::text WHERE submission_id IS NULL;
ALTER TABLE public.lead_alert_log ALTER COLUMN submission_id SET NOT NULL;
ALTER TABLE public.lead_alert_log ADD CONSTRAINT lead_alert_log_submission_id_key UNIQUE (submission_id);
ALTER TABLE public.lead_alert_log DROP CONSTRAINT lead_alert_log_lead_id_key;
CREATE INDEX lead_alert_log_lead_id_idx ON public.lead_alert_log (lead_id);