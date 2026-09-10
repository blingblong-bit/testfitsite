# Faster repeat day-pass check-in, no duplicate records

## How it works today

A returning guest is treated as brand new: name, email, phone, waiver, payment. We try to
match them to their existing record by email or by the last 10 digits of their phone. When
that works we update the existing record; when it doesn't (different email *and* different
phone) a second record is created, with no warning to staff. The "bought a day pass on"
date is replaced each visit, so a fifth visit looks identical to a first.

## What changes

### 1. Returning guests only type their phone

Step one of the day pass screen becomes a single phone field with a "Continue" button.

- **Recognized:** we show "Welcome back, John — we've got your details" and go straight to
  the waiver + payment step. Nothing to re-type.
- **Not recognized:** the name and email fields appear right below, exactly as they do now,
  and the guest fills them in.

The waiver stays required on every single visit, recognized or not — it is shown and must be
checked before payment each time. Same for the text-message consent box.

### 2. One record per person, always

- Recognizing someone by phone up front means the record is chosen *before* the purchase,
  so a returning guest can never spin off a second record by typing a new email.
- If they type a phone we don't know but an email we do, we still attach to that record.
- The current matching also only scans the first 50 possible records; that cap goes away so
  a match can't be missed as the list grows.
- Staff-approved "paid at desk" requests get the same treatment, and a second pending
  request from the same phone reuses the one already waiting instead of adding another.

### 3. Visit count and dates

Every day-pass purchase gets its own row in a new history list, so a lead card can show
"3 day passes — Sep 10, Aug 22, Jul 14" instead of just the latest date. Existing records
are backfilled from the purchase dates and note history we already have, so nothing is lost.

The staff approvals screen also gets a small "Returning guest — 3rd day pass" line so staff
know who they're waving through.

Nothing else in the Lead Tracker changes: no records merged or deleted, all notes, texts,
timestamps, and source info stay exactly as they are, and the existing duplicate pair from
older website forms is left alone.

## Privacy note

A phone-only lookup on a public page can be probed to fish for names. It will return only a
first name and a yes/no, never the email or phone, and it will be rate limited per browser
and overall — the same guard already used against bot sign-ups on this form.

## Technical notes

- Migration: `public.day_pass_purchases` (lead_id → leads, purchased_at, payment_method,
  amount, source of record), GRANTs for authenticated + service_role, RLS with admin/staff
  read via `has_role`; writes only through the service role. Backfill from
  `leads.day_pass_purchased_at` plus parsed "Day pass walk-in" note lines. `leads.day_pass_purchased_at`
  keeps working as the latest-purchase field, so `customer-stage.ts` needs no change.
- New public server fn `lookupDayPassGuest` in `src/lib/lookup-day-pass-guest.functions.ts`:
  digits-only last-10 phone match via `supabaseAdmin`, returns
  `{ found, first_name, lead_id, visit_count }` only. In-window submission counter reused
  from the existing rate-limit pattern in `process-day-pass-checkin.functions.ts`.
- `src/components/kiosk-screens.tsx` `DayPassScreen`: new `step === "phone"` before `"info"`,
  carrying `lead_id` forward; waiver + SMS consent stay on the pay step unchanged.
- `process-day-pass-checkin.functions.ts`: accept optional `lead_id` and prefer it over
  search; drop `.limit(50)`; insert a `day_pass_purchases` row inside `finalizeDayPassLead`;
  dedupe pending inserts on phone + `status = 'pending'`.
- `admin.day-pass-approvals.tsx` and the lead card in `admin.leads.tsx`: show visit count and
  recent dates from the new table.
