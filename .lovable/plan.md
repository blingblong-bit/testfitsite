# Free Week: staff lookup by code + log all promo texts

Two small, contained changes based on the Bailey Morgan investigation.

## 1. Staff can approve a claimed code even without online check-in

Today the Free Week Arrivals page only shows people who completed the online
check-in step. Someone like Bailey — who claimed her week and got her code by
text but never opened the check-in link — is invisible to staff.

Add a **"Look up a code"** box at the top of Free Week Arrivals:

- Staff type or paste a code (case-insensitive, spaces trimmed).
- The result card shows the person's name, phone/email, who referred them,
  when the code was claimed, and the code's current state.
- If the code is claimed but not checked in, staff get a
  **"Confirm — They're Here"** button that activates the 7 days exactly like the
  normal flow (same lead updates, same referrer reward payout, same
  one-week-per-person guard).
- If the code is already activated, expired, or unknown, the card says so
  plainly instead of offering a confirm button.

The existing pending list, polling, confirm, and reject behavior stay unchanged.

## 2. Log every live free-week text in the conversation history

Real free-week texts (code delivery, activation, referrer reward) currently
reach the customer through Twilio but are never written to the conversation
log, so they don't appear in the Lead Tracker. Only test-mode sends are logged.

Change the shared SMS helper so **every** send is logged — with the Twilio
message ID and delivery status wiring already in place, so these texts also pick
up delivered/failed indicators in the Lead Tracker like manual replies do.

I will also backfill Bailey's already-delivered free-week code text so her
history is complete.

## Technical notes

- `src/lib/sms.server.ts`: `sendPromoSms` writes an `sms_conversation_log` row on
  the production path too (`status: sent | failed`, `provider_message_id` = Twilio
  SID, `metadata.kind` from the caller). Test-mode logging unchanged.
- Callers of `sendPromoSms` that know the lead pass `leadId` so the row links to
  the Lead Tracker card; where it isn't known, phone-based matching in the tracker
  still surfaces it.
- `src/lib/referrals.ts`: new admin server fn `lookupFreeWeekCodeForStaff`
  (admin-gated via `has_role`) returning the referral's state for display, and
  `confirmFreeWeekArrival` accepts `status in ('arrival_pending','sent')` instead
  of `arrival_pending` only. All other guards — promo type, prior-activated-week
  check, reward payout, lead update — untouched.
- `src/routes/_authenticated/admin.free-week-arrivals.tsx`: code lookup input +
  result card reusing the existing confirm handler.
- One-off data update for Bailey's historical code text (log row only, no resend).

No changes to the Lead Tracker, Twilio inbound handling, appointments,
membership, or day-pass logic.
