# Advance follow-up dates when we actually contact a lead

## Why

The priority badge has two inputs: how long since last contact, and whether the scheduled
follow-up date has passed. Right now an outbound text updates the first but never touches the
second, so a lead we texted this morning can still show HIGH PRIORITY because of a follow-up
date from June. Bailey Morgan (due 2026-07-03) and Elizabeth Parker (due 2026-06-28) are in
exactly that state; the other four campaign recipients simply had no follow-up date set.

## What changes

When an outbound SMS to a lead succeeds, also push the next follow-up date forward to 3 days
from today — but only when the current date is empty or already in the past. A future date that
staff deliberately set is left alone.

Applies to:
- The re-engagement campaign send
- The manual SMS reply from the expanded lead card

## Cleanup for the two existing leads

Move Bailey Morgan and Elizabeth Parker's follow-up date to 3 days from their actual
re-engagement send time, matching what the new logic would have written. They then read as
UP TO DATE today and come back as due in 3 days.

## Technical notes

- `src/lib/reengagement-campaign.functions.ts` — in the per-lead success update (around the
  existing `last_contacted_at: sentAt` write), add `next_follow_up_date` set to today + 3 days
  in America/Chicago, guarded so it only overwrites null or past dates.
- `src/lib/send-manual-sms.functions.ts` — apply the same guarded advance after a successful
  send, alongside its existing contact-tracking writes.
- Extract the "advance if stale" date computation into one small shared helper so both paths
  behave identically.
- No change to `computePriority` / `followUpOverdueDays` in
  `src/routes/_authenticated/admin.leads.tsx` — the badge rules stay as they are; we just stop
  feeding them stale dates.
- One-time data update for the two named leads only. Response and conversion fields untouched.
