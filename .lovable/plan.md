# Match the first text to what the lead actually asked for

Right now the very first automated text offers a free day pass to almost everyone, including people who said outright they want a membership. That sends buyers backward. This changes the first text (and the follow-ups) to answer the stated intent instead.

## What changes

1. **High purchase intent gets a direct sales reply, no day pass**
   Triggers: wants a membership, interested in a specific plan (single/duo/family), asking how to sign up, wanting to join, or asking membership pricing.
   Reply pattern:
   "Hey Robert! This is FIT Beyond Plus — thanks for reaching out about a membership. Single memberships are $39/month. Would you like to come by and get set up?"
   - Pricing quoted only from the approved list already used by the texting assistant ($39 single, $59 duo, $69 duo+1, $82 family, $449 paid-in-full year). When they named a specific plan, quote that one; when they only said "membership", quote the single rate.
   - No free-pass offer, no "come try it first", no extra step before signing up.

2. **Free visit stays for exploratory leads only**
   Unsure, just looking, comparing gyms, "can I check it out", asking for a tour or a day pass, or an interest with no buying language: these still get the come-see-the-place invite, as today.

3. **Class and combat-sports leads keep their try-a-class invite**
   Someone asking about kickboxing, BJJ, kids classes, or group classes is asking to try something, so the current "come try a class" offer stays — unless they also state buying intent, in which case intent wins and they get the membership reply with the class mentioned.

4. **Follow-up texts respect the same intent**
   A high-intent lead's follow-ups stop re-offering a free visit and instead nudge toward getting set up ("want me to have you set up when you come in?"). Exploratory leads keep the current follow-up copy.

5. **Retired free-week language removed from the last follow-up**
   The 4th follow-up still says "try FIT Beyond Plus free for 7 days"; the promo is retired, so that gets replaced with a normal come-in invite.

6. **Unchanged**
   Sending times, quiet hours, daily caps, day-pass and walk-in flows, the inbound reply assistant's own rules, lead tracking, HIGH INTENT badges, analytics.

## Technical notes

- Add an intent classifier to `src/lib/followup-copy.ts` (`buying` vs `exploratory`) reading `interest` + `message`, plus a plan detector (single/duo/duo+1/family/annual) that maps to `APPROVED_PRICING` in `src/lib/gym-facts.ts`. No new AI call.
- `supabase/functions/send-initial-lead-sms/index.ts` `buildFirstMessage()` gains the buying branch ahead of the topic branches, with prices mirrored inline (Deno cannot import `src/`), carrying the existing sync-warning comment style.
- `supabase/functions/process-lead-followups/index.ts` mirrors the same intent split for steps 1-4 and drops the 7-day-free copy; keep it in sync with `followup-copy.ts`.
- Redeploy both functions, then dry-run the message builder across sample interests (membership, single membership, how do I sign up, pricing, kickboxing, BJJ kids, just looking, day pass, referral) and report each rendered text before anything sends.
