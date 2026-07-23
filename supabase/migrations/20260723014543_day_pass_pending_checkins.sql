-- Pending "paid at desk" day pass requests, awaiting staff approval.
-- A person is only added to the leads pipeline once staff confirms the
-- desk payment actually happened by tapping Approve.
create table if not exists public.day_pass_pending_checkins (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null,
  payment_method text not null default 'paid_at_desk',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  rejected_at timestamptz,
  lead_id uuid references public.leads(id)
);

create index if not exists day_pass_pending_checkins_status_idx
  on public.day_pass_pending_checkins (status, requested_at);

alter table public.day_pass_pending_checkins enable row level security;

-- Only admins can read/write pending requests directly; the public submit
-- path goes through the service-role server function, not direct client access.
create policy "Admins can manage day pass pending checkins"
  on public.day_pass_pending_checkins
  for all
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));
