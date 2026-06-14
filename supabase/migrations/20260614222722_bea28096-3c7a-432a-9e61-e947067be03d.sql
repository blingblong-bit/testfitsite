CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code text NOT NULL UNIQUE,
  referrer_name text NOT NULL,
  referrer_contact text NOT NULL,
  friend_name text NOT NULL,
  friend_contact text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  redeemed_at timestamptz,
  redeemed_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view referrals" ON public.referrals
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'staff'::public.app_role));

CREATE POLICY "Staff can insert referrals" ON public.referrals
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'staff'::public.app_role));

CREATE POLICY "Staff can update referrals" ON public.referrals
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'staff'::public.app_role));

CREATE INDEX referrals_friend_contact_idx ON public.referrals (lower(friend_contact));
CREATE INDEX referrals_code_idx ON public.referrals (referral_code);