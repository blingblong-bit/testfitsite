-- Allow 'system' as a direction value on sms_conversation_log, used for
-- internal diagnostic entries (e.g. Claude JSON parse failures) that
-- aren't actually inbound or outbound messages, so we have a durable,
-- queryable record independent of Edge Function log retention.
alter table public.sms_conversation_log
  drop constraint if exists sms_conversation_log_direction_check;

alter table public.sms_conversation_log
  add constraint sms_conversation_log_direction_check
  check (direction in ('inbound', 'outbound', 'system'));
