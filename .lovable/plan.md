# Put visit-intent leads in the tour pipeline (with reminder texts)

## What's happening now

Reminder texts (day before, morning of, hour before) only go out for visits booked
through the online scheduler. When staff mark someone as a scheduled tour on their
lead card, nothing is created behind the scenes, so that person never gets a
reminder. Today's record for Robert Stickney is exactly that case: marked as a
tour, no reminders possible.

## What changes

**1. Staff marking a tour puts the person in the tour pipeline**

When staff check "Tour scheduled" and set a date and time on a lead card, a
confirmed visit is created for that person automatically, using the name and phone
on the lead. From then on they get the same reminder texts as anyone who booked
online:

- the day before
- the morning of, at 8:00am Chicago time
- about an hour before

Changing the date or time updates the visit and re-arms the reminders for the new
time. Unchecking "Tour scheduled" or clearing the date cancels the visit so no more
reminders go out.

**2. Day but no time yet**

If staff set a date without a time, we don't guess. The lead gets one text asking
what time works for them, and the card shows a "Needs a time" flag in the Lead
Tracker. Reminders start once a time is on the record. The asking text is sent once
per lead per date, only between 9am and 7pm Chicago — outside that window it waits
for the next window instead of texting late at night.

**3. Leads with no phone number**

No phone means no reminders. Those cards show "No phone — can't remind" so staff
know to call or email instead.

## Technical notes

- `src/lib/appointments.functions.ts`: add a staff-side server function that
  upserts a `confirmed` appointment of type `tour` for a lead
  (`lead_id`, `name`, `phone`, `requested_time`/`confirmed_time` = tour date,
  `reminders_sent` reset to `{}` whenever the time changes), and cancels it when
  the tour is unset. Guard on staff/admin role via the existing auth middleware
  pattern used in that file.
- `src/routes/_authenticated/admin.leads.tsx`: the existing `tour_scheduled`
  checkbox and `tour_date` input call the new function after the lead patch;
  render the "Needs a time" / "No phone — can't remind" badges alongside the
  current tour badges.
- Midnight-Chicago `tour_date` values are treated as "date only, no time" —
  matching how the input already stores a date with no time component.
- Pending "what time works?" asks are stored on the appointment row
  (`status = 'pending'`, `reminders_sent.time_ask_sent`) so the existing
  `process-appointment-reminders` cron (every 15 minutes) can send a queued ask
  when the quiet-hours window opens, and no duplicate ask is ever sent.
- `src/routes/api/public/hooks/process-appointment-reminders.ts`: extend the query
  to also pick up `pending` tour rows needing the time-ask; reminder logic for
  confirmed rows is unchanged.
- Robert Stickney's existing record is backfilled into the new flow (date only, so
  he receives the time-ask, not a reminder).
- Verification: dry-run the message builder for day-before / morning-of /
  hour-before / time-ask and report the exact texts before anything sends live.
