-- Allow appointments to be booked for a day pass, not just a tour or
-- enrollment. Approving a day_pass appointment generates and texts a
-- referral/day-pass code instead of the generic tour confirmation.
alter table public.appointments
  drop constraint if exists appointments_type_check;

alter table public.appointments
  add constraint appointments_type_check
  check (type in ('tour', 'enrollment', 'day_pass'));
