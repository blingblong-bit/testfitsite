alter table public.appointments drop constraint if exists appointments_type_check;
alter table public.appointments add constraint appointments_type_check check (type in ('tour','enrollment','day_pass'));

alter table public.sms_conversation_log drop constraint if exists sms_conversation_log_direction_check;
alter table public.sms_conversation_log add constraint sms_conversation_log_direction_check check (direction in ('inbound','outbound','system'));

grant execute on function public.has_role(uuid, public.app_role) to authenticated, anon, service_role;