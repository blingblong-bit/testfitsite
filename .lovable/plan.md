# Why the missed-call text only fired once

## What the phone records show

I pulled the call records for the texting number (931) 588-0490 directly.

- There is exactly **one inbound call in the entire account history**: Sep 13, 4:04pm Chicago, from (931) 571-3200 (Asa), 11 seconds, unanswered.
- That call arrived **on (931) 588-0490 itself** — the forwarding info points back at that same number, not at the gym's published line (931) 222-4449.
- Asa had already been texted from that number 20 minutes earlier (his lead follow-up), so he had it in his phone and called it back.

So nothing was broken and nothing "randomly" started working. The automatic text-back is wired up correctly on (931) 588-0490 and fired the moment a call actually landed there. The reason it has never fired before is that **the gym's main line (931) 222-4449 is not forwarding unanswered calls to (931) 588-0490**. Every real customer who calls the gym and gets no answer never reaches the system at all.

Confirmed working: the call hit the webhook, the text sent and was delivered, Asa was matched to his existing lead record with no duplicate created, and the conversation continued from there (5:30 visit offer, "Great see you soon!").

## What to fix

The missing piece is on the phone-carrier side, not in the app.

1. Turn on "forward on no answer" (usually after 4-5 rings) from the gym's main line (931) 222-4449 to (931) 588-0490 with the phone provider. That is the one change that makes this work for real callers.
2. Test it: call the gym's main number, let it ring out, confirm the text arrives and the caller shows up in the Lead Tracker.

## Optional improvements once forwarding is on

- Right now a caller who dials (931) 588-0490 directly hears the recorded "we're texting you now" message. Once forwarding is live that's the right behavior for missed calls, but worth a listen to confirm the wording still fits.
- Add a small staff-visible list of missed calls in the Lead Tracker so these are visible without me querying, including which ones matched an existing person and which created a new record.

## Technical notes

- Webhook: `src/routes/api/public/webhooks/twilio-missed-call.ts`, configured as the voice URL on (931) 588-0490 (`https://fitbeyondplus.com/api/public/webhooks/twilio-missed-call`, POST). Signature verification passed, so the call was genuine.
- Call `CA1b398c91871b1947274a83023c3d8601`: `from=+19315713200`, `to=+19315880490`, `forwarded_from=+19315880490`, direction inbound, duration 11s.
- The second account number (931) 588-8219 has no voice URL configured; it is not involved.
- Outbound text `SM4ebae98d15c3dc709bc0392236e12413` delivered; logged in `sms_conversation_log` with `metadata.kind = 'missed_call'` and `lead_id` set to Asa's existing lead. No `source = 'missed_call'` lead rows exist, confirming the dedupe path worked.
