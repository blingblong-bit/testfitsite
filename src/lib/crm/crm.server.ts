// Server-only CRM helpers. Never throw into the caller — CRM bookkeeping must
// never break a customer's form submission or an alert.

export const OPEN_STAGES = [
  "New Lead",
  "Attempting Contact",
  "Engaged",
  "Tour or Assessment Booked",
  "Trial or Day Pass Active",
  "Decision and Follow-Up",
  "Long-Term Nurture",
] as const;

export function interestOf(interest: string | null, source: string | null): string {
  const t = `${interest ?? ""} ${source ?? ""}`.toLowerCase();
  if (t.includes("free week") || t.includes("free_week")) return "Free Week";
  if (t.includes("personal training") || t.includes("personal_training")) return "Personal Training";
  if (/(bjj|jiu|kickbox|combat)/.test(t)) return "Combat Sports";
  if (t.includes("class")) return "Classes";
  if (t.includes("day pass") || t.includes("day_pass")) return "Day Pass";
  return "Membership";
}

/**
 * Record a returning lead's new form submission. Keeps original_source,
 * updates latest_source, logs the submission once (keyed by submissionId),
 * then bumps the matching open opportunity or opens a new one. Won/lost
 * opportunities are never reopened.
 */
export async function recordReengagement(leadId: string, submissionId: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("id, source, interest, lead_type, utm_source, utm_medium, utm_campaign, landing_page")
      .eq("id", leadId)
      .maybeSingle();
    if (!lead || lead.lead_type !== "customer_lead") return;

    const { error: actErr } = await supabaseAdmin.from("contact_activity").insert({
      contact_id: leadId,
      kind: "form_submission",
      summary: `Re-engaged — submitted ${lead.source} again`,
      source: lead.source,
      utm: {
        utm_source: lead.utm_source,
        utm_medium: lead.utm_medium,
        utm_campaign: lead.utm_campaign,
        landing_page: lead.landing_page,
      },
      idempotency_key: `submission:${submissionId}`,
    });
    if (actErr) return; // duplicate processing of this submission — stop here

    await supabaseAdmin.from("leads").update({ latest_source: lead.source }).eq("id", leadId);

    const interest = interestOf(lead.interest, lead.source);
    const now = new Date().toISOString();
    const { data: open } = await supabaseAdmin
      .from("opportunities")
      .select("id")
      .eq("contact_id", leadId)
      .eq("interest", interest)
      .eq("status", "open")
      .maybeSingle();
    if (open) {
      await supabaseAdmin
        .from("opportunities")
        .update({ last_activity_at: now, no_action_required: false })
        .eq("id", open.id);
    } else {
      await supabaseAdmin.from("opportunities").insert({
        contact_id: leadId,
        stage: "New Lead",
        status: "open",
        interest,
        source: lead.source,
        last_activity_at: now,
      });
    }
  } catch (err) {
    console.error("[crm] recordReengagement failed", err instanceof Error ? err.message : err);
  }
}

function e164(raw: string): string {
  const t = raw.trim();
  if (t.startsWith("+")) return "+" + t.slice(1).replace(/\D/g, "");
  const d = t.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return `+${d}`;
}

/**
 * Member welcome text, at most once per contact ever. Claims a unique
 * activity key before sending and also skips anyone who already received a
 * welcome from the old Lead Tracker.
 */
export async function sendMemberWelcomeOnce(
  leadId: string,
): Promise<"sent" | "skipped" | "failed"> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("id, name, phone, email, sms_opted_out")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead?.phone || lead.sms_opted_out) return "skipped";

  const { count } = await supabaseAdmin
    .from("sms_conversation_log")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId)
    .eq("metadata->>kind", "welcome");
  if ((count ?? 0) > 0) return "skipped";

  const { error: claimErr } = await supabaseAdmin.from("contact_activity").insert({
    contact_id: leadId,
    kind: "automation",
    summary: "Member welcome text",
    idempotency_key: `automation:member_welcome:${leadId}`,
  });
  if (claimErr) return "skipped";

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) return "failed";
  const first = (lead.name ?? "").trim().split(/\s+/)[0] || "there";
  const body = `Welcome to the FIT Beyond Plus family, ${first}! 💪 We're pumped to have you. If you ever have questions, need to update your schedule, or just want to know what's going on at the gym — just text here. See you soon!`;
  const to = e164(lead.phone);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: to,
      From: from,
      Body: body,
      StatusCallback:
        "https://pjntdyhshxwhsxnwjylk.supabase.co/functions/v1/twilio-status-callback",
    }),
  });
  if (!res.ok) {
    console.error("[crm] welcome send failed", res.status, await res.text());
    return "failed";
  }
  const json = (await res.json()) as { sid?: string };
  const now = new Date().toISOString();
  await supabaseAdmin.from("leads").update({ last_sms_at: now }).eq("id", leadId);
  await supabaseAdmin.from("sms_conversation_log").insert({
    lead_id: leadId,
    phone: to,
    direction: "outbound",
    body,
    from_ai: false,
    provider_message_id: json.sid ?? null,
    status: "sent",
    metadata: { kind: "welcome", source: "crm" },
  });
  return "sent";
}
