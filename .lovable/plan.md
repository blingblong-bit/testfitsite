# FIT CRM Redesign — Contacts, Opportunities, Tasks (GoHighLevel-style)

This is the approval plan your brief asked for. No data is migrated and no pages are replaced until you approve it.

## 1. Page structure

A new staff CRM area at `/crm`. It has a left sidebar and a compact top toolbar. Global search (name / phone / email) is always visible and ignores every filter.

```text
+-----------+--------------------------------------------------+
| FIT CRM   |  [Global search........]   [+ New]   Jalen v     |
|-----------+--------------------------------------------------+
| Dashboard |                                                  |
| Convers.  |            page content                          |
| Opportun. |                                     +----------+ |
| Contacts  |                                     | Contact  | |
| Tasks     |                                     | drawer   | |
| Appts     |                                     | (tabs)   | |
| Reports   |                                     +----------+ |
| Settings  |                                                  |
+-----------+--------------------------------------------------+
```

- **Dashboard**: six counts (new and not yet contacted, overdue tasks, follow-ups due today, appointments today, trials ending in 48h or less, stalled 5+ days), with one "Needs Attention" queue below. No all-time stats.
- **Conversations**: a 4-panel inbox for SMS, which is the only two-way channel connected today. Email sends from the system but replies are not received, so the inbox is SMS only. Left panel is Unread / Awaiting reply / Staff / Automated / All. Then the thread list, the open thread, and an expandable contact panel.
- **Opportunities**: the FIT Sales pipeline as a drag-and-drop Kanban board, with a List view toggle. Cards are minimal: name, interest, source, owner, next task and due date, days since last activity, appointment date, and call / text / task / open icons.
- **Contacts**: a table plus Smart Lists. Every active filter shows as a removable chip, with "Clear all".
- **Tasks**: Overdue / Due Today / Upcoming / Completed.
- **Appointments**: today and upcoming tours and assessments, plus the existing approval queue.
- **Reports**: the current Business Analytics, monthly reporting, Missed Calls and Referrals move here unchanged.
- **Settings**: owners and staff list, stall threshold (default 5 days), pipeline stage labels.
- **Contact drawer** (opens from anywhere): Details, Conversation, Opportunity, Tasks, Appointments, Notes, Automation. From the drawer staff can call, text, add a note, create a task, book an appointment or change the stage.
- **Mobile**: the sidebar collapses to a bottom bar. Call, text, open, move stage (via a select, not drag) and complete task all stay usable.

The old Lead Tracker stays at `/admin/leads` during rollout. Once you approve the new CRM, it is retired with a redirect.

## 2. Data model (additive only; nothing renamed or dropped)

- **Contact = the existing `leads` row**, keeping its id, history and attribution. New columns:
  - `contact_type` (Prospect, Day-Pass Customer, Trial, Member, Former Member, Vendor, Spam)
  - `tags text[]`
  - `owner_id uuid`
  - `comm_pref` (sms / call / email / no_sms)
  - `needs_review boolean` plus `review_reason`
- **New `opportunities`**:
  - `contact_id`, `pipeline` (default "FIT Sales"), `stage`
  - `interest` (Membership, Personal Training, Combat Sports, Classes, Day Pass, Free Week, Other)
  - `status` (open / won / lost / nurture), `value numeric`, `owner_id`, `source`
  - `next_task_id`, or `no_action_required boolean`
  - `last_activity_at`, `appointment_id`, `won_lost_reason`, timestamps
  - Rule: a contact has at most one open opportunity per interest.
- **New `crm_tasks`**: `contact_id`, `opportunity_id`, `type` (call_new_lead, follow_up_tour, check_trial, ask_decision, reactivate, custom), `title`, `due_at`, `owner_id`, `completed_at`, `completed_by`.
- **New `contact_activity`**: one row per form submission, stage change, note, task completion and owner change. Texts, appointments and alert logs are already stored, so they are read from their own tables, not copied.
- **Attention is calculated, never stored.** It is the existing command-center logic, extended with: new lead not called, overdue task, appointment within 2h, trial ending, no activity for the stall threshold, and replied and awaiting a response. "High Priority" and "Sequence Paused" stop being categories. Paused shows only in the Automation tab.
- All new tables are readable and writable by staff/admin only (has_role check), like `leads` today.

## 3. Migration mapping (73 current records)

Each current record maps to a contact type, a pipeline stage and an opportunity status:

