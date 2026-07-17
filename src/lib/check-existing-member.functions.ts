import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Schema = z.object({
  source: z.string().trim().min(1),
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).nullable().optional(),
  interest: z.string().trim().max(200).nullable().optional(),
  message: z.string().trim().max(4000).nullable().optional(),
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

export const checkExistingMemberSubmission = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Schema.parse(data))
  .handler(async ({ data }) => {
    try {
      const { checkMemberMatch } = await import("./antaris/client");
      const match = await checkMemberMatch(
        data.name,
        data.email,
        data.phone ?? "",
      );

      if (!match.isMember || match.confidence < 80) {
        return { handled: false as const };
      }

      const { supabaseAdmin } = await import(
        "@/integrations/supabase/client.server"
      );

      const now = new Date().toISOString();
      const noteLine = `Detected as existing Antaris member at form submission (confidence: ${match.confidence})`;

      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("leads")
        .insert({
          source: data.source,
          name: data.name,
          email: data.email,
          phone: data.phone ?? null,
          interest: data.interest ?? null,
          message: data.message ?? null,
          lead_type: "existing_member",
          should_notify: false,
          crm_status: "Joined",
          became_member: true,
          converted_at: now,
          sequence_status: "completed",
          notes: noteLine,
        })
        .select("id")
        .single();

      if (insErr || !inserted) {
        console.error("[checkExistingMember] insert failed", insErr?.message);
        return { handled: false as const };
      }

      const leadId = inserted.id as string;

      if (!data.phone) {
        return { handled: true as const, lead_id: leadId };
      }

      const to = normalizePhone(data.phone);
      const body = `Hey ${firstName(data.name)}! Looks like you're already one of our members 💪 Got a question or need something specific? Just reply here and we'll help you out — or call us at (931) 222-4449.`;
      const isTest = data.email.trim().toLowerCase() === TEST_EMAIL;

      if (isTest) {
        await supabaseAdmin
          .from("leads")
          .update({ last_sms_at: now })
          .eq("id", leadId);
        await supabaseAdmin.from("sms_conversation_log").insert({
          lead_id: leadId,
          phone: to,
          direction: "outbound",
          body: `TEST MODE - SMS not sent | ${body}`,
          from_ai: false,
          provider_message_id: null,
          status: "test_mode",
          metadata: {
            kind: "existing_member_welcome",
            context: "existing_member",
            test_mode: true,
          },
        });
        return { handled: true as const, lead_id: leadId, test_mode: true };
      }

      const sid = process.env.TWILIO_ACCOUNT_SID;
      const token = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_FROM_NUMBER;
      if (!sid || !token || !from) {
        console.error("[checkExistingMember] missing Twilio env vars");
        return { handled: true as const, lead_id: leadId };
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
        console.error(
          "[checkExistingMember] twilio error",
          res.status,
          errText,
        );
        return { handled: true as const, lead_id: leadId };
      }

      const twilioResp = (await res.json()) as { sid?: string };
      await supabaseAdmin
        .from("leads")
        .update({ last_sms_at: now })
        .eq("id", leadId);
      await supabaseAdmin.from("sms_conversation_log").insert({
        lead_id: leadId,
        phone: to,
        direction: "outbound",
        body,
        from_ai: false,
        provider_message_id: twilioResp.sid ?? null,
        status: "sent",
        metadata: {
          kind: "existing_member_welcome",
          context: "existing_member",
        },
      });

      return { handled: true as const, lead_id: leadId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "exception";
      console.error("[checkExistingMember] exception", msg);
      return { handled: false as const };
    }
  });
