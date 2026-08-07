# Free-Week Promo — Test Plan

## Test-mode phone numbers

Reserved numbers (defined once in `src/lib/sms.server.ts`, mirrored in
`supabase/functions/antaris-member-sync/index.ts`):

```
9315550001  9315550002  9315550003  9315550004  9315550005
```

Any free-week SMS addressed to one of these is **not** sent to Twilio. It is
inserted into `sms_conversation_log` with:

- `status = "test_mode"`
- `body = "TEST MODE - SMS not sent | <exact body>"`
- `metadata = { kind, test_mode: true, sent_by: "free_week_promo" }`

`kind` values: `free_week_code`, `free_week_arrival_pending`,
`free_week_activated`, `free_week_reward_pending`,
`free_week_reward_extended`, `free_week_reward_applied`,
`post_trial_nudge` (from the sync function).

Inspect with:

```sql
select created_at, phone, status, metadata->>'kind' as kind, body
from sms_conversation_log
where status = 'test_mode'
order by created_at desc;
```

## Reward state model (`referrals.referrer_reward_status`)

| value | meaning |
| --- | --- |
| `null` | not evaluated |
| `skipped_self` | self-claim, nobody to reward |
| `no_referrer` | no usable referrer phone |
| `processing` | claim won, payout in flight (transient) |
| `pending` | reward EARNED, referrer hasn't activated their own week yet |
| `extended` | +7 days applied — terminal, never re-applied |
| `no_active_window` | legacy; still eligible for payout on activation |

## Cases

1. **Self claim, test number** — `/claim-free-week` → "For Myself", phone
   `9315550001`. Code returned; `free_week_code` row in the log; Twilio not
   called; lead created in Lead Tracker.
2. **Redeem** — `/redeem-referral` with the code → status becomes
   `arrival_pending`; `free_week_arrival_pending` logged.
3. **Staff confirm** — `/admin/free-week-arrivals` → Confirm. Status
   `redeemed`, `access_ends_at = now + 7d`, `free_week_activated` logged.
4. **Normal A → B reward** — A active, A refers B (`9315550002`), B redeems +
   staff confirms. B's referral row → `extended`; A's own row
   `access_ends_at` +7d; `free_week_reward_extended` logged to A.
5. **B arrives before A** — A claims but does not arrive. B confirmed → B's row
   `pending`, `free_week_reward_pending` logged to A. Then A arrives and staff
   confirms → B's row `extended`, A's window = 7 + 7 = 14 days,
   `free_week_reward_applied` logged.
6. **B, C, D all before A** — three `pending` rows; on A's activation A's
   window = 7 + 21 = 28 days, single `free_week_reward_applied` SMS saying
   +21 days, all three rows `extended`.
7. **Stacking onto active A** — B then C confirmed while A active → each adds
   7 days from `max(current access_ends_at, now)`, so extensions stack. D
   confirmed after the original 7 days but inside the extended window still
   stacks (base is the current end date).
8. **No double reward** — double-click Confirm, or re-run confirm: the second
   attempt fails the status guard (`arrival_pending` check) and the reward CAS
   (`is null` / `eq pending`) so no extra days are added. Verify
   `access_ends_at` is unchanged by the retry.
9. **Self-referral** — self claim confirmed → `skipped_self`, no reward SMS.
10. **Duplicate claim** — claim free week again with `9315550001` → rejected
    with "This phone number has already claimed the free week offer."
11. **Real phone still uses Twilio** — claim with a real number → no
    `test_mode` row; `status = 'sent'` behavior unchanged, delivery callback
    still fires.
12. **Deadline** — after `2026-09-08T04:59:59Z` free-week claims are refused.
13. **Day pass unchanged** — day-pass referral still requires Antaris member
    verification and still sends the referral email; no SMS behavior change.
14. **Post-trial nudge** — expire a test-number trial (`access_ends_at` in the
    past, `became_member = false`) and run the sync → nudge appears as
    `test_mode` with `kind = post_trial_nudge`.
