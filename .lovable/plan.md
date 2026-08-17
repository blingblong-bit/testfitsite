# Yes — the same problem exists in three other places

The drip fix I just shipped only paces the drip against itself. The audit plus the last 30 days of real message logs show three more spots that can stack texts on the same person, and two spots that send at night.

## What the message log actually shows

- **Aug 17, 1:00pm Chicago — one person got 4 texts in the same hour**: the drip and the post-trial "your free week ended" nudge both fired for the same phone. Each job thinks it's behaving, because neither one looks at what the other job sent.
- **Aug 10, 12:00pm — 3 promo texts in one hour** to the same phone (code sent, arrival pending, week activated). Those are legitimate separate events, but nothing stops them landing back-to-back.
- **Late-night sends on record**: 9–10pm Chicago (appointment confirmations, member-sync welcome, post-trial nudges). Only the drip currently respects quiet hours.
- **Missed-call text-back has no cooldown at all**: five missed calls in five minutes = five text-backs.

## The fixes

### 1. One shared pacing rule instead of per-job rules
Add a small shared helper both automated jobs call before sending: "has this phone gotten an automated text in the last N hours?" — checked against the actual outbound message log, not each job's own counter. Automated marketing-style texts (drip, post-trial nudge, re-engagement) respect a 24-hour floor per person, across all jobs.

Transactional texts stay exempt, because they must arrive immediately: appointment confirmations and reminders, free-week code / arrival / activation, referral rewards, welcome-on-join, staff-initiated manual texts, and inbound AI replies.

### 2. Quiet hours for every automated job, not just the drip
Apply the 9:00am–7:00pm Chicago window to the post-trial nudge loop and the member-sync welcome text. Appointment reminders keep their existing narrow windows (they're already time-bounded and time-critical). If a nudge comes due at 2am, it waits for morning.

### 3. Missed-call text-back cooldown
Don't text the same number back more than once per hour. Repeat calls inside that window still get logged on the lead, they just don't retrigger a text.

### 4. Close the duplicate-welcome race
The member-sync welcome text guard reads `last_sms_at`, then sends, then writes it — so two overlapping sync runs can both slip through and send twice. Switch it to the conditional-claim pattern already used correctly in the referrer reward code (claim the row first, only send if the claim won).

## Technical notes

- New shared helper (Chicago-time quiet hours + last-automated-outbound lookup) usable from both the Deno edge functions and the TanStack server routes; the drip's existing in-file logic gets replaced by it so there's one definition.
- Pacing lookup keys on the last-10-digits of the phone against `sms_conversation_log` outbound rows, filtered to automated `metadata.kind` values (`drip`, `post_trial_nudge`, `free_week_reactivation`) so transactional traffic never blocks or gets blocked.
- Missed-call cooldown reads the most recent outbound row for that number with `kind = 'missed_call'`.
- Welcome-text race fix: `update leads set last_sms_at = now() where id = ? and last_sms_at is null` and only send when a row comes back.
- Confirmed cron jobs: `process-lead-followups` and `process-appointment-reminders` every 15 min, `antaris-member-sync` every 2 hours, month snapshot monthly.
- Touches `supabase/functions/antaris-member-sync/index.ts`, `supabase/functions/process-lead-followups/index.ts`, `src/routes/api/public/webhooks/twilio-missed-call.ts`, plus one new shared pacing module. Edge functions get redeployed.
