import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Db = SupabaseClient<Database>;

/**
 * Reserved development/testing phone numbers for the free-week promo.
 * These behave like normal 10-digit numbers everywhere in the system, but
 * any SMS addressed to them is written to sms_conversation_log instead of
 * being handed to Twilio (same convention as the antaris-member-sync
 * TEST_EMAIL bypass: status "test_mode", metadata.test_mode = true).
 *
 * Keep this list in sync with the copy in
 * supabase/functions/antaris-member-sync/index.ts (separate runtime).
 */
export const TEST_PHONE_NUMBERS = [
  "9315550001",
  "9315550002",
  "9315550003",
  "9315550004",
  "9315550005",
] as const;

export function last10(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "").slice(-10);
}

export function isTestPhone(raw: string | null | undefined): boolean {
  const d = last10(raw);
  return (TEST_PHONE_NUMBERS as readonly string[]).includes(d);
}

export function normalizePhoneE164(raw: string): string {
  const trimmed = (raw ?? "").trim();
  if (trimmed.startsWith("+")) return "+" + trimmed.slice(1).replace(/\D/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

async function sendViaTwilio(
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
    body: new URLSearchParams({
      To: to,
      From: from,
      Body: body,
      StatusCallback:
        "https://pjntdyhshxwhsxnwjylk.supabase.co/functions/v1/twilio-status-callback",
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("[sms] twilio error", res.status, t);
    return { ok: false, error: `twilio_${res.status}` };
  }
  const json = (await res.json()) as { sid?: string };
  return { ok: true, sid: json.sid };
}

export type SendSmsOptions = {
  /** Message classification, e.g. "free_week_code", "free_week_activated". */
  kind: string;
  /** Who triggered the send, e.g. "free_week_promo". */
  sentBy: string;
  /** Optional lead to attach the log entry to. */
  leadId?: string | null;
  /** Optional Supabase client for logging test-mode sends. */
  db?: Db | null;
};

/**
 * Single entry point for free-week promo SMS. Production numbers go to
 * Twilio exactly as before; reserved test numbers are logged only.
 */
export async function sendPromoSms(
  to: string,
  body: string,
  opts: SendSmsOptions,
): Promise<{ ok: boolean; sid?: string; error?: string; test_mode?: boolean }> {
  const e164 = normalizePhoneE164(to);

  if (isTestPhone(e164)) {
    if (opts.db) {
      const { error } = await opts.db.from("sms_conversation_log").insert({
        lead_id: opts.leadId ?? null,
        phone: e164,
        direction: "outbound",
        body: `TEST MODE - SMS not sent | ${body}`,
        from_ai: false,
        provider_message_id: null,
        status: "test_mode",
        metadata: { kind: opts.kind, test_mode: true, sent_by: opts.sentBy },
      });
      if (error) console.error("[sms] test-mode log failed", error.message);
    }
    return { ok: true, test_mode: true };
  }

  const result = await sendViaTwilio(e164, body);

  // Log every live send too, so promo texts show up in the Lead Tracker
  // conversation history with delivery status (via twilio-status-callback).
  const db = opts.db ?? (await getAdminDb());
  if (db) {
    const { error } = await db.from("sms_conversation_log").insert({
      lead_id: opts.leadId ?? null,
      phone: e164,
      direction: "outbound",
      body,
      from_ai: false,
      provider_message_id: result.sid ?? null,
      status: result.ok ? "sent" : "failed",
      metadata: {
        kind: opts.kind,
        sent_by: opts.sentBy,
        ...(result.error ? { error: result.error } : {}),
      },
    });
    if (error) console.error("[sms] send log failed", error.message);
  }

  return result;
}

async function getAdminDb(): Promise<Db | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return supabaseAdmin as unknown as Db;
  } catch (e) {
    console.error("[sms] admin client unavailable for logging", e instanceof Error ? e.message : e);
    return null;
  }
}
