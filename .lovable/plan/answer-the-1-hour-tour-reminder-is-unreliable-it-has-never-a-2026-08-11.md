# Answer: the 1-hour tour reminder is unreliable — it has never actually sent

## What I checked

- The reminder job runs every 15 minutes and is healthy (every run in the last hours succeeded).
- Every confirmed appointment on record shows only `day_before` and/or `morning_of` reminders. Not one has `hour_before` recorded:
  - Abby Thompson (tonight 6:00pm) — day_before + morning_of sent, hour_before still pending
  - Alysa Austell Burks (9:00am visit) — day_before + morning_of only
  - Ava Hill (9:00am visit) — morning_of only

## Why it misses

Two timing flaws in the reminder logic:

1. **Morning-of blocks hour-before for morning appointments.** For a 9:00am visit, the 8:00am run sends the "see you today" text and then stops, even though that same run is exactly 60 minutes out. By the next run (8:15) the appointment is only 45 minutes away, which is outside the hour-before window, so it is skipped forever. That is what happened to both 9:00am tours.

2. **The window is too narrow for the 15-minute schedule.** The hour-before check only fires when the appointment is more than 55 and at most 65 minutes away. Appointments at :10, :25, :40, or :55 past the hour never land inside that window on a 15-minute cron, so they silently get no hour-before text.

Evening appointments like Abby's 6:00pm should fire at the 5:00pm run — so the feature is not fully broken, it just only works for appointments on the hour/half-hour that are not close to 9:00am.

## Proposed fix

In the reminder handler (`src/routes/api/public/hooks/process-appointment-reminders.ts`):

- Allow both the morning-of and the hour-before reminder to be evaluated in the same run instead of letting morning-of short-circuit it, so a 9:00am tour gets both texts.
- Widen the hour-before window to roughly 45–75 minutes out so every appointment time hits at least one cron tick, while keeping the once-only flag so nobody gets two copies.
- Leave day-before and morning-of behavior unchanged.

No database or schedule changes needed; the cron job and table are already correct.