| Current record | Count | Contact type | Pipeline stage | Status |
|---|---|---|---|---|
| Joined / became_member (customer_lead) | 9 | Member | Joined — Won | won |
| existing_member (Joined) | 3 | Member | — no opportunity | — |
| existing_member marked "Waiting on Response" | 1 | Member | — | flagged Missing Info |
| Tour Completed, became_member = true | 1 | Member | Joined — Won | won (flag: status conflict) |
| Tour Completed, has day-pass purchase | — | Day-Pass Customer | Decision & Follow-Up | open |
| Tour Completed, no purchase | ~6 | Prospect | Decision & Follow-Up | open |
| Tour Scheduled | 1 | Prospect | Tour or Assessment Booked | open |
| Contacted, active sequence | 3 | Prospect | Attempting Contact | open |
| Contacted / Waiting, has an inbound reply | — | Prospect | Engaged | open |
| Contacted, no reply, paused | ~21 | Prospect | Attempting Contact | open (sequence state stays as automation info) |
| Contacted / Waiting, sequence completed, no reply 14+ days | ~10 | Prospect | Long-Term Nurture | nurture |
| Nurture | 0 | Prospect | Long-Term Nurture | nurture |
| Opted out of SMS | 5 | Prospect, comm_pref = no_sms | stage kept by the rules above | open |
| Undeliverable | 1 | Prospect | Attempting Contact | open + flagged Missing Info (bad phone) |
| Active free week (referral record) | — | Trial | Trial or Day Pass Active | open |
| Lost Lead (customer) | 2 | Prospect | Closed — Lost | lost (existing loss reasons kept) |
| Spam / Lost | 3 | Spam | — no opportunity | — |
| vendor_solicitation | 0 | Vendor | — | — |
| New Lead, no outbound yet | 0 today | Prospect | New Lead | open |

- Engaged vs Attempting Contact is decided per record from the actual text history (any inbound reply = Engaged). Rows marked ~ are estimates; the dry run gives exact counts.
- Interest comes from existing `interest` / `source` using the same rules as the alert. Unknown values become Other and are flagged.
- Owner defaults to you (the owner account). The other staff account can be assigned in Settings.
- Next action: open opportunities get one starter task based on their stage (e.g. Attempting Contact gets "Call new lead", due today). Otherwise they get "No action required" when automation is running normally.
- **Dry run first:** before writing anything, I'll show you the exact count per stage plus the list of flagged records.

## 4. FIT Sales pipeline stages (exact)

1. New Lead
2. Attempting Contact
3. Engaged
4. Tour or Assessment Booked
5. Trial or Day Pass Active
6. Decision and Follow-Up
7. Long-Term Nurture
8. Joined — Won
9. Closed — Lost

Dragging a card to Joined — Won runs the existing "Mark Joined" behavior, including the welcome text. Dragging to Closed — Lost asks for a reason. Booking a tour or redeeming a day pass or free week moves the stage forward automatically. Stages never move backward automatically.

## 5. Automations that stay unchanged

- Instant "NEW / RE-ENGAGED FIT LEAD — CALL NOW" alerts and the per-submission duplicate protection.
- Welcome text trigger, initial outreach by intent, 4-step follow-up drip, quiet hours and pacing, AI inbound replies and escalation, staff-takeover detection.
- Tour reminders, day-pass check-in, free-week claims and rewards, missed-call text-back, delivery status tracking.
- Lead and customer emails, first-touch attribution, Antaris member sync (read-only).
- Contact, combat sports, schedule-a-visit and day-pass forms. Customers see nothing different.

Only additions: each form submission also writes a `contact_activity` row. A re-engaged submission creates or reopens the opportunity for that interest and marks it for attention. Antaris member sync also sets contact type to Member and wins any open opportunity.

## 6. Conflicts and risks found

- **Duplicates:** 2 phone numbers are shared by two records each. These are flagged for a manual merge, never auto-merged. A merge tool in the drawer moves messages, appointments and history to the kept record.
- **Status conflicts:** 2 records are marked member but not "Joined" (including one existing member shown as "Waiting on Response"). They are flagged Missing Information.
- **Asa McMellon** (an active member in Antaris, still a prospect in the tracker) and similar cases are fixed by the member-sync rule above.
- **Only one connected channel:** inbound email and calls are not connected, so the inbox shows SMS plus logged missed calls.
- **Owners:** only 2 staff logins exist. "Owner" works for anyone with a staff login; a third person needs an account first.
- **Size:** this is a large rebuild. To limit risk it ships in phases, each verified before the next:
  - A: database tables + dry run + migration
  - B: Opportunities board + drawer
  - C: Contacts + Smart Lists
  - D: Tasks + Dashboard
  - E: Conversations
  - F: Reports / Settings move, retire the old page
- **Reversible:** new columns and tables can be ignored or emptied without touching existing lead data. The old Lead Tracker keeps working until phase F.

## Technical details

- Routes: `src/routes/_authenticated/crm.tsx` (layout with sidebar + `<Outlet/>`), plus `crm.index.tsx`, `crm.conversations.tsx`, `crm.opportunities.tsx`, `crm.contacts.tsx`, `crm.tasks.tsx`, `crm.appointments.tsx`, `crm.reports.tsx`, `crm.settings.tsx`. The drawer is driven by a `?contact=<id>` search param so it works from any page.
- Shared logic in `src/lib/crm/` (`stage-mapping.ts`, `attention.ts` extending `lead-command-center.ts`, `smart-lists.ts`) and server functions in `src/lib/crm/*.functions.ts` (requireSupabaseAuth + has_role).
- Drag and drop with `@dnd-kit/core`. Board data comes from TanStack Query with optimistic stage moves.
- Migration: one additive DDL migration (new tables/columns, grants, RLS). The data mapping runs as a staff-triggered server function with a dry-run mode that only reports, followed by the real run. It is idempotent: it skips contacts that already have opportunities.
- Lead insert paths (`insert-or-update-lead`, appointments, day pass, referrals) gain a small `recordSubmission()` call next to the existing alert call. Nothing else changes in them.
