DELETE FROM public.sms_conversation_log WHERE phone = '+15005550001';
DELETE FROM public.leads WHERE phone = '+15005550001' AND source = 'missed_call';