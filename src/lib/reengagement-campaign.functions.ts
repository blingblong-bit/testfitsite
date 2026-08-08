import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { advanceFollowUpIfStale } from "./follow-up";

export const CAMPAIGN_KIND = "free_week_reactivation";

function last10(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "").slice(-10);
}

function firstName(name: string | null | undefined): string {
  if (!name) return "there";
  return name.trim().split(/\s+/)[0] || "there";
}

export function buildCampaignMessage(name: string | null | undefined): string {
  return `Hey ${firstName(name)}, it's FIT Beyond Plus! It's been a little while, so we'd love to have you back. Claim a FREE 7-day pass here: https://fitbeyondplus.com/claim-free-week — your 7 days start when you activate it in person at the front desk. Reply STOP to opt out.`;
}

type Recipient = {
  id: string;
  name: string;
  phone: string;
  digits: string;
  created_at: string;
  source: string | null;
  message: string;
  next_follow_up_date: string | null;
  last_contacted_at: string | null;
  days_since_contact: number | null;
  crm_status: string | null;
  priority: string;
  tour_status: string;
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !isAdmin) throw new Error("forbidden");
}

const COOLDOWN_DAYS = 7;

async function buildAudience() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { TEST_PHONE_NUMBERS } = await import("./sms.server");
  const { computePriority, daysSince } = await import("./lead-priority");

  const { data: leads, error } = await supabaseAdmin
    .from("leads")
    .select(
      "id, name, phone, source, created_at, lead_type, sms_opted_out, became_member, crm_status, next_follow_up_date, last_contacted_at, last_sms_at, tour_scheduled, tour_completed",
    )
    .eq("lead_type", "customer_lead")
    .eq("sms_opted_out", false)
    .eq("became_member", false)
    .not("phone", "is", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  // Campaign-scoped duplicate guard: only successful sends of THIS campaign kind.
  const { data: smsRows, error: smsErr } = await supabaseAdmin
    .from("sms_conversation_log")
    .select("lead_id, phone, status, metadata");
  if (smsErr) throw new Error(smsErr.message);

  const alreadyCampaigned = new Set<string>();
  const campaignedLeadIds = new Set<string>();
  for (const row of smsRows ?? []) {
    const kind = (row.metadata as { kind?: string } | null)?.kind;
    if (kind !== CAMPAIGN_KIND) continue;
    if (row.status === "failed") continue;
    const d = last10(row.phone);
    if (d.length === 10) alreadyCampaigned.add(d);
    if (row.lead_id) campaignedLeadIds.add(row.lead_id);
  }

  // Excluded staff / developer / test numbers
  const excluded = new Set<string>();
  for (const t of TEST_PHONE_NUMBERS) excluded.add(last10(t));
  const staffEnv = [
    process.env.STAFF_NOTIFICATION_PHONES ?? "",
    process.env.DEVELOPER_NOTIFICATION_PHONE ?? "",
    process.env.STAFF_ALERT_PHONE ?? "",
    process.env.TWILIO_FROM_NUMBER ?? "",
  ].join(",");
  for (const part of staffEnv.split(/[,\s;]+/)) {
    const d = last10(part);
    if (d.length === 10) excluded.add(d);
  }

  const seen = new Set<string>();
  const recipients: Recipient[] = [];
  const skipped = {
    not_high_priority: 0,
    tour_scheduled: 0,
    recently_contacted: 0,
    duplicate_phone: 0,
    excluded_number: 0,
    invalid_phone: 0,
    already_campaigned: 0,
    closed_status: 0,
  };

  for (const l of leads ?? []) {
    const digits = last10(l.phone);
    if (digits.length !== 10) { skipped.invalid_phone++; continue; }
    if (l.crm_status === "Joined" || l.crm_status === "Lost Lead") { skipped.closed_status++; continue; }
    if (alreadyCampaigned.has(digits) || campaignedLeadIds.has(l.id)) { skipped.already_campaigned++; continue; }
    if (l.tour_scheduled && !l.tour_completed) { skipped.tour_scheduled++; continue; }

    const lastContact = l.last_contacted_at ?? l.last_sms_at ?? null;
    const since = daysSince(lastContact);
    if (since !== null && since < COOLDOWN_DAYS) { skipped.recently_contacted++; continue; }

    const priority = computePriority({
      crm_status: l.crm_status,
      last_contacted_at: l.last_contacted_at,
      next_follow_up_date: l.next_follow_up_date,
    });
    if (priority !== "high") { skipped.not_high_priority++; continue; }

    if (excluded.has(digits)) { skipped.excluded_number++; continue; }
    if (seen.has(digits)) { skipped.duplicate_phone++; continue; }
    seen.add(digits);
    recipients.push({
      id: l.id,
      name: l.name,
      phone: `+1${digits}`,
      digits,
      created_at: l.created_at,
      source: l.source,
      message: buildCampaignMessage(l.name),
      next_follow_up_date: l.next_follow_up_date ?? null,
      last_contacted_at: lastContact,
      days_since_contact: since,
      crm_status: l.crm_status ?? "New Lead",
      priority,
      tour_status: l.tour_completed
        ? "Tour completed"
        : l.tour_scheduled
          ? "Tour scheduled"
          : "No tour",
    });
  }

  return { recipients, skipped };
}


