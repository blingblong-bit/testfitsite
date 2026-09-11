# Stop chasing people whose texts never arrive

Toye Ray still shows "Sequence: Active" even though the one text we sent came back undelivered (carrier error 30003, unreachable handset). Nothing today reacts to a failed delivery, so the record looks like a healthy conversation in progress and the automated sequence would keep trying.

Confirmed from the records: 3 outbound texts ever came back undelivered — Toye Ray (30003) plus two older ones not attached to any lead (30006, a landline/unreachable number).

## What changes

1. **A failed delivery stops the sequence.** When the phone carrier reports a text as undelivered or failed, the lead's sequence is switched off (new status: "Undeliverable") so no further automated texts go out to a number that can't receive them. A dated note is appended to the lead ("Text undelivered — carrier error 30003") so the history is self-explanatory.

2. **The Lead Tracker says so plainly.** A red "Text Undelivered" badge on the lead card, and the sequence badge reads "Sequence: Undeliverable" instead of Active. Staff see at a glance that this person needs a phone call, not another text.

3. **Staff get told once.** The existing staff alert text is sent when a lead's text comes back undelivered, naming the person, the number, and the reason — so it isn't discovered days later.

4. **Fix the existing record.** Toye Ray is set to Undeliverable with the explanatory note. The two older unattached failures need no lead change.

## Not changing

Manual texting stays possible (you may know the number now works), delivery history and notes are never deleted, and nothing else in the Lead Tracker or the follow-up rules is touched.

## Technical notes

- `supabase/functions/twilio-status-callback/index.ts`: after the existing `delivery_status`/`error_code` write, when status is `undelivered`/`failed`, resolve the log row's `lead_id` and update the lead to `sequence_status = 'undeliverable'`, append to `notes`, and fire the existing staff alert path. Guard against repeat callbacks for the same message SID so the note and the alert happen once.
- `src/routes/_authenticated/admin.leads.tsx`: add an `undeliverable` entry to `SequenceStatusBadge` (line ~1170) and derive a "Text Undelivered" card badge from the most recent outbound message's `delivery_status`, already selected in the conversation query.
- Follow-up processors (`process-lead-followups`, `followup-catchup`) filter on `sequence_status = 'active'`, so they stop automatically — no changes needed there.
- One-off data fix for Toye Ray's lead row; no schema migration required.
