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

export const notifyNewLead = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => LeadSchema.parse(data))
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      console.error("[notifyNewLead] Missing API keys");
      return { ok: false, error: "email_not_configured" };
    }

    const submittedAt = data.submitted_at
      ? new Date(data.submitted_at)
      : new Date();

    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const rows: Array<[string, string]> = [
      ["Name", data.name],
      ["Email", data.email],
      ["Phone", data.phone || "—"],
      ["Interested in", data.interest || "—"],
      ["Source page", data.source],
      ["Submitted at", submittedAt.toLocaleString("en-US", { timeZone: "America/Chicago" }) + " (CT)"],
    ];

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
        <h2 style="margin:0 0 16px">New lead from FIT Beyond Plus</h2>
        <table style="width:100%;border-collapse:collapse">
          ${rows
            .map(
              ([k, v]) =>
                `<tr><td style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;width:140px">${esc(k)}</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${esc(v)}</td></tr>`,
            )
            .join("")}
        </table>
        ${
          data.message
            ? `<h3 style="margin:20px 0 8px">Message</h3>
               <div style="padding:12px;border:1px solid #e5e7eb;border-radius:6px;white-space:pre-wrap">${esc(data.message)}</div>`
            : ""
        }
      </div>
    `;

    const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n") +
      (data.message ? `\n\nMessage:\n${data.message}` : "");

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
          to: ["hjalen218@gmail.com"],
          reply_to: data.email,
          subject: `New lead: ${data.name} (${data.source})`,
          html,
          text,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error("[notifyNewLead] Resend failed", res.status, body);
        return { ok: false, error: `resend_${res.status}` };
      }
      return { ok: true };
    } catch (err) {
      console.error("[notifyNewLead] error", err);
      return { ok: false, error: "send_exception" };
    }
  });
