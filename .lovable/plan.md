# Why the two latest leads have no SMS on record

## What the data shows

The two newest leads are both self-claimed free weeks:

| Lead | Phone | Claimed | Code | Referral status | SMS log rows | last_sms_at |
|---|---|---|---|---|---|---|
| Saul Antunez | 910-364-6633 | Aug 9, 5:52 PM CT | ESFHJAMJGT | sent | none | empty |
| Mackenzie Jones | 931-314-4616 | Aug 9, 2:09 PM CT | P7ATJGR2S2 | sent | none | empty |

Two things are confirmed from the records:

1. **The app believed the text sent.** In the claim flow, the lead record is only
   created after the text send returns success, so Twilio accepted both messages
   with a success response. Both leads exist, so both sends were accepted.
2. **Nothing was written to the conversation log for either one.** So there is no
   delivery status, no message ID, and no way to tell from our side whether the
   carrier actually delivered the two texts. This is a visibility gap, not proof
   the texts failed. The same gap is why Bailey Morgan's code text had to be
   backfilled by hand earlier.

Also worth noting: this claim path never writes `last_sms_at` or
`last_contacted_at` on the lead, which is why both leads look like they were
never texted in the Lead Tracker even though a code went out.

Unconfirmed: whether the carrier delivered the messages or dropped them
(landline, unreachable handset, or carrier filtering). That requires reading
Twilio's own record for the two message IDs, which we did not store.

## Step 1 — Confirm delivery (do this first)

Add a small admin-only lookup that asks Twilio for the recent messages sent to a
given phone number and shows status plus error code. Run it for both numbers.
That tells us definitively whether Saul and Mackenzie received their codes or
whether the carrier rejected them, and produces the error code if it failed.

## Step 2 — Close the logging gap

- Make the free-week code send always write a conversation-log row (accepted or
  failed), with the Twilio message ID so delivery callbacks can attach status.
- Have the free-week claim path write `last_sms_at`, `last_contacted_at`, and
  `last_contact_method` on the lead, matching the behavior the manual reply and
  re-engagement campaign already have.
- When a send is rejected, still create the lead, mark the referral so staff can
  see the text never went out, and send an operations alert so nobody is left
  waiting on a code that never arrived.

## Step 3 — Backfill

Once Twilio's records are read, write the two historical messages into the
conversation log with their real timestamps and delivery status, and set the
contact fields on both leads so the Lead Tracker reflects reality.

## Technical notes

- Send path: `createReferral` in `src/lib/referrals.ts` (self-referral branch),
  which calls `sendPromoSms` in `src/lib/sms.server.ts`.
- `sendPromoSms` already logs live sends to `sms_conversation_log`; the two rows
  are missing, so either the published build predates that change or the insert
  failed silently. Step 1 also verifies which, and Step 2 adds an explicit error
  log on the insert so it can never fail silently again.
- Lead contact-state writes reuse `advanceFollowUpIfStale` from
  `src/lib/follow-up.ts` for consistency with the other SMS paths.
- Delivery status arrives through the existing Twilio status callback, which
  matches on `provider_message_id` — that is why storing the message ID matters.
- Operational alerting uses `sendStaffAlert` from `src/lib/staff-alerts.server.ts`.
