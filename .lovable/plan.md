# FIT CRM Redesign — Contacts, Opportunities, Tasks (revised)

This plan includes all nine revisions. Nothing is migrated and no page is replaced until you approve it. The dry-run results below are real counts from today's data (73 records).

## 1. Page structure (initial rollout)

The new staff area lives at `/crm`. It has a left sidebar and a compact top toolbar. Global search (name / phone / email) is always visible and never applies any filter.

```text
+-----------+--------------------------------------------------+
| FIT CRM   |  [Global search........]   [+ New]   Jalen v     |
|-----------+--------------------------------------------------+
| Dashboard |                                     +----------+ |
| Opportun. |            page content             | Contact  | |
| Contacts  |                                     | drawer   | |
| Tasks     |                                     | (tabs)   | |
| Appts     |                                     +----------+ |
| Settings  |                                                  |
+-----------+--------------------------------------------------+
```

- **Dashboard**:
  - Six counts: new leads not contacted, overdue tasks, follow-ups due today, appointments today, trials ending within 48h, and leads stalled 5+ days.
  - One "Needs Attention" queue below the counts. No all-time stats.
- **Opportunities**: the FIT Sales Kanban board with drag and drop, plus a List toggle.
  - Cards are minimal: name, interest, source, owner, next task and due date, days since last activity, appointment date.
  - Each card has call / text / task / open icons.
- **Contacts**: a table plus Smart Lists. Active filters show as removable chips with "Clear all". The Migration Review Smart List is included.
- **Tasks**: Overdue / Due Today / Upcoming / Completed.
- **Appointments**: today and upcoming, plus a link to the existing approval queue.
- **Settings**: owners, stall threshold (default 5 days).
- **Contact drawer**: tabs for Details, Conversation (existing SMS thread), Opportunities, Tasks, Appointments, Notes, Activity and Automation.
  - Staff can call, text, add a note, create a task, book an appointment, or change the stage, all from the drawer.
- **Mobile**: the sidebar becomes a bottom bar. On mobile, stages change with a select instead of drag.

**These stay where they are for now:** Business Analytics, Referrals, Missed Calls, monthly reporting, the old Lead Tracker at `/admin/leads`, and every other existing page. The Conversations inbox, Reports, and moving pages come later, once the core CRM is verified.

## 2. Data model (additive only)

**Contact = the existing `leads` row.** Its id, messages, notes, appointments and attribution all stay. New columns:

- `contact_type`: Prospect, Member, Former Member, Vendor/Non-Sales, or Spam. Nothing else.
- `original_source`: backfilled from the current first-touch source, and never overwritten.
- `latest_source`: updated on each new form submission.
- `tags text[]`: holds things like day-pass, free-week, trial, opted-out.
- `owner_id`, `comm_pref`.

**New `opportunities` table:**

- Columns: `contact_id`, `pipeline` ("FIT Sales"), `stage`, `interest`, `status` (open / won / lost only), `value`, `owner_id`, `source`, `no_action_required`, `last_activity_at`, `appointment_id`, `won_lost_reason`, `closed_at`, timestamps.
- Interest values: Membership, Personal Training, Combat Sports, Classes, Day Pass, Free Week, Other.
- Long-Term Nurture and Migration Review are open stages, not statuses.
- A database rule allows only one open opportunity per contact and interest: `UNIQUE (contact_id, interest) WHERE status = 'open'`. Historical won/lost opportunities can repeat without limit.

**New `crm_tasks` table:** contact, opportunity, type, title, due date and time, owner, completed_at, completed_by.

**New `contact_activity` table:**

