import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Schema = z.object({
  friend_name: z.string().min(1).max(120),
  friend_email: z.string().email().max(254),
  referrer_name: z.string().min(1).max(120),
  referral_code: z.string().min(1).max(40),
});

const TEMPLATE_NAME = "referral-day-pass";
const SITE_NAME = "FIT Beyond Plus";
const SENDER_DOMAIN = "notify.fitbeyondplus.com";
const FROM_DOMAIN = "fitbeyondplus.com";

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const sendReferralEmail = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Schema.parse(data))
  .handler(async ({ data }) => {
    try {
      const [{ supabaseAdmin }, React, { render }, { TEMPLATES }] =
        await Promise.all([
          import("@/integrations/supabase/client.server"),
          import("react"),
          import("@react-email/components"),
          import("@/lib/email-templates/registry"),
        ]);

      const entry = TEMPLATES[TEMPLATE_NAME];
      if (!entry) {
        return { ok: false as const, error: "template_not_registered" };
      }

      const recipient = data.friend_email.toLowerCase();
      const messageId = crypto.randomUUID();

      // Suppression check
      const { data: suppressed } = await supabaseAdmin
        .from("suppressed_emails")
        .select("id")
        .eq("email", recipient)
        .maybeSingle();
      if (suppressed) {
        return { ok: false as const, error: "email_suppressed" };
      }

      // Unsubscribe token (one per address)
      let unsubscribeToken: string;
      const { data: existing } = await supabaseAdmin
        .from("email_unsubscribe_tokens")
        .select("token, used_at")
        .eq("email", recipient)
        .maybeSingle();

      if (existing && !existing.used_at) {
        unsubscribeToken = existing.token;
      } else {
        unsubscribeToken = generateToken();
        await supabaseAdmin
          .from("email_unsubscribe_tokens")
          .upsert(
            { token: unsubscribeToken, email: recipient },
            { onConflict: "email", ignoreDuplicates: true },
          );
        const { data: stored } = await supabaseAdmin
          .from("email_unsubscribe_tokens")
          .select("token")
          .eq("email", recipient)
          .maybeSingle();
        if (stored?.token) unsubscribeToken = stored.token;
      }

      const element = React.createElement(entry.component, {
        friend_name: data.friend_name,
        referrer_name: data.referrer_name,
        referral_code: data.referral_code,
      });
      const html = await render(element);
      const text = await render(element, { plainText: true });
      const subject =
        typeof entry.subject === "function"
          ? entry.subject({})
          : entry.subject;

      await supabaseAdmin.from("email_send_log").insert({
        message_id: messageId,
        template_name: TEMPLATE_NAME,
        recipient_email: recipient,
        status: "pending",
      });

      const { error: enqueueError } = await supabaseAdmin.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          message_id: messageId,
          to: recipient,
          from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
          sender_domain: SENDER_DOMAIN,
          subject,
          html,
          text,
          purpose: "transactional",
          label: TEMPLATE_NAME,
          idempotency_key: `referral-${data.referral_code}`,
          unsubscribe_token: unsubscribeToken,
          queued_at: new Date().toISOString(),
        },
      });

      if (enqueueError) {
        await supabaseAdmin.from("email_send_log").insert({
          message_id: messageId,
          template_name: TEMPLATE_NAME,
          recipient_email: recipient,
          status: "failed",
          error_message: enqueueError.message.slice(0, 1000),
        });
        return { ok: false as const, error: "enqueue_failed" };
      }

      return { ok: true as const };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "send_exception";
      console.error("[sendReferralEmail] error", msg);
      return { ok: false as const, error: msg };
    }
  });
