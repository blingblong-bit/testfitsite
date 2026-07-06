import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createReferral } from "@/lib/referrals";

const Schema = z.object({
  lead_id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
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

export const generateDayPassCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Schema.parse(data))
  .handler(async ({ data }) => {
    try {
      const refResult = await createReferral({
        referrer_name: "FIT Beyond Plus",
        referrer_email: "info@fitbeyondplus.com",
        friend_name: data.name,
        friend_email: data.email,
      });
      if (!refResult.ok) {
        return { ok: false as const, error: refResult.error };
      }
      const code = refResult.code;

      const sid = process.env.TWILIO_ACCOUNT_SID;
      const token = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_FROM_NUMBER;
      if (!sid || !token || !from) {
        console.error("[generateDayPassCode] missing Twilio env vars");
        return { ok: false as const, error: "twilio_not_configured" };
      }

      const to = normalizePhone(data.phone);
      const body = `Hey ${firstName(data.name)}! Here's your free FIT Beyond Plus day pass 🎟️ Code: ${code} Just show this text and your name at the front desk — valid for 14 days. We can't wait to have you in! 449 W Lincoln St, Tullahoma 💪`;

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
        console.error("[generateDayPassCode] twilio error", res.status, errText);
        return { ok: false as const, error: `twilio_${res.status}` };
      }

      const twilioResp = (await res.json()) as { sid?: string };

      const { supabaseAdmin } = await import(
        "@/integrations/supabase/client.server"
      );

      const stamp = new Date().toISOString();
      const entry = `[${stamp}] Day pass code ${code} generated and texted`;

      const { data: existing } = await supabaseAdmin
        .from("leads")
        .select("notes")
        .eq("id", data.lead_id)
        .maybeSingle();
      const notes = existing?.notes ? `${existing.notes}\n${entry}` : entry;

      await supabaseAdmin
        .from("leads")
        .update({ notes, last_sms_at: stamp })
        .eq("id", data.lead_id);

      await supabaseAdmin.from("sms_conversation_log").insert({
        lead_id: data.lead_id,
        phone: to,
        direction: "outbound",
        body,
        from_ai: false,
        provider_message_id: twilioResp.sid ?? null,
        status: "sent",
        metadata: { kind: "day_pass", code },
      });

      return { ok: true as const, code };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "send_exception";
      console.error("[generateDayPassCode] exception", msg);
      return { ok: false as const, error: msg };
    }
  });
