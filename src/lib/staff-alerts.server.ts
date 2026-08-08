// Central configuration for internal staff / developer SMS alerts.
//
// Server-only (.server.ts is never bundled for the browser). Recipient
// numbers live in environment variables so no phone number is ever
// committed to source or shipped client-side.
//
// Env vars (see docs/staff-notifications.md):
//   STAFF_NOTIFICATION_PHONES  comma-separated list, e.g. "+19315550001,+19315550002"
//   DEVELOPER_NOTIFICATION_PHONE  single number for technical-only alerts
//   STAFF_ALERT_PHONE  legacy single number; still honored as a fallback
//
// This module only ever sends INTERNAL alerts. Customer-facing messaging
// stays in its own flows (sms.server.ts, referrals, free week, reminders).

export type StaffAlertAudience = "operations" | "developer";

function normalizeE164(raw: string): string {
  const trimmed = (raw ?? "").trim();
  if (trimmed.startsWith("+")) return "+" + trimmed.slice(1).replace(/\D/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function parseList(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((v) => v.trim())
    .filter(Boolean)
    .map(normalizeE164)
    .filter((v) => v.replace(/\D/g, "").length >= 10);
}

/** Deduplicated recipient list for the given audience. Read at call time. */
export function staffAlertRecipients(audience: StaffAlertAudience): string[] {
  const dev = parseList(process.env.DEVELOPER_NOTIFICATION_PHONE);
  if (audience === "developer") {
    // Fall back to the legacy single number so technical alerts never go dark.
    return Array.from(new Set(dev.length ? dev : parseList(process.env.STAFF_ALERT_PHONE)));
  }
  const ops = parseList(process.env.STAFF_NOTIFICATION_PHONES);
  const list = ops.length ? ops : parseList(process.env.STAFF_ALERT_PHONE);
  return Array.from(new Set(list));
}

async function sendOne(
  to: string,
  body: string,
): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) return { ok: false, error: "twilio_not_configured" };
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `twilio_${res.status}: ${text}` };
  }
  const json = (await res.json()) as { sid?: string };
  return { ok: true, sid: json.sid };
}

export type StaffAlertResult = {
  attempted: number;
  sent: number;
  failures: { to: string; error: string }[];
};

/**
 * Send one internal alert individually to every configured recipient.
 * No group thread; each number gets its own Twilio message, and one
 * failure never blocks the remaining recipients.
 */
export async function sendStaffAlert(
  message: string,
  audience: StaffAlertAudience = "operations",
): Promise<StaffAlertResult> {
  const recipients = staffAlertRecipients(audience);
  if (recipients.length === 0) {
    console.error(
      `[staff-alerts] no recipients configured for audience "${audience}" — alert not sent:`,
      message,
    );
    return { attempted: 0, sent: 0, failures: [] };
  }

  const results = await Promise.all(
    recipients.map(async (to) => {
      try {
        const r = await sendOne(to, message);
        if (!r.ok) {
          console.error(`[staff-alerts] send failed (${audience}) to ${to}:`, r.error);
        }
        return { to, ok: r.ok, error: r.error };
      } catch (err) {
        const error = err instanceof Error ? err.message : "send_exception";
        console.error(`[staff-alerts] send threw (${audience}) to ${to}:`, error);
        return { to, ok: false, error };
      }
    }),
  );

  const failures = results
    .filter((r) => !r.ok)
    .map((r) => ({ to: r.to, error: r.error ?? "unknown_error" }));
  return { attempted: results.length, sent: results.length - failures.length, failures };
}
