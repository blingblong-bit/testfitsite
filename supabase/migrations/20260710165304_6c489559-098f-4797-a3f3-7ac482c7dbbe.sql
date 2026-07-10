CREATE OR REPLACE FUNCTION public.notify_new_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://pjntdyhshxwhsxnwjylk.supabase.co/functions/v1/send-initial-lead-sms',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key')
    ),
    body := jsonb_build_object('type', 'INSERT', 'record', row_to_json(NEW))
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_new_lead failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_new_lead() FROM PUBLIC, anon, authenticated;