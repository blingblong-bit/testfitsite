// Instant internal "NEW FIT LEAD — CALL NOW" SMS to the owner.
// Server-only. Recipient comes from the LEAD_ALERT_PHONE secret (one value to
// change). One alert per form submission is guaranteed by the UNIQUE
// submission_id claim in
// public.lead_alert_log, inserted BEFORE sending. Never throws — a failed
// alert must never break the customer's form submission.

const LEAD_TRACKER_URL = "https://fitbeyondplus.com/admin/leads";

const SOURCE_LABELS: Record<string, string> = {
  general_contact: "Contact form",
  book_a_tour: "Book a Tour form",
  membership_inquiry: "Membership form",
  personal_training_inquiry: "Personal Training form",
  classes_inquiry: "Classes form",
  schedule_visit: "Schedule a Visit page",
  day_pass_walkin: "Day Pass check-in",
  referral_free_week: "Free Week claim",
  test_lead_alert: "TEST alert",
};

function e164(raw: string): string {
  const t = (raw ?? "").trim();
  if (t.startsWith("+")) return "+" + t.slice(1).replace(/\D/g, "");
  const d = t.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return d ? `+${d}` : "";
}

function pretty(raw: string): string {
  const d = e164(raw).replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1"))
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return raw;
}

function interestCategory(source: string, interest: string | null): string {
  const s = `${source} ${interest ?? ""}`.toLowerCase();
  if (s.includes("free week") || s.includes("free_week")) return "Free Week";
  if (s.includes("day pass") || s.includes("day_pass")) return "Day Pass";
  if (s.includes("personal training") || s.includes("personal_training")) return "Personal Training";
  if (s.includes("member")) return "Membership";
  return interest?.trim() ? `Other (${interest.trim()})` : "Other";
}

type LeadRow = {
  id: string;
  name: string | null;
  phone: string | null;
  interest: string | null;
  source: string | null;
  primary_goal?: string | null;
  membership_start_date?: string | null;
  utm_source?: string | null;
  created_at: string | null;
};

export type LeadAlertKind = "new" | "reengaged";

export function buildLeadAlertMessage(
  lead: LeadRow,
  isTest = false,
  kind: LeadAlertKind = "new",
): string {
  const source = lead.source ?? "";
  const srcLabel = SOURCE_LABELS[source] ?? (source || "Website");
  const srcLine = lead.utm_source ? `${srcLabel} · utm: ${lead.utm_source}` : srcLabel;
  const submitted =
    new Date(kind === "reengaged" ? Date.now() : (lead.created_at ?? Date.now())).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }) + " CT";
  const phone = lead.phone?.trim() ? pretty(lead.phone) : "Not provided";
  const lines = [
    `${isTest ? "[TEST] " : ""}${kind === "reengaged" ? "RE-ENGAGED" : "NEW"} FIT LEAD — CALL NOW`,
    "",
    `Name: ${lead.name?.trim() || "Unknown"}`,
    `Phone: ${phone}`,
    `Interest: ${interestCategory(source, lead.interest)}`,
  ];
  if (lead.primary_goal?.trim()) lines.push(`Goal: ${lead.primary_goal.trim()}`);
  if (lead.membership_start_date) lines.push(`Preferred Start: ${lead.membership_start_date}`);
  lines.push(`Source: ${srcLine}`, `Submitted: ${submitted}`, "");
  if (lead.phone?.trim()) lines.push(`Tap to call: tel:${e164(lead.phone)}`);
  lines.push(`Open Lead Tracker: ${LEAD_TRACKER_URL}`);
  return lines.join("\n");
}

export type LeadAlertResult =
  | { status: "sent"; sid: string; sentAt: string }
  | { status: "duplicate" }
  | { status: "failed"; error: string };

export async function sendNewLeadAlert(
  leadId: string,
  opts: {
    isTest?: boolean;
    kind?: LeadAlertKind;
    /** Unique form submission / event ID. Same ID = same alert (retries blocked). */
    submissionId?: string | null;
  } = {},
): Promise<LeadAlertResult> {
  const kind = opts.kind ?? "new";
  // Fallback key when the caller has no event ID: blocks duplicate processing
  // of the same lead+kind within a 10-minute window, never permanently.
  const submissionId =
    opts.submissionId?.trim() ||
    `${kind}:${leadId}:${Math.floor(Date.now() / 600_000)}`;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const to = e164(process.env.LEAD_ALERT_PHONE ?? "");

    // Claim first: the UNIQUE submission_id makes a retry of the same
    // submission a no-op, while a later new submission gets its own alert.
    const { error: claimErr } = await supabaseAdmin.from("lead_alert_log").insert({
      lead_id: leadId,
      submission_id: submissionId,
      alert_kind: kind,
      status: "sending",
      to_phone: to || null,
      is_test: !!opts.isTest,
    });
    if (claimErr) {
      if (claimErr.code === "23505") return { status: "duplicate" };
      console.error("[lead-alert] claim failed", claimErr.message);
      return { status: "failed", error: claimErr.message };
    }

    const fail = async (error: string): Promise<LeadAlertResult> => {
      console.error("[lead-alert] send failed", leadId, error);
      await supabaseAdmin
        .from("lead_alert_log")
        .update({ status: "failed", error_message: error.slice(0, 1000) })
        .eq("submission_id", submissionId);
      return { status: "failed", error };
    };

    const { data: lead, error: leadErr } = await supabaseAdmin
      .from("leads")
      .select("id, name, phone, interest, source, primary_goal, membership_start_date, utm_source, created_at")
      .eq("id", leadId)
      .single();
    if (leadErr || !lead) return fail(leadErr?.message ?? "lead_not_found");
    await supabaseAdmin.from("lead_alert_log").update({ source: lead.source }).eq("submission_id", submissionId);

    if (!to || to.replace(/\D/g, "").length < 10) return fail("LEAD_ALERT_PHONE not configured");
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    if (!sid || !token || !from) return fail("twilio_not_configured");

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: to,
        From: from,
        Body: buildLeadAlertMessage(lead as LeadRow, !!opts.isTest, kind),
      }),
    });
    if (!res.ok) return fail(`twilio_${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { sid?: string };
    const sentAt = new Date().toISOString();
    await supabaseAdmin
      .from("lead_alert_log")
      .update({ status: "sent", twilio_sid: json.sid ?? null, sent_at: sentAt, error_message: null })
      .eq("submission_id", submissionId);
    return { status: "sent", sid: json.sid ?? "", sentAt };
  } catch (err) {
    const error = err instanceof Error ? err.message : "exception";
    console.error("[lead-alert] exception", error);
    return { status: "failed", error };
  }
}
