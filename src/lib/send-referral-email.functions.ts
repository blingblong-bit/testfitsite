import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Schema = z.object({
  friend_name: z.string().min(1).max(120),
  friend_email: z.string().email().max(254),
  referrer_name: z.string().min(1).max(120),
  referral_code: z.string().min(1).max(40),
});

const TEMPLATE_NAME = "referral-day-pass";

export const sendReferralEmail = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Schema.parse(data))
  .handler(async ({ data }) => {
    try {
      const [{ supabaseAdmin }, { sendTemplateEmail }] = await Promise.all([
        import("@/integrations/supabase/client.server"),
        import("@/lib/email-templates/send-email"),
      ]);

      const recipient = data.friend_email.toLowerCase();
      const messageId = crypto.randomUUID();

      const logSend = async (
        status: "sent" | "suppressed" | "failed",
        errorMessage?: string,
      ) => {
        const { error } = await supabaseAdmin.from("email_send_log").insert({
          message_id: messageId,
          template_name: TEMPLATE_NAME,
          recipient_email: recipient,
          status,
          error_message: errorMessage ?? null,
        });
        if (error) console.error("[sendReferralEmail] log failed", error);
      };

      let result;
      try {
        result = await sendTemplateEmail(TEMPLATE_NAME, recipient, {
          templateData: {
            friend_name: data.friend_name,
            referrer_name: data.referrer_name,
            referral_code: data.referral_code,
          },
          idempotencyKey: `referral-${data.referral_code}`,
        });
      } catch (sendErr) {
        const sendMsg =
          sendErr instanceof Error ? sendErr.message : String(sendErr);
        await logSend("failed", sendMsg.slice(0, 1000));
        console.error("[sendReferralEmail] send failed", sendMsg);
        return { ok: false as const, error: "send_failed" };
      }

      if (!result.sent) {
        await logSend("suppressed");
        return { ok: false as const, error: "email_suppressed" };
      }

      await logSend("sent");
      return { ok: true as const };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "send_exception";
      console.error("[sendReferralEmail] error", msg);
      return { ok: false as const, error: msg };
    }
  });