- One row per form submission (with that submission's own source and UTM values), stage change, note, task completion, owner change and automation fired.
- It also records each stage-triggered automation with a unique key, so retrying an action never repeats it.

Attention is calculated live, never stored. "Sequence Paused" appears only in the Automation tab and never decides pipeline placement. Only staff and admins can access the new tables.

## 3. Pipeline stages (exact)

1. New Lead
2. Attempting Contact
3. Engaged
4. Tour or Assessment Booked
5. Trial or Day Pass Active
6. Decision and Follow-Up
7. Long-Term Nurture
8. Joined — Won
9. Closed — Lost

**Migration Review** is a holding column, not a sales stage. Records leave it only when staff resolve them.

Moving to Joined — Won or Closed — Lost always asks for confirmation:

- **Joined — Won** lists exactly what will fire: member welcome text, stopping the follow-up sequence, setting the member flag and join date.
- **Closed — Lost** requires a reason.

Every stage-triggered text or automation runs at most once per opportunity. Dragging back and forth or retrying never sends a duplicate.

## 4. Migration mapping rules

These rules are applied in order, using real message and activity history:

1. Spam: contact type Spam, no opportunity.
2. Vendor: contact type Vendor/Non-Sales, no opportunity.
3. Any conflicting or ambiguous record goes to **Migration Review**: shared phone, member flag contradicting status, undeliverable phone.
4. Existing member already marked Joined: contact type Member, no opportunity.
5. Joined / became member: Member, Membership opportunity **won**.
6. Lost Lead: **lost** opportunity, existing loss reasons kept.
7. Future confirmed tour, or Tour Scheduled: Tour or Assessment Booked.
8. Active free week: Trial or Day Pass Active, tagged free-week.
9. Tour completed with activity in the last 14 days: Decision and Follow-Up.
10. No response and no meaningful activity for 14+ days: Long-Term Nurture (open).
11. Any inbound reply with recent activity: Engaged.
12. Otherwise, recent unanswered outreach: Attempting Contact.

"Activity" means the latest of: lead created, last contact, last response, any text in or out, and any appointment.

**No tasks are created for migrated records.** Open opportunities start with "No action required". Attention still raises anyone who truly needs it now, such as unanswered replies or upcoming tours. Reactivating the 42 nurture leads will be planned separately, in batches.

Day-pass purchases become a "day-pass" tag plus a Day Pass opportunity only when one is still active. Past purchases stay in the purchase history.

## 5. Dry-run results (exact, today)

| Stage | Records |
|---|---|
| Long-Term Nurture (open) | 42 |
| Joined — Won | 8 |
| Attempting Contact | 7 |
| Migration Review | 4 |
| Engaged | 3 |
| Closed — Lost | 2 |
| Tour or Assessment Booked | 1 |
| Trial or Day Pass Active | 0 |
| Decision and Follow-Up | 0 |
| New Lead | 0 |
| No opportunity — Member contact | 3 |
| No opportunity — Spam contact | 3 |
| **Total** | **73** |

### Complete Migration Review list (4)

| Name | Phone | Issue |
|---|---|---|
| Haleigh Woodcox | (931) 691-5415 | Joined member, but her phone number is shared with another record. Needs a merge decision. |
| Toye Ray | (931) 434-4708 | Phone is undeliverable (carrier error 30003). Needs a working number. |
| Seth Vaughn | (931) 434-9110 | Marked as a member, but status is "Tour Completed" and the follow-up sequence is still active. Confirm whether he joined. |
| Luz Sanchez | (931) 434-4135 | Existing member, but marked "Waiting on Response" with a paused sequence. Confirm she's a member, not a prospect. |

Note: earlier I counted two shared phone numbers. The second pair involves a spam record and is excluded, so only Haleigh's needs review.

## 6. Ongoing rules (after launch)

- **Returning form submission:**
  - Logs a `contact_activity` row with that submission's source and UTMs, updates `latest_source` only, and sends the existing RE-ENGAGED alert.
  - If an open opportunity with the same interest exists, it bumps its activity date and flags it for attention.
  - Otherwise it creates a new opportunity.
  - It never reopens or overwrites a won or lost opportunity. A previously lost contact gets a fresh opportunity.
- **Antaris member sync:** may set the contact type to Member and mark an open **Membership** opportunity won. It never closes Personal Training, Combat Sports, Classes or other opportunities.

## 7. Automations that stay unchanged

- New/Re-engaged lead alerts and their per-submission duplicate protection.
- Welcome text, intent-based first outreach, the follow-up drip, pacing and quiet hours.
- AI replies and escalation, staff-takeover detection, tour reminders.
- Day-pass check-in, free-week claims and rewards, missed-call text-back, delivery tracking.
- Emails, attribution, Antaris read-only sync, and every customer-facing form.

## 8. Risks

- This is a large rebuild, so it ships in four verified phases:
  - A: migration and dry run
  - B: Opportunities board and contact drawer
  - C: Contacts and Smart Lists
  - D: Tasks and Dashboard
- Only 2 staff logins exist, so owners are limited to those two until more accounts are added.
- The data is reversible: new tables and columns can be emptied without touching existing lead data, and the old Lead Tracker keeps working throughout.

## Technical details

- **Migration (DDL):**
  - Add the new columns to `leads`.
  - Create `opportunities`, `crm_tasks` and `contact_activity` with GRANTs, RLS and `has_role` policies.
  - Add the partial unique index `opportunities_one_open_per_interest ON (contact_id, interest) WHERE status='open'`.
  - Add a unique `contact_activity(idempotency_key)`.
- **Data mapping:** a staff-only server function `runCrmMigration({ dryRun })` that runs the rules in section 4 and is idempotent (it skips contacts that already have opportunities). The dry run returns the counts above. The real run is executed only after your approval.
- **Routes:** a `src/routes/_authenticated/crm.tsx` layout plus `crm.index`, `crm.opportunities`, `crm.contacts`, `crm.tasks`, `crm.appointments` and `crm.settings`. The drawer opens from the `?contact=` URL parameter.
- **Code locations:** shared logic in `src/lib/crm/` (stage-mapping, attention, smart-lists, automations with idempotency keys); server functions in `src/lib/crm/*.functions.ts`. Drag and drop uses `@dnd-kit/core`.
- **Lead insert paths** (the four form handlers) get one `recordSubmission()` call next to the existing alert. The Antaris sync gets the Membership-only win rule.
