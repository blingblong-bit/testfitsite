# Project rules

- CRM manual-text submissions check the client session and always release their busy state in finally; keep the draft on failures and never automatically retry a send. Why: failed authentication must not freeze the composer or risk duplicate customer texts.
- Mount one shared notification presenter in the root layout. Why: success and failure messages from CRM actions must actually be visible.

- Lead-form classification is shared and recomputed server-side before saving; inspect message offer direction independently of selected interest and keep confirmed vendor domains exact. Why: dropdown choices and client flags must not let business pitches trigger customer outreach.

- Contacts are `public.leads` rows; sales attempts are `public.opportunities`. Why: one person can have several sales attempts over time without duplicate contacts.
- Opportunity status is derived from stage and enforced by the `trg_opportunities_stage_status` trigger; always write stage and matching status together. Why: won/lost can never drift out of sync.
- Only one open opportunity per contact + interest (partial unique index); won/lost opportunities are never reopened. Why: preserves sales history.
- New-lead opportunities and member wins are created by database triggers on `leads`, not app code. Why: every insert path (forms, staff, Antaris sync, old tracker) stays in sync automatically.
- Stage-triggered automations claim a unique `contact_activity.idempotency_key` before running. Why: retries and repeated moves can't send duplicate texts.
- Internal lead alerts dedupe on `lead_alert_log.submission_id`. Why: one alert per form submission, retries blocked.
- CRM migrations are versioned (`crm_migration_snapshot` + `crm_migration_ledger`) and resume only pending/failed rows. Why: safe recovery from partial failures.
- CRM contact lookup includes held contacts independently of opportunity queries, while pipeline results exclude review-flagged contacts. Why: staff can review a person without creating or displaying a sales attempt.
- Contacts and Smart Lists share a paginated, read-only directory query; global search clears list/filter context and searches all contacts, including test/spam. Why: no contact can disappear behind sales filters or query row limits.
- Daily CRM operations are derived read-only from paginated sources; staff task actions write only crm_tasks and never seed tasks on load. Why: operational views must not change sales history or trigger customer automation.
- Human contact requires an explicit staff/manual message, staff contact activity, or legacy non-text staff method; automated SMS timestamps are not evidence. Why: automatic outreach must not hide leads needing human follow-up.
- Call from FIT bridges calls through Twilio (staff phone first, then <Dial> the contact); crm_call_log is written only by server code and the signature-verified crm-call webhook, one active call per contact via partial unique index, one timeline entry per call via contact_activity idempotency_key. Why: no duplicate calls, no exposed numbers, no timeline flooding.
