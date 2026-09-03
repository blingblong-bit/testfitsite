# Monthly class check-in export

Add a month export to the admin Class Check-Ins page so staff can download a full month of check-ins, organized by date and by class.

## What staff will see

On `/admin/class-checkins`, above the daily list, a new "Export a month" row:

- A month picker (defaults to the current month, Central time)
- Two buttons: **Download CSV** and **Download Excel**
- A small line showing how many check-ins that month contains, so staff know before downloading

Both files download straight to the staff member's device. Nothing about the existing daily view, manual add, or class cancel flow changes.

## CSV file

One row per check-in, sorted by date then class time then name:

`Date, Weekday, Class, Class Time, Name, Phone, Verified, Added Manually, Notes`

Then two summary blocks appended at the bottom:

- Totals per class for the month
- Totals per class per date

File name: `class-checkins-2026-09.csv`

## Excel workbook

- **Summary** sheet: total check-ins for the month, total per class, and a date-by-class attendance grid
- **One sheet per date** that had check-ins (e.g. `2026-09-02 Wed`), with check-ins grouped under a bolded class + time header row, and a count per class
- Header rows bolded, columns width-adjusted, dates/times formatted as readable text

File name: `class-checkins-2026-09.xlsx`

## Technical notes

- New server function `src/lib/class-checkin-export.functions.ts`, admin-gated via `requireSupabaseAuth` plus the existing `has_role` check pattern used by other admin functions. It queries `class_checkins` for the month using true `America/Chicago` day boundaries (reusing the existing offset logic from `admin.class-checkins.tsx`, extracted into a small shared helper in `src/lib/class-schedule.ts` or a new `src/lib/chicago-time.ts`) and returns rows plus computed summaries.
- Each row is bucketed by its Chicago calendar date, and the weekday is derived from that date so grouping matches the schedule in `src/lib/class-schedule.ts`.
- CSV is assembled client-side from the returned rows (proper quoting/escaping) and downloaded via a Blob.
- Excel uses SheetJS (`xlsx`), dynamically imported in the click handler so it stays out of the initial bundle. Cancelled sessions for the month are noted on the Summary sheet.
- No schema changes, no data changes.

## Verification

Export the current month and a past month, then confirm the CSV row count matches the on-page daily counts for a couple of sampled dates, and that the workbook has a Summary sheet plus one sheet per date with classes grouped correctly.
