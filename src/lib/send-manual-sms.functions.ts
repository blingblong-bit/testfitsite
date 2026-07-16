import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Schema = z.object({
  lead_id: z.string().uuid(),
  phone: z.string().trim().min(7).max(40),
  message: z.string().trim().min(1).max(1600),
});

function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return "+" + trimmed.slice(1).replace(/\D/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

const TEST_EMAIL = "smstest@fitbeyondplus.com";

export const sendManualSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Schema.parse(data))
  .handler(async ({ data, context }) => {
    try {
      const { data: isAdmin, error: roleErr } = await context.supabase.rpc(
        "has_role",
        { _user_id: context.userId, _role: "admin" },
      );
      if (roleErr || !isAdmin) {
        return { ok: false as const, error: "forbidden" };
      }

      const to = normalizePhone(data.phone);
      const body = data.message.trim();

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
          .update({ last_sms_at: now, sequence_status: "paused" })
          .eq("id", data.lead_id);
        await supabaseAdmin.from("sms_conversation_log").insert({
          lead_id: data.lead_id,
          phone: to,
          direction: "outbound",
          body: `TEST MODE - SMS not sent | ${body}`,
          from_ai: false,
          provider_message_id: null,
          status: "test_mode",
          metadata: { kind: "manual", sent_by: "staff", test_mode: true },
        });
        return { ok: true as const, test_mode: true as const };
      }

      const sid = process.env.TWILIO_ACCOUNT_SID;
      const token = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_FROM_NUMBER;
      if (!sid || !token || !from) {
        console.error("[sendManualSms] missing Twilio env vars");
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
          body: new URLSearchParams({ To: to, From: from, Body: body }),
        },
      );

      if (!res.ok) {
        const errText = await res.text();
        console.error("[sendManualSms] twilio error", res.status, errText);
        return { ok: false as const, error: `twilio_${res.status}` };
      }

      const twilioResp = (await res.json()) as { sid?: string };

      await supabaseAdmin
        .from("leads")
        .update({ last_sms_at: now, sequence_status: "paused" })
        .eq("id", data.lead_id);

      await supabaseAdmin.from("sms_conversation_log").insert({
        lead_id: data.lead_id,
        phone: to,
        direction: "outbound",
        body,
        from_ai: false,
        provider_message_id: twilioResp.sid ?? null,
        status: "sent",
        metadata: { kind: "manual", sent_by: "staff" },
      });

      return { ok: true as const };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "send_exception";
      console.error("[sendManualSms] exception", msg);
      return { ok: false as const, error: msg };
    }
  });
