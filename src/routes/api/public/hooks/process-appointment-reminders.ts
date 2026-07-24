import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { formatChicagoTime, formatChicagoDateTime } from "@/lib/appointment-availability";

// Runs every 15 minutes via pg_cron. Sends day-before / morning-of / hour-before
// reminders for confirmed appointments. Same pattern as process-lead-followups.
//
// All time math is anchored in America/Chicago to match the rest of the system.

function firstName(name: string | null): string {
  if (!name) return "there";
  return name.trim().split(/\s+/)[0] || "there";
}

function normalizePhoneE164(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return "+" + trimmed.slice(1).replace(/\D/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

async function sendTwilioSms(
  to: string,
  body: string,
): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) return { ok: false, error: "twilio_not_configured" };
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: to,
        From: from,
        Body: body,
        StatusCallback:
          "https://pjntdyhshxwhsxnwjylk.supabase.co/functions/v1/twilio-status-callback",
      }),
    },
  );
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, error: `twilio_${res.status}: ${t}` };
  }
  const json = (await res.json()) as { sid?: string };
  return { ok: true, sid: json.sid };
}

// Returns the current wall-clock hour and minute in America/Chicago.
function chicagoHourMinute(now: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  return { hour: get("hour") % 24, minute: get("minute") };
}

// True if two ISO timestamps fall on the same Chicago calendar day.
function sameChicagoDay(aIso: string, bIso: string): boolean {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date(aIso)) === fmt.format(new Date(bIso));
}

export const Route = createFileRoute("/api/public/hooks/process-appointment-reminders")({
  server: {
    handlers: {
      POST: async () => {
        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        );

        const nowIso = new Date().toISOString();
        // Look up to 26 hours ahead to cover day-before + morning-of + hour-before.
        const horizonIso = new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString();

        const { data: appts, error } = await supabase
          .from("appointments")
          .select("id, lead_id, name, phone, confirmed_time, reminders_sent")
          .eq("status", "confirmed")
          .gte("confirmed_time", nowIso)
          .lte("confirmed_time", horizonIso);

        if (error) {
          console.error("[process-appointment-reminders] query failed", error);
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        const now = new Date();
        const nowMs = now.getTime();
        const results: Array<Record<string, unknown>> = [];

        for (const appt of appts ?? []) {
          try {
            if (!appt.confirmed_time || !appt.phone) continue;
            const to = normalizePhoneE164(appt.phone);
            const fn = firstName(appt.name);
            const timeStr = formatChicagoTime(appt.confirmed_time);
            const targetMs = new Date(appt.confirmed_time).getTime();
            const diffMs = targetMs - nowMs;
            const reminders = (appt.reminders_sent ?? {}) as Record<string, unknown>;

            let kind: "day_before" | "morning_of" | "hour_before" | null = null;
            let body = "";

            // Day-before: 24-25 hours away.
            if (
              !reminders.day_before &&
              diffMs > 24 * 60 * 60 * 1000 &&
              diffMs <= 25 * 60 * 60 * 1000
            ) {
              kind = "day_before";
              body = `Hey ${fn}, just a reminder — you're coming in tomorrow at ${timeStr} for your visit to FIT Beyond Plus!`;
            }
            // Morning-of: same Chicago day, between 8:00-8:15am Chicago.
            else if (!reminders.morning_of && sameChicagoDay(nowIso, appt.confirmed_time)) {
              const { hour, minute } = chicagoHourMinute(now);
              if (hour === 8 && minute < 16) {
                kind = "morning_of";
                body = `Hey ${fn}, see you today at ${timeStr}!`;
              }
            }

            // Hour-before: 55-65 minutes away. (Check after morning_of so both can fire on the same run for edge cases where the appt is at ~9am.)
            if (
              !kind &&
              !reminders.hour_before &&
              diffMs > 55 * 60 * 1000 &&
              diffMs <= 65 * 60 * 1000
            ) {
              kind = "hour_before";
              body = `Hey ${fn}, see you in about an hour at ${timeStr}! We're at 449 W Lincoln St, Tullahoma.`;
            }

            if (!kind) continue;

            const send = await sendTwilioSms(to, body);
            if (!send.ok) {
              console.error(
                `[process-appointment-reminders] send failed appt=${appt.id} kind=${kind}`,
                send.error,
              );
              results.push({ id: appt.id, kind, ok: false, error: send.error });
              continue;
            }

            const updated = { ...reminders, [kind]: true };
            await supabase
              .from("appointments")
              .update({ reminders_sent: updated })
              .eq("id", appt.id);

            if (appt.lead_id) {
              await supabase.from("sms_conversation_log").insert({
                lead_id: appt.lead_id,
                phone: to,
                direction: "outbound",
                body,
                from_ai: false,
                provider_message_id: send.sid ?? null,
                status: "sent",
                metadata: { kind: `appt_reminder_${kind}`, appointment_id: appt.id },
              });
            }

            results.push({ id: appt.id, kind, ok: true, sid: send.sid });
            // Discourage unused-import warning while keeping formatChicagoDateTime handy.
            void formatChicagoDateTime;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[process-appointment-reminders] appt ${appt.id} exception`, msg);
            results.push({ id: appt.id, ok: false, error: msg });
          }
        }

        return Response.json({ ok: true, checked: (appts ?? []).length, results });
      },
    },
  },
});
