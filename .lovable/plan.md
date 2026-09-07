# New AI texting instructions for lead replies

Replace the assistant's rulebook with the sales-focused instructions provided, keep everything else about texting, lead tracking, and the CRM exactly as it is.

## What changes

1. **New rulebook**
   - The prospect prompt is rewritten with the supplied instructions: answer known questions immediately, one question at a time, 1-3 short sentences, no invented pricing or policies, never argue or pressure, never force a specific buyer into the free day pass, always answer the question before asking a next step.
   - The existing member prompt keeps its own purpose but inherits the same tone/answer-first and escalation rules.
   - Escalate (with a brief natural sentence, not silence) for discounts, negotiations, billing, cancellations, refunds, contract exceptions, complaints, competitor negotiations, and anything not covered by the approved information.

2. **One source of truth for approved facts and pricing**
   - `src/lib/gym-facts.ts` is the canonical list: address, phone, staffed hours, 24/7 keycard access, locker rooms and showers, sauna, tanning, classes, kickboxing, BJJ (adult and kids), personal training — plus all published pricing: monthly plans (single, duo, duo +1, family, tanning only), paid-in-full options including the 1-week pass at $35, 1 month, 3/6 months, 1 year, duo/family annual, the $49.99 annual fee, and the $10 day pass.
   - The texting assistant consumes that same file if the messaging runtime can import it. If it can't, the data is mirrored with a loud warning comment in both places naming the canonical file, so the staff page and the assistant can never quietly drift apart.
   - Staff Portal → AI Reply Rules shows the exact rules and the exact facts/pricing the live assistant receives.
   - Annual fee: the approved data spells out which memberships it applies to, which are exempt (paid-in-full, short-term passes), and when it's charged. Anything about the fee that isn't spelled out gets "I'll have someone confirm that for you" plus a staff alert — no guessing. **I need your exact annual-fee wording before this ships; if you don't give it, the assistant will escalate every annual-fee question rather than answer.**
   - Anything not on the approved list (student discounts, custom deals, payment exceptions) is always escalated, never invented.

3. **High-intent leads**
   - Wanting to join, buy a specific pass, start today, or asking how to sign up: the assistant answers, asks one next-step question, and the lead is flagged HIGH INTENT with a short note.
   - The note updates as their intent develops; a new staff text is sent only when the intent materially changes (week pass → monthly, browsing → ready today, tour → how do I pay, pricing question → wants to buy). Minor rewording sends nothing.
   - The badge shows in the Lead Tracker and sorts the lead to the top until you clear it.

4. **Lost reasons, objections, and competitors**
   - Status is never changed automatically — you always decide that.
   - The assistant tells apart an objection ("Planet Fitness is cheaper" → still active, recorded as a price objection, no argument, escalate if it turns into negotiating), a comparison ("I'm comparing you two" → still active, answer normally), and an actual loss ("I already joined Planet Fitness because they were cheaper" → short polite reply, reasons recorded: competitor + price).
   - Multiple reasons are recorded when given, e.g. "nobody could meet me yesterday" adds availability/response speed.
   - Reasons and objections appear on the lead card and in the staff alert.

5. **Operational hard-stops with real context**
   - Broken equipment, "is the sauna working today", cancellations, lost items, cleanliness, access problems still bypass the assistant entirely.
   - The staff text now includes the person's name, their phone, the exact message they sent, what kind of question it is, and a direct link to that lead in the tracker — nothing to hunt for.

6. **Staff takeover protection**
   - Today a manual staff text pauses the drip, but the assistant can still auto-reply into a conversation you're handling. That gets fixed: after a staff-sent text, inbound replies for the next several hours go straight to you with no automated reply, no free-pass or tour re-offer, and no drip restart.

7. **Unchanged**
   - Twilio sending/receiving, quiet hours, daily send caps, drip sequences, conversation history, appointment scheduling and reminders, day pass and free-week flows, analytics.

## Testing before this goes live

All 15 samples are replayed through the deployed texting logic (not a prompt preview), checking both the customer reply and the internal actions: membership pricing, week-pass buyer, showers, "can I come today", cheaper rate, cancellation, competitor objection vs. actual loss (two variants), sauna hard-stop, week pass + showers together, student discount, pay-tomorrow, "just looking", monthly membership. Then: HIGH INTENT visible in the tracker, alerts landing on the staff numbers, lost reasons saved without status change, takeover blocking auto-replies, hard-stops still bypassing the assistant, and the untouched flows (sequences, reminders, day pass, free week, analytics) spot-checked. Any failure is reported before anything else is changed.

## Technical notes

- `src/lib/gym-facts.ts` = canonical `APPROVED_FACTS` + `APPROVED_PRICING` + `ANNUAL_FEE_POLICY`, rendered into prompt text by a shared builder. `supabase/functions/twilio-inbound-sms/index.ts` consumes it; if the Deno bundle can't reach `src/`, it mirrors the block with a `DO NOT EDIT WITHOUT SYNCING src/lib/gym-facts.ts` banner in both files.
- Claude's JSON contract becomes `{ reply, needs_human, reason, high_intent, high_intent_note, objections, lost_reasons, likely_lost }`; existing strict-JSON parsing, retry, and durable error logging kept. `likely_lost` never writes `crm_status`.
- Migration on `leads`: `high_intent boolean not null default false`, `high_intent_note text`, `high_intent_at timestamptz`, `lost_reasons text[]`, `objections text[]`. Existing lead RLS covers them.
- Material-change detection: compare the new note's intent bucket (pass / monthly / annual / tour / browsing / ready-to-join / payment) against the stored one; alert only on bucket change, always update the note.
- Takeover: query `sms_conversation_log` for the newest outbound row with `from_ai = false`; if within the takeover window, log a `system` row, alert staff with the inbound text, and send no AI reply. Drip senders already respect `sequence_status = 'paused'`.
- `classifyInquiry` stays for the operational hard-stop and `inquiry_type` logging; the per-inquiry playbook in `src/lib/ai-reply-rules.ts` is replaced by the new rulebook and the free-pass rule becomes conditional (unsure/browsing/comparing only).
- Alerts go through the existing `STAFF_NOTIFICATION_PHONES` path and include name, phone, verbatim message, inquiry type, and a `/admin/leads?lead=<id>` deep link.
- Lead Tracker (`admin.leads.tsx`, `lead-priority.ts`): HIGH INTENT badge, top-of-list sort, clear-flag control, objection/lost-reason chips.
- Redeploy `twilio-inbound-sms`; run the 15 samples against the deployed function.
