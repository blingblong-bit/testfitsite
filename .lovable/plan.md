# New AI texting instructions for lead replies

Replace the assistant's rulebook with the sales-focused instructions provided, keep everything else about texting, lead tracking, and the CRM exactly as it is.

## What changes

1. **New rulebook**
   - The prospect prompt is rewritten with the supplied instructions: answer known questions immediately, one question at a time, 1-3 short sentences, no invented pricing or policies, never argue or pressure, never force a specific buyer into the free day pass, always answer the question before asking a next step.
   - The existing member prompt keeps its own purpose but inherits the same tone/answer-first and escalation rules.
   - Escalate (with a brief natural sentence, not silence) for discounts, negotiations, billing, cancellations, refunds, contract exceptions, complaints, competitor negotiations, and anything not covered by the approved information.

2. **Approved facts and pricing as trusted context**
   - One shared list of approved facts becomes the only thing the assistant may quote: address, phone, staffed hours, 24/7 keycard access, locker rooms and showers, sauna, tanning, classes, kickboxing, BJJ (adult and kids), personal training.
   - Approved pricing = everything published on the site: monthly plans (single, duo, duo +1, family, tanning only), paid-in-full options including the 1-week pass at $35, 1 month, 3/6 months, 1 year, duo/family annual, the $49.99 annual fee, and the $10 day pass.
   - Anything not on that list gets "I'll have someone confirm that for you" plus a staff alert.
   - The staff page at Staff Portal → AI Reply Rules will show both the rules and the approved facts/pricing exactly as the assistant sees them, so wording can be reviewed in one place.

3. **High-intent leads**
   - When someone says they want to join, buy a specific pass, start today, or asks how to sign up, the assistant answers, asks one next-step question, and the lead is flagged.
   - You get an immediate staff text ("HIGH-INTENT LEAD — interested in 1-week pass") and the lead shows a HIGH INTENT badge and sorts to the top of the Lead Tracker until you clear it.

4. **Lost-lead reasons**
   - When someone says they went elsewhere, the reply is short and polite, and the reasons are recorded (competitor, price, availability/response speed, location, schedule, other) — multiple reasons when they give multiple.
   - Status is not changed automatically; you still decide that in the tracker. Reasons appear on the lead card and in the staff alert.

5. **Unchanged**
   - Twilio sending/receiving, quiet hours, daily send caps, drip sequences, conversation history, appointment scheduling and reminders, day pass and free-week flows, analytics.
   - Operational "right now" questions (broken equipment, are you open, class canceled, lost item, cleanliness) keep going straight to staff with no AI reply.

## Technical notes

- New `src/lib/gym-facts.ts`: approved facts + pricing table, mirrored inline in `supabase/functions/twilio-inbound-sms/index.ts` (separate Deno runtime).
- Rewrite the prompt builders in `supabase/functions/twilio-inbound-sms/index.ts`; extend the JSON contract Claude returns to `{ reply, needs_human, reason, high_intent, high_intent_note, lost_reasons }` and keep the existing strict-JSON parsing, retry, and durable error logging.
- Keep `classifyInquiry` for the operational hard-stop and for logging `inquiry_type`; the per-inquiry playbook in `src/lib/ai-reply-rules.ts` is replaced by the new rulebook, and the free-pass rule becomes conditional (unsure/comparing leads only).
- Migration on `leads`: `high_intent boolean not null default false`, `high_intent_note text`, `high_intent_at timestamptz`, `lost_reasons text[]`. No new table, no RLS change (existing lead policies cover it).
- High-intent alert uses the existing staff-alert path (`STAFF_NOTIFICATION_PHONES`); it is sent in addition to, not instead of, existing escalation alerts, and is sent once per lead per intent change to avoid spam.
- `src/routes/_authenticated/admin.leads.tsx` + `src/lib/lead-priority.ts`: HIGH INTENT badge, top-of-list sort, "clear flag" control, lost-reason chips.
- `src/routes/_authenticated/admin.ai-reply-rules.tsx` renders the new rules plus the approved facts/pricing.
- Redeploy `twilio-inbound-sms`; verify by replaying real message samples (week-pass buyer, showers question, competitor loss) through the deployed function.
