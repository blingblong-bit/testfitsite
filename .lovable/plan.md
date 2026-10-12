# FIT CRM Redesign — final plan (Phase A authorized, Phase B after checks)

This is a simplified, FIT-specific take on GoHighLevel: Contacts, Opportunities, Tasks and a contact drawer. All nine revisions and three final safeguards are included.

## Scope of this approval

- **Phase A (now):** pre-migration backup, schema, dry run, real migration, reconciliation.
- **Phase B (only after Phase A checks pass):** Opportunities board and contact drawer at `/crm`.
- Phases C (Contacts and Smart Lists) and D (Tasks and Dashboard) follow later. Conversations and moving pages around come after that.
- Business Analytics, Referrals, Missed Calls, the old Lead Tracker and every other page stay exactly where they are.

## Three final safeguards

1. **Migration Review is a contact flag and a Smart List, not a pipeline stage.** The 4 questionable records get `review_flag = true` with a reason. No opportunity is created for them, and none of their existing fields change.
2. **Stage and status always match, enforced by the database.** A trigger on the opportunities table runs in the same transaction as every save:
   - Joined — Won must be won, and Closed — Lost must be lost.
   - Every other stage must be open.
   - Any mismatched save is rejected. `closed_at` is set and cleared automatically.
3. **A real backup, and a migration that can resume safely.**
   - Before anything is written, a full copy of all 73 lead rows is stored in `crm_migration_snapshot`, tagged with version `crm-v1`.
   - A per-record ledger (`crm_migration_ledger`) tracks each record as pending, done, failed or skipped_review.
   - Each record is migrated in its own transaction. A rerun only touches records that are pending or failed, so a partial failure resumes cleanly with no duplicates.
   - Everything the migration creates is tagged with `migration_version` and `legacy_lead_id`. Restoring means removing the rows tagged `crm-v1` and copying the backup columns back.

## Data model (additive only, nothing renamed or dropped)

- **Contact = the existing `leads` row.** New columns:
  - `contact_type`: Prospect / Member / Former Member / Vendor/Non-Sales / Spam
  - `original_source`: backfilled once, never overwritten
  - `latest_source`
  - `tags`
  - `owner_id`
  - `comm_pref`
  - `review_flag`, `review_reason`
- **`opportunities`:**
  - Columns: contact, pipeline "FIT Sales", stage, interest, status (open/won/lost), value, owner, source, no_action_required, last_activity_at, appointment, won/lost reason, closed_at, migration tags.
  - Interest is one of: Membership, Personal Training, Combat Sports, Classes, Day Pass, Free Week, Other.
  - Partial unique rule: only one open opportunity per contact and interest. Any number of historical won/lost opportunities are allowed.
- **`crm_tasks`:** contact, opportunity, type, title, due date, owner, completed.
- **`contact_activity`:** form submissions (with that submission's own source and UTMs), stage changes, notes, automations fired. It has a unique idempotency key so a stage-triggered automation never fires twice.
- Only staff and admins can access the new tables.

## Pipeline stages

1. New Lead
2. Attempting Contact
3. Engaged
4. Tour or Assessment Booked
5. Trial or Day Pass Active
6. Decision and Follow-Up
7. Long-Term Nurture
8. Joined — Won
9. Closed — Lost

Joined and Lost moves always ask for confirmation, and Joined lists the automations it will fire.

## Migration rules (applied in order)

1. Spam: contact type Spam, no opportunity.
2. Vendor: contact type Vendor/Non-Sales, no opportunity.
3. Conflicting or ambiguous record: review flag only, no opportunity.
4. Existing member already Joined: contact type Member, no opportunity.
5. Joined: Membership opportunity, won.
6. Lost Lead: lost.
7. Upcoming confirmed tour, or Tour Scheduled: Tour or Assessment Booked.
8. Active free week: Trial or Day Pass Active.
9. Tour completed with activity in the last 14 days: Decision and Follow-Up.
10. No response and no activity for 14+ days: Long-Term Nurture (open).
11. Inbound reply: Engaged.
12. Otherwise: Attempting Contact.

No tasks are created during migration.

## Dry run (exact, today)

| Result | Records |
|---|---|
| Long-Term Nurture (open) | 42 |
| Joined — Won | 8 |
| Attempting Contact | 7 |
| Engaged | 3 |
| Closed — Lost | 2 |
| Tour or Assessment Booked | 1 |
| Member contact, no opportunity | 3 |
| Spam contact, no opportunity | 3 |
| Review flag, no opportunity | 4 |
| **Total** | **73** |

The 4 flagged records:

- **Haleigh Woodcox:** her phone number is shared with another record.
- **Toye Ray:** her phone is undeliverable.
- **Seth Vaughn:** marked member, but status is "Tour Completed" and his texts are still running.
- **Luz Sanchez:** existing member marked "Waiting on Response".

## Phase A verification (reported before Phase B)

- All 73 lead records still exist, and the backup holds 73 rows.
- The real counts match the dry run, and every ledger row is done or skipped_review.
- 0 opportunities have a mismatched stage and status.
- The 4 flagged records are byte-identical to their backup apart from the new flag/reason columns.
- `original_source` matches the first-touch source for every record.
- Existing forms, alerts, texts and automations still work: the test lead alert sends once, the form handlers are unchanged, and there are no new errors in the logs.
- The old Lead Tracker still loads and works.

## Ongoing rules (wired in Phase B)

- **A returning form submission** logs an activity, updates `latest_source` only, and sends the RE-ENGAGED alert.
  - If an open opportunity for the same interest exists, its activity is bumped.
  - Otherwise a new opportunity is created. A won or lost opportunity is never reopened.
- **Antaris sync** can set the contact type to Member and mark an open Membership opportunity won only. It never touches other interests.

## Technical details

- **One additive DDL migration:** new columns on `leads`; the tables `opportunities`, `crm_tasks`, `contact_activity`, `crm_migration_snapshot` and `crm_migration_ledger`. This includes GRANTs, RLS with `has_role` staff/admin, the partial unique index, the stage/status sync trigger, and a unique activity idempotency key.
- **Security:** `crm_migration_snapshot` and `crm_migration_ledger` can be read only by admins (via `has_role(auth.uid(),'admin')`), not staff. All writes go through the service role only.
- **Migration logic:** a SQL function `public.crm_migrate_v1(dry_run boolean)`.
  - It is SECURITY DEFINER with `SET search_path = pg_catalog, public`, and every table reference is schema-qualified.
  - `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated`.
  - It runs the snapshot, then the ledger, then a per-lead subtransaction for each record.
  - It is run once as a dry run and once for real through a privileged migration step, then reconciled with read queries.
- **Phase B:** `src/routes/_authenticated/crm.tsx` layout, `crm.index.tsx`, `crm.opportunities.tsx` (Kanban with `@dnd-kit/core` plus a List toggle), and the drawer opened via `?contact=`. Server functions live in `src/lib/crm/*.functions.ts`.
