CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any prior schedule with the same name so this is idempotent
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-lead-followups-every-15min') THEN
    PERFORM cron.unschedule('process-lead-followups-every-15min');
  END IF;
END $$;

SELECT cron.schedule(
  'process-lead-followups-every-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://pjntdyhshxwhsxnwjylk.supabase.co/functions/v1/process-lead-followups',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);