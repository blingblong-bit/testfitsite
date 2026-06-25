import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ConfirmSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(254),
  interest: z.string().max(120).nullable().optional(),
  message: z.string().max(4000).nullable().optional(),
  submitted_at: z.string().optional(),
});

const SITE_NAME = "FIT Beyond Plus";
const BUSINESS_EMAIL = "info@fitbeyondplus.com";
const SENDER_DOMAIN = "notify.fitbeyondplus.com";
const FROM_DOMAIN = "fitbeyondplus.com";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const confirmLeadToCustomer = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ConfirmSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import(
        "@/integrations/supabase/client.server"
      );

      const firstName = data.name.trim().split(/\s+/)[0] || data.name;
      const interest = data.interest?.trim() || null;
      const message = data.message?.trim() || null;

      const subject = `Thanks for contacting ${SITE_NAME}`;

      const messageBlockHtml = message
        ? `<p style="margin:18px 0 6px;color:#555;font-size:13px;text-transform:uppercase;letter-spacing:0.05em">Your message</p>
           <div style="padding:14px 16px;border-left:3px solid #111;background:#f6f6f6;white-space:pre-wrap;font-size:15px;line-height:1.5">${esc(
             message,
           )}</div>`
        : "";

      const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#111">
  <div style="max-width:600px;margin:0 auto;padding:28px 24px">
    <h2 style="margin:0 0 16px;font-size:22px">Thanks, ${esc(firstName)}!</h2>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6">
      We received your message${interest ? ` about <strong>${esc(interest)}</strong>` : ""} and a member of our team will follow up shortly.
    </p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6">
      In the meantime, if you need anything right away, just reply to this email or reach us at
      <a href="mailto:${BUSINESS_EMAIL}" style="color:#111">${BUSINESS_EMAIL}</a>.
    </p>
    ${messageBlockHtml}
    <div style="margin-top:22px;padding:14px 16px;border:1px solid #e5e7eb;border-radius:6px;background:#fafafa;font-size:14px;line-height:1.6;color:#333">
      <div style="font-weight:700;margin-bottom:4px">Visit us</div>
      <div>449 W Lincoln St</div>
      <div>Tullahoma, TN 37388</div>
      <div style="margin-top:6px"><a href="tel:9312224449" style="color:#111">(931) 222-4449</a></div>
    </div>
    <p style="margin-top:24px;font-size:15px;line-height:1.6">
      Talk soon,<br/>
      The ${SITE_NAME} Team
    </p>
  </div>
</body></html>`;

      const text = [
        `Thanks, ${firstName}!`,
        "",
        `We received your message${interest ? ` about ${interest}` : ""} and a member of our team will follow up shortly.`,
        "",
        `If you need anything right away, just reply to this email or reach us at ${BUSINESS_EMAIL}.`,
        message ? `\nYour message:\n${message}` : "",
        "",
        "Visit us:",
        "449 W Lincoln St",
        "Tullahoma, TN 37388",
        "(931) 222-4449",
        "",
        `Talk soon,`,
        `The ${SITE_NAME} Team`,
      ]
        .filter(Boolean)
        .join("\n");

      const recipient = data.email.trim().toLowerCase();

      // Suppression check
      const { data: suppressed } = await supabaseAdmin
        .from("suppressed_emails")
        .select("email")
        .eq("email", recipient)
        .maybeSingle();
      if (suppressed) {
        return { ok: false as const, error: "suppressed" };
      }

      // Unsubscribe token
      let unsubscribeToken: string;
      const { data: existingTok } = await supabaseAdmin
        .from("email_unsubscribe_tokens")
        .select("token, used_at")
        .eq("email", recipient)
        .maybeSingle();
      if (existingTok && !existingTok.used_at) {
        unsubscribeToken = existingTok.token;
      } else {
        const bytes = new Uint8Array(32);
        crypto.getRandomValues(bytes);
        unsubscribeToken = Array.from(bytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
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

      const messageId = crypto.randomUUID();
      const submittedAt = data.submitted_at
        ? new Date(data.submitted_at).getTime()
        : Date.now();
      const idempotencyKey = `lead-confirm-${recipient}-${submittedAt}`;

      await supabaseAdmin.from("email_send_log").insert({
        message_id: messageId,
        template_name: "lead-confirmation",
        recipient_email: recipient,
        status: "pending",
      });

      const { error: enqueueError } = await supabaseAdmin.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          message_id: messageId,
          to: recipient,
          from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
          reply_to: BUSINESS_EMAIL,
          sender_domain: SENDER_DOMAIN,
          subject,
          html,
          text,
          unsubscribe_token: unsubscribeToken,
          purpose: "transactional",
          label: "lead-confirmation",
          idempotency_key: idempotencyKey,
          queued_at: new Date().toISOString(),
        },
      });

      if (enqueueError) {
        await supabaseAdmin.from("email_send_log").insert({
          message_id: messageId,
          template_name: "lead-confirmation",
          recipient_email: recipient,
          status: "failed",
          error_message: enqueueError.message.slice(0, 1000),
        });
        console.error("[confirmLeadToCustomer] enqueue failed", enqueueError);
        return { ok: false as const, error: "enqueue_failed" };
      }

      return { ok: true as const };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "send_exception";
      console.error("[confirmLeadToCustomer] error", msg);
      return { ok: false as const, error: msg };
    }
  });
