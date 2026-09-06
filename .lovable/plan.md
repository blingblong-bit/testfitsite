# Tighten Claude's inbound SMS response rules by inquiry type

## What we confirmed

The inbound SMS handler (`supabase/functions/twilio-inbound-sms/index.ts`) already uses separate prospect/member system prompts and has good guardrails: operational handoff regex, `needs_human` escalation, suppressed AI replies on handoff, and durable error logging. The prompts are just too generic — they don't give Claude concrete examples for pricing, schedule, membership, day pass, or complaint scenarios, which is why replies sometimes drift or promise follow-ups without escalating.

## What we'll build

1. **Add an inquiry-type classifier before the Claude call**
   - Lightweight keyword/regex classifier (no extra AI call) that labels each inbound text as one of:
     - `pricing`, `schedule_classes`, `membership_options`, `day_pass_tour`, `complaint_frustrated`, `general_info`, `operational`.
   - `operational` already hard-stops to staff; the label is added to the prompt context for everything else.

2. **Rewrite the system prompts with per-inquiry rules and examples**
   - Keep AI-generated replies (not fixed templates), but add a "Response playbook" section to both prompts.
   - Each inquiry type gets:
     - What to say (with 1-2 example phrasings).
     - What never to say (e.g. no exact prices, no medical advice, no "call the front desk" non-answers).
     - When to set `needs_human: true`.
   - Examples:
     - **Pricing** → "I can have someone reach out with exact pricing, or you can stop by for a free tour. Which works better?" (and set `needs_human`).
     - **Schedule/classes** → "Our class schedule is at fitbeyondplus.com/classes. Want me to have someone confirm what's running today?" (and set `needs_human` for "today/tonight" questions).
     - **Day pass/tour** → Point to the personalized `schedule-visit?lead=<id>` link; offer to set up a visit.
     - **Complaint/frustrated** → Apologize briefly, set `needs_human`, reply null.
   - Member prompt mirrors the same playbook but skips sales language and adds account/billing escalation.

3. **Strengthen the "promise of follow-up" detection**
   - Expand `HANDOFF_PATTERNS` to catch more variations like "I'll look into it", "we can check", "someone will contact you".
   - Add a second safety net: if the AI returns a reply containing "I don't have real-time", "I don't know", "call the gym", or "stop by the desk", suppress it and escalate instead.

4. **Add a small staff-facing "AI reply rules" reference page**
   - New route under `/admin/ai-reply-rules` (protected) that renders the current playbook in plain text so staff can read and suggest edits without touching code.
   - Pulls the same markdown copy the prompt is built from, so the displayed rules are always what Claude sees.

5. **Test with real conversation samples**
   - Use a few recent lead threads (with any PII redacted) to verify the new prompt produces appropriate, consistent replies.
   - Log suppressed replies and escalation reasons so we can measure improvement.

## What we will NOT change

- No fixed templates; the user wants AI-generated replies with tighter rules.
- No change to the existing operational hard-stop or quiet-hours pacing.
- No new model or provider; we keep Claude Sonnet via Anthropic API.

## Technical notes

- File to change: `supabase/functions/twilio-inbound-sms/index.ts` (prompt construction + classifier + handoff patterns).
- New file: `src/routes/_authenticated/admin.ai-reply-rules.tsx` for the staff reference page.
- Edge function must be redeployed after prompt changes.
- All changes are server-side; no browser secrets or model keys exposed.
