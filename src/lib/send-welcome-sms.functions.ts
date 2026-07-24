import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Schema = z.object({
  lead_id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(7).max(40),
});

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim();
}

function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return "+" + trimmed.slice(1).replace(/\D/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

const TEST_EMAIL = "smstest@fitbeyondplus.com";

export const sendWelcomeSms = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Schema.parse(data))
  .handler(async ({ data }) => {
    try {
      const to = normalizePhone(data.phone);
      const body = `Welcome to the FIT Beyond Plus family, ${firstName(data.name)}! 💪 We're pumped to have you. If you ever have questions, need to update your schedule, or just want to know what's going on at the gym — just text here. See you soon!`;

      const { supabaseAdmin } = await import(
        "@/integrations/supabase/client.server"
      );

      const { data: leadRow } = await supabaseAdmin
        .from("leads")
        .select("email")
        .eq("id", data.lead_id)
        .maybeSingle();
      const isTest =
        (leadRow?.email ?? "").trim().toLowerCase() === TEST_EMAIL;

      const now = new Date().toISOString();

      if (isTest) {
        await supabaseAdmin
          .from("leads")
          .update({ last_sms_at: now })
          .eq("id", data.lead_id);
        await supabaseAdmin.from("sms_conversation_log").insert({
          lead_id: data.lead_id,
          phone: to,
          direction: "outbound",
          body: `TEST MODE - SMS not sent | ${body}`,
          from_ai: false,
          provider_message_id: null,
          status: "test_mode",
          metadata: { kind: "welcome", test_mode: true },
        });
        return { ok: true as const, test_mode: true as const, message: body };
      }

      const sid = process.env.TWILIO_ACCOUNT_SID;
      const token = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_FROM_NUMBER;
      if (!sid || !token || !from) {
        console.error("[sendWelcomeSms] missing Twilio env vars");
        return { ok: false as const, error: "twilio_not_configured" };
      }

      const auth = btoa(`${sid}:${token}`);
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
        const errText = await res.text();
        console.error("[sendWelcomeSms] twilio error", res.status, errText);
        return { ok: false as const, error: `twilio_${res.status}` };
      }

      const twilioResp = (await res.json()) as { sid?: string };

      const { error: updErr } = await supabaseAdmin
        .from("leads")
        .update({ last_sms_at: now })
        .eq("id", data.lead_id);
      if (updErr) {
        console.error("[sendWelcomeSms] lead update failed", updErr.message);
      }

      await supabaseAdmin.from("sms_conversation_log").insert({
        lead_id: data.lead_id,
        phone: to,
        direction: "outbound",
        body,
        from_ai: false,
        provider_message_id: twilioResp.sid ?? null,
        status: "sent",
        metadata: { kind: "welcome" },
      });

      return { ok: true as const };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "send_exception";
      console.error("[sendWelcomeSms] exception", msg);
      return { ok: false as const, error: msg };
    }
  });
