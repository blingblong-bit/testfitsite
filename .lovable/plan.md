# Make email optional on the contact form and the day pass form

Right now both forms refuse to submit without an email address. After this change, email becomes a nice-to-have on both.

## What changes for visitors

**Contact form**
- Email field is no longer required; label reads "Email (optional)".
- Since we still need a way to reply, at least one of email or phone must be filled in. If both are blank, the form says: "Please give us either an email or a phone number so we can get back to you."
- With no email on file, we simply skip the automatic "we got your message" confirmation email. Staff still get the new-lead notification.

**Day pass form (new guests)**
- Email field is no longer required; label reads "Email (optional)". Name and phone stay required.
- Everything else is unchanged: waiver, text consent, Venmo/paid-at-desk, welcome text.
- Returning guests already skip this screen entirely, so nothing changes for them.

## In the Lead Tracker

Records with no email still show up normally, and matching against existing people falls back to the phone number so we don't create duplicates. Nothing existing is altered.

## Technical notes

- `src/routes/contact.tsx`: drop `required` on the email field, add the "email or phone" check in `handleSubmit`.
- `src/components/kiosk-screens.tsx`: drop `required` on the day-pass email field, reword the step subtitle ("we just need your name and number").
- `src/lib/leads.ts` (`submitLead`): require name plus at least one of email/phone instead of name + email; only call `confirmLeadToCustomer` when an email is present.
- `src/lib/insert-or-update-lead.functions.ts`: only add the `email.ilike` dedup filter when email is non-empty (today an empty email would match blank-email rows); keep the phone-digits filter; guard the in-memory match the same way.
- `src/lib/lead-classifier.ts`: stop flagging a missing email as spam — flag only when both email and phone are missing.
- `src/lib/check-existing-member.functions.ts` and the Antaris member check: allow an empty email and match on name + phone instead of failing validation.
- `src/lib/process-day-pass-checkin.functions.ts`: the input rule currently demands a valid email for non-returning guests — change it to name + phone, keep the fake/disposable-email check only when an email is supplied.
- No database migration needed: `leads.email` and `day_pass_pending_checkins.email` stay non-null and are written as an empty string when not provided.
- No other forms are touched (combat sports, referrals, appointments keep email required).
