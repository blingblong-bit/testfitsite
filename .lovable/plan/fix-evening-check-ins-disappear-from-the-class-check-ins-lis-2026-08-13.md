# Fix: evening check-ins disappear from the Class Check-Ins list

## What's actually happening

The manual check-ins are being saved correctly — they're just filtered out of the list.

Confirmed in the data: Leah Cyree (added manually) was saved at 7:20 PM Central on Wed Aug 12, and Baylee Cyree at 7:19 PM the same evening. Neither shows on the Aug 12 list.

The Class Check-Ins page builds its date filter as plain text (`2026-08-12T00:00:00` to `2026-08-12T23:59:59`) with no time zone attached, so the database reads those as UTC times. Central time is 5 hours behind UTC, so anything checked in after 7:00 PM Central already counts as "tomorrow" in UTC and falls outside the window for today — and doesn't appear under tomorrow's date either, because tomorrow is a different weekday with a different class list.

This is not specific to manual entries — any check-in after 7:00 PM Central (all the 6:15 PM evening classes) is affected. It's most visible with manual adds because staff add those at the end of the evening class.

## The fix

In `src/routes/_authenticated/admin/class-checkins` (the admin Class Check-Ins page), change the query window from naive local strings to the true Chicago-day boundaries:

- Compute the start/end instants for the selected calendar date in `America/Chicago` (accounting for DST offset, -05:00 in summer / -06:00 in winter) and pass those to the `checked_in_at` filters, e.g. `2026-08-12T00:00:00-05:00` through `2026-08-12T23:59:59.999-05:00`.
- Keep the rest of the page unchanged: date picker, "Today" button, weekday-derived class list, grouping, cancel/undo, and the manual add modal all stay as-is.

Nothing changes in the database and no existing rows are edited — the missing check-ins will simply appear once the window is correct.

## Verification

After the change, load the page for Aug 12 and confirm the 6:15 PM Cardio / Lift group shows the evening check-ins including Leah Cyree (marked Manual) and Baylee Cyree, and that the earlier 8:00 AM class rows are unaffected.
