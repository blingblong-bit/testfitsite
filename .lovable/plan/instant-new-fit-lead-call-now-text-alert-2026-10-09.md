# Instant "NEW FIT LEAD — CALL NOW" text alert

## What you get
- Every time a brand-new lead is saved from any website form, your phone (931-434-2243) gets one text in the exact format you gave, including a tap-to-call number and a link to the Lead Tracker.
- Repeat submissions from someone already in the tracker, spam, and existing members do not alert (they aren't new leads).
- If the text fails, the lead is still saved and the customer sees nothing different. The failure is recorded.
- A "Send test lead alert" button for staff that creates a clearly labeled TEST lead and proves exactly one text arrives.

## Forms covered (all website lead forms)
- Contact page, combat sports (BJJ/Kickboxing) forms, and any other form using the shared lead submission
- Schedule a visit / tour request
- Day pass kiosk (first-time guests only — returning guests are not new leads)
- Refer-a-friend / redeem-referral (the person being referred)
- Free week claim code path (currently retired, wired so it works if re-enabled)

Not included (not website forms): staff-created leads, missed-call text-back, Calendly, AI assistant inquiries. Say if you want any of those too.

## Message
```text
NEW FIT LEAD — CALL NOW

Name: Jane Smith
Phone: (931) 555-1234
Interest: Membership
Goal: Lose weight            (line omitted if not provided)
Preferred Start: Next week   (line omitted if not provided)
Source: Contact form · utm: facebook
Submitted: Oct 9, 2026, 3:52 PM CT

Tap to call: tel:+19315551234
Open Lead Tracker: https://fitbeyondplus.com/admin/leads
```
Interest is mapped to Membership / Free Week / Personal Training / Day Pass / Other. Phones auto-link on iPhone/Android.

## Test method
Staff home gets "Send test lead alert". It:
1. Creates a lead named "TEST — Lead Alert Check" (marked as test, closed, no customer texts, excluded from stats).
2. Sends the alert, then deliberately tries a second time to prove the duplicate guard blocks it.
3. Shows the result on screen: sent / Twilio message ID / time / "duplicate blocked".
I'll run it once before calling this done and confirm with you that exactly one text arrived.

## Technical details
- **Secret** `LEAD_ALERT_PHONE` = +19314342243 (only place to change the number). Uses existing `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER`. Server-only.
- **New table** `lead_alert_log` (migration): `lead_id` UNIQUE, `status` (sending/sent/failed), `to_phone`, `twilio_sid`, `sent_at`, `error_message`, `is_test`, `created_at`. RLS on; staff/admin SELECT only. The unique `lead_id` claim-before-send guarantees one alert per lead even on retries or double clicks.
- **New** `src/lib/lead-alert.server.ts`: `sendNewLeadAlert(leadId, { source, goal?, preferredStart? })` — loads lead, claims log row (insert; conflict ⇒ skip), builds message (Chicago time via `chicago-time.ts`, source from form label + `utm_source`), sends via Twilio, updates log. Never throws.
- **New** `src/lib/lead-alert.functions.ts`: `sendTestLeadAlert` (requireSupabaseAuth + staff/admin role check).
- **Edited (call alert only after successful insert, isNew paths)**:
  - `src/lib/insert-or-update-lead.functions.ts` (contact, combat, shared forms)
  - `src/lib/appointments.functions.ts` (public tour/visit requests creating a new lead)
  - `src/lib/process-day-pass-checkin.functions.ts` (first-time guest insert)
  - `src/lib/referrals.ts` (new referred/free-week lead inserts from public forms)
  - `src/routes/_authenticated/staff-home.tsx` (test button)
  - `docs/staff-notifications.md` (document `LEAD_ALERT_PHONE`)
- No edge functions or database triggers changed; customer forms, welcome texts, and email notifications untouched. Existing staff alert list (`STAFF_NOTIFICATION_PHONES`) unchanged.
- Test lead uses `lead_type='test'`, `should_notify=false`, a 555 placeholder phone, so the welcome-text trigger and sequences never contact anyone.
