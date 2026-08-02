ALTER TABLE public.referrals
  ADD CONSTRAINT referrals_status_check
  CHECK (status = ANY (ARRAY['sent'::text, 'arrival_pending'::text, 'redeemed'::text]));