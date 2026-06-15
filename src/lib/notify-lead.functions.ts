import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LeadSchema = z.object({
  source: z.string().min(1).max(60),
  name: z.string().min(1).max(120),
  email: z.string().email().max(254),
  phone: z.string().max(40).nullable().optional(),
  interest: z.string().max(120).nullable().optional(),
  message: z.string().max(4000).nullable().optional(),
  submitted_at: z.string().optional(),
});

const NOTIFY_TO = "info@fitbeyondplus.com";
const SITE_NAME = "FIT Beyond Plus";
const SENDER_DOMAIN = "notify.fitbeyondplus.com";
const FROM_DOMAIN = "fitbeyondplus.com";

const SOURCE_LABELS: Record<string, string> = {
  general_contact: "Contact form",
  book_a_tour: "Book a Tour",
  membership_inquiry: "Membership inquiry",
  personal_training_inquiry: "Personal Training inquiry",
  classes_inquiry: "Classes inquiry",
  frontdesk: "Front desk",
};

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const notifyNewLead = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => LeadSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import(
        "@/integrations/supabase/client.server"
      );

      const submittedAt = data.submitted_at
        ? new Date(data.submitted_at)
        : new Date();
      const submittedFmt =
        submittedAt.toLocaleString("en-US", {
          timeZone: "America/Chicago",
        }) + " CT";

      const sourceLabel = SOURCE_LABELS[data.source] ?? data.source;
      const interest = data.interest?.trim() || null;
      const phone = data.phone?.trim() || null;
      const message = data.message?.trim() || null;

      // Body is intentionally clean and customer-friendly.
      // When staff hit Reply, the quoted content is safe for the
      // customer to see — no internal scoring, source codes, or CRM data.
      const greeting = `Hi ${esc(data.name)},`;
      const introHtml = `Thanks for reaching out to ${SITE_NAME}. We received your inquiry${
        interest ? ` about <strong>${esc(interest)}</strong>` : ""
      } and will be in touch shortly.`;
      const introText = `Thanks for reaching out to ${SITE_NAME}. We received your inquiry${
        interest ? ` about ${interest}` : ""
      } and will be in touch shortly.`;

      const messageBlockHtml = message
        ? `<p style="margin:16px 0 6px;color:#555;font-size:13px;text-transform:uppercase;letter-spacing:0.05em">Your message</p>
           <div style="padding:14px 16px;border-left:3px solid #111;background:#f6f6f6;white-space:pre-wrap;font-size:15px;line-height:1.5">${esc(
             message,
           )}</div>`
        : "";

      const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#111">
  <div style="max-width:600px;margin:0 auto;padding:28px 24px">
    <h2 style="margin:0 0 16px;font-size:20px">New inquiry from ${esc(data.name)}</h2>
    <p style="margin:0 0 8px;font-size:15px">${greeting}</p>
    <p style="margin:8px 0 12px;font-size:15px;line-height:1.5">${introHtml}</p>
    ${messageBlockHtml}
    <div style="margin-top:20px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:14px;color:#333">
      <div><strong>Name:</strong> ${esc(data.name)}</div>
      <div><strong>Email:</strong> <a href="mailto:${esc(data.email)}" style="color:#111">${esc(data.email)}</a></div>
      ${phone ? `<div><strong>Phone:</strong> <a href="tel:${esc(phone)}" style="color:#111">${esc(phone)}</a></div>` : ""}
      ${interest ? `<div><strong>Interested in:</strong> ${esc(interest)}</div>` : ""}
    </div>
    <p style="margin-top:18px;font-size:13px;color:#777">
      Reply directly to this email to respond to ${esc(data.name)}.
    </p>
    <p style="margin-top:4px;font-size:11px;color:#aaa">
      ${esc(sourceLabel)} · ${esc(submittedFmt)}
    </p>
  </div>
</body></html>`;

      const textLines = [
        `New inquiry from ${data.name}`,
        "",
        greeting,
        introText,
      ];
      if (message) {
        textLines.push("", "Your message:", message);
      }
      textLines.push(
        "",
        "---",
        `Name: ${data.name}`,
        `Email: ${data.email}`,
      );
      if (phone) textLines.push(`Phone: ${phone}`);
      if (interest) textLines.push(`Interested in: ${interest}`);
      textLines.push(
        "",
        `Reply directly to this email to respond to ${data.name}.`,
        `(${sourceLabel} · ${submittedFmt})`,
      );
      const text = textLines.join("\n");

      const subject = `New inquiry from ${data.name}`;
      const messageId = crypto.randomUUID();
      const idempotencyKey = `lead-${data.source}-${data.email.toLowerCase()}-${submittedAt.getTime()}`;

      // Unsubscribe token (required by email API for transactional sends)
      const recipientLower = NOTIFY_TO.toLowerCase();
      let unsubscribeToken: string;
      const { data: existingTok } = await supabaseAdmin
        .from("email_unsubscribe_tokens")
        .select("token, used_at")
        .eq("email", recipientLower)
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
            { token: unsubscribeToken, email: recipientLower },
            { onConflict: "email", ignoreDuplicates: true },
          );
        const { data: stored } = await supabaseAdmin
          .from("email_unsubscribe_tokens")
          .select("token")
          .eq("email", recipientLower)
          .maybeSingle();
        if (stored?.token) unsubscribeToken = stored.token;
      }

      await supabaseAdmin.from("email_send_log").insert({
        message_id: messageId,
        template_name: "lead-notification",
        recipient_email: NOTIFY_TO,
        status: "pending",
      });

      const { error: enqueueError } = await supabaseAdmin.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          message_id: messageId,
          to: NOTIFY_TO,
          from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
          reply_to: data.email,
          sender_domain: SENDER_DOMAIN,
          subject,
          html,
          text,
          unsubscribe_token: unsubscribeToken,
          purpose: "transactional",
          label: "lead-notification",
          idempotency_key: idempotencyKey,
          queued_at: new Date().toISOString(),
        },
      });

      if (enqueueError) {
        await supabaseAdmin.from("email_send_log").insert({
          message_id: messageId,
          template_name: "lead-notification",
          recipient_email: NOTIFY_TO,
          status: "failed",
          error_message: enqueueError.message.slice(0, 1000),
        });
        console.error("[notifyNewLead] enqueue failed", enqueueError);
        return { ok: false as const, error: "enqueue_failed" };
      }

      return { ok: true as const };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "send_exception";
      console.error("[notifyNewLead] error", msg);
      return { ok: false as const, error: msg };
    }
  });
