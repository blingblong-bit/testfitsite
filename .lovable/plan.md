# Monthly view for the Lead Tracker

Today the Lead Tracker shows every person ever, all time. This adds a month selector so the page reports on one month at a time, with an option to see everything together.

## What you'll see

At the top of the Lead Tracker, above the number tiles:

```text
Period:  [ < ]   September 2026   [ > ]      ( All Time )
```

- Opens on the current month.
- Arrows step back and forward through months; forward stops at the current month.
- "All Time" switches back to the full list exactly as it works today.
- The chosen period is remembered while you stay on the page.

## What the month includes

A person counts in a month if anything happened with them that month: they came in, were contacted, replied, toured, bought a day pass, or joined. So someone who came in August and joined in September shows up in both months.

## Number tiles

These follow the selected month:

- Prospect Leads, Converted This Month, Prospect Conversion Rate
- Tours Completed
- Day Pass Customers, Day Pass to Membership, Day Pass Conversion Rate
- Existing Members Detected

These always show everything, no matter the month, so nothing urgent gets hidden:

- New Leads, Follow-Ups Due Today, High Priority, Tours Scheduled

Each of those four tiles gets a small "all time" note so the difference is obvious. Clicking one of them switches the period to All Time so the list matches the count.

## The list below

The lead list is filtered to the selected month, and search, status, source, and sort keep working inside it. Searching a name while a month is selected will say if there are matches in other months, with a one-click jump to All Time.

## Other tabs

Referrals, Missed Calls, Analytics, and Settings are untouched. Analytics already has its own month navigation.

## Technical notes

- In `src/routes/_authenticated/admin.leads.tsx`, add period state (`{ kind: "month", year, month } | { kind: "all" }`) in the leads-tab component, defaulting to the current Chicago month.
- Add a helper that computes Chicago month start/end and an `activeInMonth(lead, start, end)` check over `created_at`, `last_contacted_at`, `last_response_at`, `tour_date`, `converted_at`, `membership_start_date`, `day_pass_purchased_at`, and `last_sms_at`.
- Apply the period filter to the pools used for month-scoped stats (`prospectPool`, `dayPassPool`, existing-member count) and to `byType` before the existing `filtered` chain; leave the four always-on tiles computed from the unfiltered `leads` array.
- Keep `joinedInMonth` semantics but drive it from the selected month rather than the hardcoded current month.
- No database or query changes: leads are already fetched in full and filtered in the browser.
