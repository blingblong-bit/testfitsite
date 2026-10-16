# Roadmap

## Vendor solicitation cleanup
- [ ] Tighten submission filtering with server-side enforcement and regression tests.
- [ ] Reclassify the five confirmed sellers, stop their follow-up, and close only their open sales attempts.
- [ ] Verify filtering and CRM cleanup without sending customer messages.

- [x] Monthly class check-in export (CSV + Excel, grouped by date and class, with totals)
- [x] Lead Command Center V2 — automation-first attention queue and follow-up view
- [ ] Write class check-ins into Antaris — blocked: the Antaris client is read-only and we need a documented Antaris check-in/attendance write endpoint before this can be built.

## FIT CRM redesign
- [x] Phase A — backup, schema, dry run, migration, reconciliation
- [x] Phase B — Opportunities board + contact drawer
- [x] Phase B usability review — desktop/phone searches, drawers, filters, stage overview, held review contacts; no customer moves or texts
- [x] Phase C — Contacts + Smart Lists; global search, removable chips, Clear all, existing drawer verified on desktop/440px/375px; 77 contacts, 4 held, 63 opportunities, zero data changes or texts
- [x] Phase D — Tasks + daily Dashboard; six operational filters, deduplicated attention, manual task create/edit/complete/reopen and contact/opportunity links verified on desktop/440px/375px; QA task removed, 77 contacts/42 nurture/4 held unchanged, no texts
- [x] Phase D approved — CRM V1 complete; development paused for ~1 week of real operational use
- [x] Staff Portal tile changed from "Lead Tracker" to "CRM" (opens /crm; the lead tracker lives inside the CRM)

## Operations week (log issues; one focused revision afterward)
- [ ] Manually resolve the four Migration Review contacts: Haleigh Woodcox, Toye Ray, Seth Vaughn, Luz Sanchez
- [ ] Collect operational notes for ~1 week: anything confusing, slow, missing, or incorrect in the CRM
- [ ] One focused revision pass from the collected notes — no feature expansion
- [ ] Later — Conversations inbox, page relocation
