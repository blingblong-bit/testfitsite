# Free Week Double-Dip Verification

## What I checked

I read the whole free-week path (`src/lib/referrals.ts`: `createReferral`, `redeemReferral`, `confirmFreeWeekArrival`, plus `src/lib/referrer-reward.server.ts`) and queried the database: there are currently **zero** `promo_type = 'free_week'` rows, so this is a code-level verification, not a data audit.

## Result: partly protected

Protected today:

- Claim time. `createReferral` for `free_week` loads every existing free-week referral and rejects the new one if any row's `friend_contact` matches the last 10 digits of the phone being claimed for. So if someone claimed a week for themselves with phone X, a friend who later refers that same phone X is blocked with "This phone number has already claimed the free week offer." This check is shared by both the self-claim page and the refer-a-friend page.
- Self-referral rewards. A self-claim row is marked `is_self_referral`, and reward processing short-circuits to `skipped_self`, so nobody earns a referral bonus off their own claim.
- One redemption per code. `lookupReferral` / `redeemReferral` reject codes already `redeemed` or `arrival_pending`.

Gaps that would let one person end up with two weeks:

1. **Different phone number.** Dedup is phone-only for free week (email is optional in this flow). Someone who claimed with their cell can be referred at a second number (work line, spouse's phone) and get a second code — same name and email, no block.
2. **No check at check-in or at staff activation.** `redeemReferral` and `confirmFreeWeekArrival` validate only the referral row's status. Neither asks "does this person already have a redeemed or active free week?" So a code created for phone B but checked in with phone A / an email that already has an activated week still activates a second 7-day window. This also means the phone entered at check-in can differ from the one dedup ran against at claim time.

## Proposed fix

Add a single shared identity check and call it at all three points, so the same person is caught however they arrive.

1. New helper in `src/lib/referrals.ts` (server-side): `findPriorFreeWeek({ phone, email, name })` — returns any other `free_week` referral row whose `friend_contact` last-10 matches the phone, or whose `friend_email` matches case-insensitively, excluding the current row.
2. `createReferral` (free week): replace the phone-only duplicate scan with this helper so a matching email is blocked too, with the existing customer-facing wording.
3. `redeemReferral` (free week): before flipping to `arrival_pending`, run the helper against the name/email/phone the person just entered. If another row is already `arrival_pending` or `redeemed`, return a friendly message ("Our records show a free week has already been claimed for you — please see the front desk") and do not park the row or send SMS.
4. `confirmFreeWeekArrival`: final guard before opening the access window. If another `redeemed` free-week row exists for the same phone or email, return an error naming the conflict so staff sees it instead of silently granting a second week.

Staff can still override in person; the goal is that no self-service path grants a second week.

## Notes

- Referrer rewards are unaffected: extending an existing week by 7 days for a genuine referral stays as-is. This only stops a *second independent* free week for the same person.
- No schema change and no customer-facing redesign. Copy changes are limited to the new blocked-at-check-in message.
