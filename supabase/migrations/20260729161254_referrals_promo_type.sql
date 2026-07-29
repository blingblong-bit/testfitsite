-- Support a second referral promo type ("free_week") alongside the
-- existing day-pass referrals, with a redemption access window.
alter table public.referrals
  add column if not exists promo_type text not null default 'day_pass'
    check (promo_type in ('day_pass', 'free_week')),
  add column if not exists access_starts_at timestamptz,
  add column if not exists access_ends_at timestamptz;

create index if not exists referrals_promo_type_idx on public.referrals (promo_type);
