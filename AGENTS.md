# Project rules

- Contacts are `public.leads` rows; sales attempts are `public.opportunities`. Why: one person can have several sales attempts over time without duplicate contacts.
- Opportunity status is derived from stage and enforced by the `trg_opportunities_stage_status` trigger; always write stage and matching status together. Why: won/lost can never drift out of sync.
- Only one open opportunity per contact + interest (partial unique index); won/lost opportunities are never reopened. Why: preserves sales history.
- New-lead opportunities and member wins are created by database triggers on `leads`, not app code. Why: every insert path (forms, staff, Antaris sync, old tracker) stays in sync automatically.
- Stage-triggered automations claim a unique `contact_activity.idempotency_key` before running. Why: retries and repeated moves can't send duplicate texts.
- Internal lead alerts dedupe on `lead_alert_log.submission_id`. Why: one alert per form submission, retries blocked.
- CRM migrations are versioned (`crm_migration_snapshot` + `crm_migration_ledger`) and resume only pending/failed rows. Why: safe recovery from partial failures.
- CRM contact lookup includes held contacts independently of opportunity queries, while pipeline results exclude review-flagged contacts. Why: staff can review a person without creating or displaying a sales attempt.
