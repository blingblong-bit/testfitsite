ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS referrer_reward_status text,
  ADD COLUMN IF NOT EXISTS is_self_referral boolean NOT NULL DEFAULT false;