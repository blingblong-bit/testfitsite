import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Schema = z.object({
  friend_name: z.string().min(1).max(120),
  friend_email: z.string().email().max(254),
  referrer_name: z.string().min(1).max(120),
  referral_code: z.string().min(1).max(40),
});

export const sendReferralEmail = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Schema.parse(data))
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      return { ok: false as const, error: "email_not_configured" };
    }

    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const text =
      `Hey ${data.friend_name},\n\n` +
      `${data.referrer_name} referred you to FIT Beyond Plus!\n\n` +
      `Here is your free day pass code:\n\n` +
      `${data.referral_code}\n\n` +
      `Show this code at the front desk to redeem your free day pass.\n\n` +
      `We look forward to seeing you!`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
        <p>Hey ${esc(data.friend_name)},</p>
        <p><strong>${esc(data.referrer_name)}</strong> referred you to FIT Beyond Plus!</p>
        <p>Here is your free day pass code:</p>
        <div style="margin:20px 0;padding:18px;border:2px solid #111;border-radius:8px;text-align:center;font-size:28px;letter-spacing:6px;font-weight:bold;font-family:monospace">
          ${esc(data.referral_code)}
        </div>
        <p>Show this code at the front desk to redeem your free day pass.</p>
        <p>We look forward to seeing you!</p>
      </div>
    `;

    try {
      const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": RESEND_API_KEY,
        },
        body: JSON.stringify({
          from: "FIT Beyond Plus <onboarding@resend.dev>",
          to: [data.friend_email],
          subject: "Your Free Day Pass to FIT Beyond Plus",
          html,
          text,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error("[sendReferralEmail] Resend failed", res.status, body);
        return { ok: false as const, error: `resend_${res.status}: ${body.slice(0, 200)}` };
      }
      return { ok: true as const };
    } catch (err) {
      console.error("[sendReferralEmail] error", err);
      const msg = err instanceof Error ? err.message : "send_exception";
      return { ok: false as const, error: msg };
    }
  });
