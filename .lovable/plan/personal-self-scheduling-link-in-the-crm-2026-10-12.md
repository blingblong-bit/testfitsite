# Personal self-scheduling link in the CRM

The website already has a tour picker (`/schedule-visit`). When it's opened with a lead's personal link, it fills in their name and phone for them. Right now staff can only send that link with a one-off admin tool. This plan puts it in the CRM.

## What staff get
In the contact panel, on the **Appointments** tab, a new "Let them pick a time" box with:
- **Copy link**: copies the person's personal link (`fitbeyondplus.com/schedule-visit?lead=…`) so staff can paste it into a text, an email or a DM.
- **Text them the link**: sends the standard message after asking staff to confirm: "Hey [first name]! FIT Beyond Plus here — you can pick a time to come by for a tour or day pass right here: [link] — your info is already attached…"
  - The button is turned off when there's no phone number or the person has opted out of texts.
  - It shows when the link was last sent ("Link texted Oct 12, 3:15 PM"), so staff don't send it twice by accident.
- When the person picks a time, it goes into the existing website-request flow and shows up in this same tab as "Website request waiting". Staff confirm it there, and the reminder texts start.

## Rules
- Each click sends exactly one text. A quick double-click can't send two.
- Sending the link counts as a staff text: it pauses that person's automated texts, the same as any manual text. This matches what the old tool does today.
- Test contacts are logged but never actually texted.
- It only works for staff and admin logins.
- Nothing else changes: stages, other automations and existing appointments stay as they are.

## Technical details
- New `sendScheduleLink` server function in `src/lib/appointments.functions.ts`:
  - uses the `requireSupabaseAuth` middleware and checks the staff/admin role
  - reads the lead with admin access, reuses the existing `sendTwilioSms`
  - logs to `sms_conversation_log` with `metadata.kind='schedule_link'` and `sent_by: 'staff'` (counts as human contact under the project rule)
  - writes `contact_activity` with the idempotency key `schedule_link:<lead>:<minute>` to block double sends
  - updates `last_sms_at`, `last_contacted_at` and `sequence_status='paused'`
- The legacy `send-schedule-link-sms` edge function is left in place, unused.
- `TourScheduler.tsx`:
  - adds the link box, using `navigator.clipboard` for Copy link
  - "last sent" comes from the most recent `schedule_link` SMS, so the SMS list (already loaded) is passed down from `ContactDrawer`
- Verification: typecheck, then Playwright checks on a test contact for Copy link and for Text them the link (test mode, no real SMS).
