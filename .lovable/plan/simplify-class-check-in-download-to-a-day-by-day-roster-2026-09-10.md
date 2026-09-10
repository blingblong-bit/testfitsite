# Simplify class check-in download to a day-by-day roster

Change the month export on `/admin/class-checkins` so the download reads as a simple roster: each day of the month followed by everyone who checked in that day.

## What staff will see

Same "Export a month" row with the month picker and the CSV / Excel buttons. The files themselves change:

- Organized by **day** (e.g. `Sep 2 — Tuesday`)
- Under each day, **every person who checked in**, one line each: name, class, class time, check-in time
- A headcount per day, and a month total

Removed from the download: the per-class summary blocks, the date-by-class attendance grid, verified/manual columns, phone numbers, and cancellation notes. The on-screen daily admin view is untouched.

## CSV

One file, in date order:

```text
Sep 2 — Tuesday (12 check-ins)
Jane Doe — Cardio Lift 6:00 AM — checked in 5:52 AM
...

Sep 3 — Wednesday (9 check-ins)
...

Month total: 199 check-ins
```

File name stays `class-checkins-2026-09.csv`.

## Excel

One sheet for the whole month (name it after the month), with a bolded day header row followed by that day's check-ins, then the next day. One table per day keeps it printable. File name stays `class-checkins-2026-09.xlsx`.

## Technical notes

- All changes are in `src/lib/class-checkin-export.ts`: rewrite `buildMonthCsv` and `buildMonthWorkbook` to iterate `data.rows` (already sorted by date → class time → name) grouped by `date`. Drop the `classTotals` / per-date-class summary sections and the canceled-classes block; keep the `CanceledRow` fetch removal out of scope only if unused — simplest is to stop querying cancellations in `fetchMonthExport` too.
- No changes to the admin page UI, the check-in flow, the database, or `chicago-time.ts`.

## Verification

Export the current month and August 2026, and confirm each day lists exactly the people shown in the on-page daily view for a couple of sampled dates, and that the month totals match (August was 199 check-ins).
