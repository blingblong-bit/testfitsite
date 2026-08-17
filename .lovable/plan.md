# Slow the automated texting down

## What happened with Seth

Seth got 5 texts in one hour today:

```text
1:00 pm  post-free-week nudge ("hope you loved it")
1:15 pm  drip 1
1:30 pm  drip 2
1:45 pm  drip 3
2:00 pm  drip 4
```

Cause (confirmed in the follow-up job and his record): each drip step is gated
only by "days since the lead was created." Seth was created Aug 10, so on Aug 17
the day-1, day-3, day-5 and day-7 steps were all already "due." The job runs
every 15 minutes and sends exactly one step per run, so it burned through four
steps back-to-back. Nothing in the job checks when we last texted the person, and
there are no quiet hours. He was the only lead hit this hard; one other lead got
2 texts in 24h.

## The fix

Add real pacing to the automated sequence (`process-lead-followups`, which covers
both the cold drip and the post-visit sequence):

1. Minimum gap between any two automated texts: 48 hours. Compare against the
   lead's actual last outbound text, not just the step schedule — so the free-week
   nudge, welcome text, or a manual staff text all count as "we just texted them."
2. Steps must be due *and* paced. A lead who has been idle for weeks catches up
   one step every 48 hours instead of all at once.
3. Hard cap: one automated text per lead per day.
4. Quiet hours: only send between 9:00 am and 7:00 pm Chicago. Anything due
   outside that window waits for the next morning.
5. Post-visit sequence keeps its tighter 3h / 24h intent, but with a 3-hour
   minimum gap and the same quiet-hours rule.
6. Reduce total cold-sequence length from 6 texts to 4 (drop the day-10 and
   day-14 "last message" steps), so nobody gets more than 4 automated nudges.

Nothing changes about replies: as soon as someone responds, the sequence already
stops.

## Technical notes

- File: `supabase/functions/process-lead-followups/index.ts`.
- Query already selects `last_sms_at`-adjacent fields; add `last_sms_at` to the
  select and skip any lead whose `last_sms_at` is within the minimum gap, and any
  lead with an outbound `sms_conversation_log` row in the last 24 hours.
- Quiet-hours check via `Intl.DateTimeFormat` with `timeZone: "America/Chicago"`,
  matching how the appointment-reminder job does it.
- Trim `FOLLOWUPS` to 4 entries and update the `followup_count < 6` filter and the
  `markCompleted` boundary accordingly.
- No database or schema changes; no UI changes.
