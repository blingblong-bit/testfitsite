import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * Public SMS opt-in record for A2P 10DLC compliance.
 *
 * Nothing is stored and no message is ever sent unless `consent` arrives as
 * true — the checkbox on /sms-consent is unchecked by default and is the only
 * thing that can set it.
 */
const Schema = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(7).max(40),
  consent: z.boolean(),
});

// Basic abuse guard for an unauthenticated form.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 10;
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 500) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
  }
  return recent.length > MAX_PER_WINDOW;
}

export type SmsConsentResult = { ok: boolean; error?: string };

export const submitSmsConsent = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Schema.parse(data))
  .handler(async ({ data }): Promise<SmsConsentResult> => {
    // Consent must be affirmative. An unchecked box enrolls no one.
    if (data.consent !== true) {
      return { ok: false, error: "consent_required" };
    }

    const digits = data.phone.replace(/\D/g, "").slice(-10);
    if (digits.length !== 10) return { ok: false, error: "invalid_phone" };

    const caller =
      getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for") ?? "unknown";
    if (rateLimited(caller)) return { ok: false, error: "rate_limited" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("sms_consent_records").insert({
      first_name: data.first_name,
      last_name: data.last_name,
      phone: `+1${digits}`,
      consent: true,
      consent_at: new Date().toISOString(),
      consent_source: "website_sms_consent",
      ip_address: caller === "unknown" ? null : caller,
      user_agent: getRequestHeader("user-agent") ?? null,
    });
    if (error) {
      console.error("[submitSmsConsent] insert failed", error.message);
      return { ok: false, error: "save_failed" };
    }

    return { ok: true };
  });