export const previewReengagementCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { recipients, skipped } = await buildAudience();
    return { ok: true as const, count: recipients.length, recipients, skipped };
  });

export const sendReengagementCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const d = data as { confirm?: string };
    if (d?.confirm !== "SEND") throw new Error("confirmation_required");
    return { confirm: "SEND" as const };
  })
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recipients } = await buildAudience();

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    if (!sid || !token || !from) {
      return { ok: false as const, error: "twilio_not_configured" };
    }
    const auth = btoa(`${sid}:${token}`);

    const results: { name: string; phone: string; ok: boolean; error?: string }[] = [];

    for (const r of recipients) {
      // Re-check idempotency right before each send.
      const { data: existing } = await supabaseAdmin
        .from("sms_conversation_log")
        .select("id, metadata")
        .eq("lead_id", r.id)
        .limit(50);
      if ((existing ?? []).length > 0) {
        results.push({ name: r.name, phone: r.phone, ok: false, error: "sms_history_appeared" });
        continue;
      }

      let sendOk = false;
      let providerId: string | null = null;
      let error: string | undefined;
      try {
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${auth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: r.phone,
              From: from,
              Body: r.message,
              StatusCallback:
                "https://pjntdyhshxwhsxnwjylk.supabase.co/functions/v1/twilio-status-callback",
            }),
          },
        );
        if (!res.ok) {
          error = `twilio_${res.status}`;
          console.error("[reengagement] twilio error", res.status, await res.text());
        } else {
          const json = (await res.json()) as { sid?: string };
          providerId = json.sid ?? null;
          sendOk = true;
        }
      } catch (e) {
        error = e instanceof Error ? e.message : "send_exception";
      }

      await supabaseAdmin.from("sms_conversation_log").insert({
        lead_id: r.id,
        phone: r.phone,
        direction: "outbound",
        body: r.message,
        from_ai: false,
        provider_message_id: providerId,
        status: sendOk ? "sent" : "failed",
        metadata: {
          kind: CAMPAIGN_KIND,
          sent_by: "admin_campaign",
          campaign: "end_of_summer_free_week",
          ...(error ? { error } : {}),
        },
      });

      if (sendOk) {
        const sentAt = new Date().toISOString();
        const nextFollowUp = advanceFollowUpIfStale(r.next_follow_up_date);
        await supabaseAdmin
          .from("leads")
          .update({
            last_sms_at: sentAt,
            last_contacted_at: sentAt,
            last_contact_method: "sms",
            crm_status: "Contacted",
            sequence_status: "paused",
            ...(nextFollowUp ? { next_follow_up_date: nextFollowUp } : {}),
          })
          .eq("id", r.id);
      }

      results.push({ name: r.name, phone: r.phone, ok: sendOk, ...(error ? { error } : {}) });
    }

    return {
      ok: true as const,
      attempted: results.length,
      sent: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  });
