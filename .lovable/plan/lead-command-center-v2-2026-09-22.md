# Lead Command Center V2

## Goal

Turn the Lead Tracker into a staff work queue. The first screen shows only people who need a human action; healthy automated follow-up moves to a separate view.

## What changes

### 1. Two clear working views

Add a view switch above the lead list:

- **Needs Staff Attention** — default view and the only place High Priority appears.
- **Automated Follow-up** — normal leads whose sequences are working without staff help, grouped by lifecycle stage.

The existing reporting month selector, search, source/status filters, reporting tiles, Referrals, Missed Calls, Business Analytics, and Settings remain available. Search can still find people outside the current month.

### 2. One lifecycle stage per person

Every lead gets one prominent derived stage:

1. Automation Running
2. Engaged
3. Tour Requested
4. Tour Booked
5. Trial / Day Pass Active
6. Joined
7. Nurture
8. Closed

The stage replaces competing CRM/status badges in the card header. Raw CRM status, sequence state, objections, loss reasons, and acquisition data stay available under **Details**.

Stage rules use the data already stored in leads, appointments, referrals, day-pass purchases, and text history. Joined and Closed take precedence; confirmed visits take precedence over requests; active trials/day passes take precedence over general engagement.

### 3. Exact staff-attention rules

A card enters **Needs Staff Attention** with one highest-priority instruction when any of these is true:

1. **Call — text undelivered**: the latest outbound failed/was undelivered, or the sequence is marked undeliverable.
2. **Fix automation**: a lead-attributed automated text failed, or a sequence is paused without a valid booked-tour, staff-takeover, opt-out, joined, or closed reason.
3. **Reply to question**: the latest customer message has no later outbound response, including AI escalation, operational handoff, or staff-takeover suppression.
4. **Reply — ready to buy**: HIGH INTENT is active and has not been cleared by a later staff action.
5. **Book requested tour**: the latest appointment is pending/alternative suggested, or visit intent exists without a confirmed booking.
6. **Follow up — tour no-show**: a confirmed tour time is in the past, the tour is not completed, and the appointment was not canceled/declined.
7. **Follow up — trial ends today**: only on the final Chicago calendar day, only if the customer has not joined, has no confirmed tour or membership setup in progress, and has not replied after the conversion sequence began.
8. **Follow up — day pass visit**: beginning the following Chicago morning, only if they checked in, have not joined, and have not replied after the post-visit conversion sequence began.

If several apply, the card shows only the highest-priority instruction; all supporting facts remain in Details. Opted-out, Joined, and Closed records never appear merely because automation is not running.

The queue sorts by instruction priority first, then by the oldest unresolved item within that instruction:

1. Text undelivered / fix automation
2. Unanswered question
3. Ready to buy
4. Tour request
5. Tour no-show
6. Trial ending
7. Day-pass follow-up

A brand-new lead whose first automated message was delivered successfully and who has not replied belongs in **Automated Follow-up**, not Needs Staff Attention. It enters the attention queue only after a reply, high-intent signal, tour request, or automation failure.

### 4. Cards become action-first

Each attention card shows:

- one lifecycle stage
- one explicit instruction
- High Priority only because staff action is currently required
- contact information and relevant timing/context
- one-click actions: **Reply**, **Call**, **Book Tour**, **Mark Joined**, and **Close / Nurture**

Actions reuse the current safe behavior:

- Reply opens the existing SMS composer; sending pauses automation and records a staff message.
- Call uses the lead's phone link.
- Book Tour opens the existing tour controls and date/time field.
- Mark Joined keeps the existing conversion updates and welcome message.
- Close / Nurture offers either Lost Lead with a reason or Nurture without marking the person lost.

### 5. Replace redundant tags with real activity

Remove the **Never Contacted** badge and the header badge wall. Show a compact activity summary instead:

- **Last outbound:** time, message preview, and sender type — Automated or Staff
- **Last inbound:** time and message preview
- **Sequence:** current state
- **Next automated step:** plain-language step and expected timing, derived from sequence type, follow-up count, last send, quiet hours, and scheduled visit reminders

Full delivery details, exact text thread, raw automation state, and editable CRM fields remain under Details.

### 6. Automated Follow-up view

Show only leads that do not currently need staff action and are not Joined/Closed. Group them by lifecycle stage so healthy automation is easy to scan without cluttering the work queue.

Each row/card still shows last inbound/outbound activity, current sequence state, and next automated step. Normal sequence-running leads never appear in the default staff queue.

## Technical details

- Update `src/routes/_authenticated/admin.leads.tsx` and add small client-safe derivation helpers/components where useful instead of expanding the existing monolith further.
- Load the latest relevant `sms_conversation_log` rows and appointments for the visible lead set, then derive sender identity, unanswered messages, handoffs, delivery failures, no-shows, and next steps in one shared model.
- Use Chicago dates for trial final-day and next-morning day-pass rules.
- Treat `from_ai = true` and known automated message kinds as Automated; `metadata.sent_by = "staff"` or the manual-send pattern as Staff.
- A day-pass response counts only when an inbound message is later than the post-visit conversion outbound; a trial response counts only when later than its conversion-sequence outbound/start. Ordinary earlier messages do not suppress the task.
- No database schema or texting behavior changes are required. Existing failed-message and handoff records supply the attention signals; errors with no associated lead remain outside an individual lead card.
- Keep existing permissions and server-side staff/admin checks unchanged.

## Verification

Check desktop and mobile layouts and verify these cases against current data or controlled fixtures:

- unanswered customer question
- AI/human escalation
- ready-to-buy lead
- pending tour request
- confirmed upcoming tour
- past uncompleted tour/no-show
- undelivered text
- legitimate pause versus unexplained pause
- trial ending today with and without a qualifying reply
- day pass next morning with and without a qualifying reply
- healthy active sequence in Automated Follow-up only
- Joined, Nurture, and Closed transitions
- Reply, Call, Book Tour, Mark Joined, and Close/Nurture actions
