
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS referrer_email TEXT,
  ADD COLUMN IF NOT EXISTS friend_email TEXT,
  ADD COLUMN IF NOT EXISTS normalized_referrer_email TEXT,
  ADD COLUMN IF NOT EXISTS email_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

-- Backfill from legacy *_contact columns where they look like emails
UPDATE public.referrals
SET referrer_email = COALESCE(referrer_email, CASE WHEN referrer_contact LIKE '%@%' THEN referrer_contact END),
    friend_email   = COALESCE(friend_email,   CASE WHEN friend_contact LIKE '%@%' THEN friend_contact END)
WHERE referrer_email IS NULL OR friend_email IS NULL;

UPDATE public.referrals
SET normalized_referrer_email = lower(btrim(referrer_email))
WHERE referrer_email IS NOT NULL AND normalized_referrer_email IS NULL;

-- Relax legacy NOT NULL on contact columns so new email-only inserts work
ALTER TABLE public.referrals ALTER COLUMN referrer_contact DROP NOT NULL;
ALTER TABLE public.referrals ALTER COLUMN friend_contact   DROP NOT NULL;

CREATE INDEX IF NOT EXISTS referrals_normalized_referrer_email_idx
  ON public.referrals (normalized_referrer_email);
