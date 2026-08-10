import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Schema = z.object({ phone: z.string().trim().min(7).max(40) });

export type SmsDeliveryRecord = {
  sid: string;
  to: string;
  status: string;
  date_sent: string | null;
  error_code: number | null;
  error_message: string | null;
  body: string;
};

/**
 * Admin-only: read the SMS provider's own delivery records for a phone number.
 * Answers "did this person actually get our text?" even when nothing was
 * written to sms_conversation_log on our side.
 */
export const lookupSmsDeliveryForPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Schema.parse(d))
  .handler(
    async ({
      data,
      context,
    }): Promise<
      { ok: true; messages: SmsDeliveryRecord[] } | { ok: false; error: string }
    > => {
      const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      if (roleErr || !isAdmin) return { ok: false, error: "forbidden" };

      const { normalizePhoneE164 } = await import("./sms.server");
      const sid = process.env["TWILIO_ACCOUNT_SID"];
      const token = process.env["TWILIO_AUTH_TOKEN"];
      if (!sid || !token) return { ok: false, error: "Texting is not configured." };

      const to = normalizePhoneE164(data.phone);
      const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json?To=${encodeURIComponent(to)}&PageSize=20`;
      const auth = Buffer.from(`${sid}:${token}`).toString("base64");

      try {
        const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
        if (!res.ok) {
          const text = await res.text();
          console.error("[lookupSmsDeliveryForPhone] provider error", res.status, text);
          return { ok: false, error: `Provider request failed (${res.status}).` };
        }
        const json = (await res.json()) as {
          messages?: Array<{
            sid: string;
            to: string;
            status: string;
            date_sent: string | null;
            error_code: number | null;
            error_message: string | null;
            body: string | null;
          }>;
        };
        return {
          ok: true,
          messages: (json.messages ?? []).map((m) => ({
            sid: m.sid,
            to: m.to,
            status: m.status,
            date_sent: m.date_sent,
            error_code: m.error_code ?? null,
            error_message: m.error_message ?? null,
            body: m.body ?? "",
          })),
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "lookup_failed";
        console.error("[lookupSmsDeliveryForPhone] exception", msg);
        return { ok: false, error: msg };
      }
    },
  );
