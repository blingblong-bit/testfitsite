# Staff / developer SMS notifications

Internal alerts are sent through Twilio **individually to each recipient** — no
group MMS thread. Recipients are configured entirely server-side via environment
variables; no phone number is committed to source or exposed to the browser.

## Environment variables

| Variable | Required | Example | Purpose |
| --- | --- | --- | --- |
| `STAFF_NOTIFICATION_PHONES` | yes | `+19315550001,+19315550002,+19315550003` | Comma-separated list of all operational staff (owner, dad, gym manager). Parsed, normalized to E.164, deduplicated. |
| `DEVELOPER_NOTIFICATION_PHONE` | yes | `+19315550001` | Single number for technical/developer-only alerts. |
| `STAFF_ALERT_PHONE` | legacy | `+19315550001` | Old single-number variable. Still honored as a fallback if the two above are unset, so nothing goes dark mid-deploy. Safe to remove once the new vars are set. |

Set these in both places, since two runtimes send alerts:
- Lovable project secrets (used by TanStack server functions / API routes)
- Supabase Edge Function secrets (used by `twilio-inbound-sms`)

Twilio credentials (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
`TWILIO_FROM_NUMBER`) are unchanged.

## Helper

```ts
import { sendStaffAlert } from "@/lib/staff-alerts.server";

await sendStaffAlert("⚡ Something needs a human at the desk.", "operations");
await sendStaffAlert("Webhook signature verification failed.", "developer");
```

- `operations` → every number in `STAFF_NOTIFICATION_PHONES`
- `developer` → `DEVELOPER_NOTIFICATION_PHONE` only

Each recipient gets its own Twilio request. A failure to one number is logged
(`[staff-alerts] send failed …`) and never blocks the others; the helper returns
`{ attempted, sent, failures }`. The edge function `twilio-inbound-sms` mirrors
this helper inline because it runs in Deno and cannot import from `src/`.

## Current routing

**Operational staff (all configured numbers)**
- New tour / day-pass appointment request needs approval — `src/lib/appointments.functions.ts`
- Inbound lead text needs a real human response (incl. existing members) — `supabase/functions/twilio-inbound-sms/index.ts`

**Developer only**
- No alerts wired yet. Use `sendStaffAlert(msg, "developer")` for backend
  failures, webhook failures, and technical exceptions staff can't act on.

Customer-facing messaging (lead sequences, referrals, free week, appointment
reminders) is untouched and never goes to the staff list.
