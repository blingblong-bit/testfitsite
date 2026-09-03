# Fix the failing lead texts, then catch up and personalize them

## What I confirmed

I tested the gym's texting account directly with the credentials the app is using. Twilio rejected them: HTTP 401, error 20003 "Authenticate". That is an account/credential-level rejection, not a per-message or per-number problem — which is why every automated text is failing at once (roughly 100 failed attempts in the edge job logs).

Good news on the damage: the follow-up job only records a text and advances the lead's step counter *after* Twilio accepts it. Nothing was marked as sent, so no lead permanently lost their place in the sequence. Only 3 outbound rows in the last 3 days are marked failed; the drip failures never reached the database.

Important: adding funds may not by itself clear a 401. A suspended/unfunded account and a rotated or wrong Auth Token both surface as 20003. So step 1 has two parts — fund the account, then re-verify the credentials and update them here if they changed.

## Step 1 — Restore texting (must happen first)

1. Add funds to the Twilio account.
2. I re-run the same live credential check. If it returns 200, credentials are fine and texting is back.
3. If it still returns 401, the Account SID / Auth Token no longer match. I'll ask for a fresh Auth Token from the Twilio console and update the stored secret, then re-verify.
4. Confirm the sending number (931) 588-0490 is still active on the account and A2P-registered.
5. Once verified: send one real test text (to your own number) end to end, confirm it logs to the conversation history with a delivered status via the status callback.

Everything else below stays blocked until this check returns 200 — there is no point sending catch-ups into a rejecting account.

## Step 2 — Catch-up texts to the leads who got skipped

Once sending is verified:

- Build a one-time catch-up pass over the leads that were due a follow-up or post-visit check-in during the outage window (job logs plus lead step counters identify them exactly).
- Each affected lead gets exactly one text, the correct next step in their sequence — not a stack of everything they missed.
- Still respects the existing guardrails: 9:00am–7:00pm Chicago, opted-out and converted-member leads excluded, one automated text per person per day.
- Run as a staff-triggered preview-then-send action (same pattern as the re-engagement tool) so you see the exact list and messages before anything goes out.
- After the catch-up, the normal 15-minute job resumes on its own cadence.

## Step 3 — Make the follow-up texts genuinely personalized (templates, not AI)

Today the drip has 4 generic follow-ups; only one of them uses the lead's stated interest, and it splices raw form text into the sentence ("wanting to <whatever they typed>"), which reads awkward. Post-visit check-ins use no lead detail at all.

The fix, keeping messages fixed and predictable:

- Map each lead's interest/source into a small set of clean categories: kickboxing, BJJ (adult/kids), personal training, group classes, weight loss / general fitness, day pass / walk-in, referral.
- Write a short message set per category for each drip step, so a kickboxing lead hears about kickboxing and a BJJ parent hears about the kids program — instead of one generic line for everyone.
- Add source-aware variants: a day-pass visitor's post-visit text references their visit; a referral lead references the friend who sent them.
- Never splice raw form text into a sentence again; unrecognized interests fall back to a clean generic line.
- No pricing claims in any variant (matches the existing rule for the AI replies).
- Add a staff-visible preview of the exact message set so you can read and approve the copy before it's live.

## Technical notes

- Live check performed: `GET /2010-04-01/Accounts/{sid}.json` → 401 / code 20003. Secrets in play: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, shared by `process-lead-followups`, `send-initial-lead-sms`, `twilio-inbound-sms`, `antaris-member-sync`, `send-schedule-link-sms`, the appointment-reminder route, and `src/lib/sms.server.ts`.
- Credential update, if needed, is a secret update only — no code change; edge functions pick it up on next invocation.
- Catch-up implemented as a new server function plus a small admin panel section, reusing `src/lib/sms-pacing.ts` guardrails; it advances `followup_count` and writes `sms_conversation_log` on success only, same as the cron job.
- Personalization lives in one shared copy module (interest/source → variant), imported by the TanStack side and mirrored into `supabase/functions/process-lead-followups/index.ts` (separate Deno runtime cannot import from `src/`), following the existing mirrored-constants convention.
- Also worth fixing while in there: `process-lead-followups` currently logs nothing to the database when Twilio rejects a send, which is why this outage was invisible in the Lead Tracker. Failed sends will be written with `status: 'failed'` so the next outage is visible without reading function logs.
