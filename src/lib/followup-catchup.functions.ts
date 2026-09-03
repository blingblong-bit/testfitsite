import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildFollowupMessage,
  buildPostvisitMessage,
  categorizeLead,
  FOLLOWUP_MIN_DAYS,
  POSTVISIT_MIN_HOURS,
} from "./followup-copy";
import { isQuietHours, MIN_GAP_HOURS_AUTOMATED } from "./sms-pacing";

// One-time catch-up pass for leads whose automated follow-up text failed while
// the texting account was rejecting sends. The cron job only advances a lead's
// step counter after Twilio accepts, so every skipped lead is still "due" — we
// send exactly ONE text each (the correct next step), never a stack.

const CATCHUP_STATUSES_EXCLUDED = ["Joined", "Lost Lead"];

type Candidate = {
  id: string;
  name: string | null;
  phone: string;
  step_label: string;
  kind: "drip" | "postvisit";
  next_count: number;
  mark_completed: boolean;
  category: string;
  message: string;
  interest: string | null;
  source: string | null;
  last_outbound_at: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !isAdmin) throw new Error("forbidden");
}

function last10(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "").slice(-10);
}

function isDayPassSource(source: string | null): boolean {
  const s = (source ?? "").toLowerCase();
  return s === "day_pass_walkin" || s === "referral_day_pass";
}

async function buildAudience() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: leads, error } = await supabaseAdmin
    .from("leads")
    .select(
      "id, name, email, phone, interest, source, created_at, tour_completed, tour_date, followup_count, sequence_status, crm_status, last_response_at, last_sms_at",
    )
    .eq("lead_type", "customer_lead")
    .eq("should_notify", true)
    .eq("sms_opted_out", false)
    .eq("became_member", false)
    .eq("sequence_status", "active")
    .is("last_response_at", null)
    .not("phone", "is", null);
  if (error) throw new Error(error.message);

  // Successful outbound history, used for the 24-hour per-person cap. Failed
  // rows are ignored on purpose — a rejected send never reached anyone.
  const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: outbound, error: smsErr } = await supabaseAdmin
    .from("sms_conversation_log")
    .select("phone, created_at, status")
    .eq("direction", "outbound")
    .neq("status", "failed")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (smsErr) throw new Error(smsErr.message);

  const lastSuccessByPhone = new Map<string, string>();
  for (const row of outbound ?? []) {
    const d = last10(row.phone);
    if (d.length !== 10) continue;
    if (!lastSuccessByPhone.has(d)) lastSuccessByPhone.set(d, row.created_at);
  }

  const now = Date.now();
  const candidates: Candidate[] = [];
  const skipped = {
    not_due: 0,
    texted_recently: 0,
    closed_status: 0,
    sequence_finished: 0,
    invalid_phone: 0,
  };

  for (const lead of leads ?? []) {
    const digits = last10(lead.phone);
    if (digits.length !== 10) {
      skipped.invalid_phone++;
      continue;
    }
    if (CATCHUP_STATUSES_EXCLUDED.includes(lead.crm_status ?? "")) {
      skipped.closed_status++;
      continue;
    }

    const idx = lead.followup_count ?? 0;
    const usePostVisit = isDayPassSource(lead.source) && lead.tour_completed === true;
    const steps = usePostVisit ? POSTVISIT_MIN_HOURS : FOLLOWUP_MIN_DAYS;
    if (idx < 0 || idx >= steps.length) {
      skipped.sequence_finished++;
      continue;
    }

    // Is this step actually due?
    let due = false;
    if (usePostVisit) {
      const anchorIso = lead.tour_date ?? lead.created_at;
      const hoursSince = (now - new Date(anchorIso).getTime()) / (1000 * 60 * 60);
      due = hoursSince >= POSTVISIT_MIN_HOURS[idx];
    } else {
      const daysSince = (now - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24);
      due = daysSince >= FOLLOWUP_MIN_DAYS[idx];
    }
    if (!due) {
      skipped.not_due++;
      continue;
    }

    // 24-hour per-person cap still applies, so a catch-up never lands on top of
    // a text they just received.
    const lastOk = lastSuccessByPhone.get(digits) ?? null;
    if (lastOk) {
      const hoursSince = (now - new Date(lastOk).getTime()) / (1000 * 60 * 60);
      if (hoursSince < MIN_GAP_HOURS_AUTOMATED) {
        skipped.texted_recently++;
        continue;
      }
    }

    const nextCount = idx + 1;
    const copyLead = { name: lead.name, interest: lead.interest, source: lead.source };
    candidates.push({
      id: lead.id,
      name: lead.name,
      phone: `+1${digits}`,
      kind: usePostVisit ? "postvisit" : "drip",
      step_label: usePostVisit ? `postvisit_${nextCount}` : `followup_${nextCount}`,
      next_count: nextCount,
      mark_completed: nextCount >= steps.length,
      category: categorizeLead(lead.interest, lead.source),
      message: usePostVisit
        ? buildPostvisitMessage(nextCount, copyLead)
        : buildFollowupMessage(nextCount, copyLead),
      interest: lead.interest ?? null,
      source: lead.source ?? null,
      last_outbound_at: lastOk,
    });
  }

  return { candidates, skipped };
}

export const previewFollowupCatchup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { candidates, skipped } = await buildAudience();
    return {
      ok: true as const,
      count: candidates.length,
      quiet_hours: isQuietHours(),
      candidates,
      skipped,
    };
  });

export const sendFollowupCatchup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const d = data as { confirm?: string };
    if (d?.confirm !== "SEND") throw new Error("confirmation_required");
    return { confirm: "SEND" as const };
  })
  .handler(async ({ context }) => {
    await assertAdmin(context as never);

    if (isQuietHours()) {
      return { ok: false as const, error: "quiet_hours" };
    }

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    if (!sid || !token || !from) return { ok: false as const, error: "twilio_not_configured" };
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { candidates } = await buildAudience();

    const results: Array<{ name: string | null; phone: string; step: string; ok: boolean; error?: string }> = [];

    for (const c of candidates) {
      let sendOk = false;
      let providerId: string | null = null;
      let error: string | undefined;

      try {
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: c.phone,
            From: from,
            Body: c.message,
            StatusCallback:
              "https://pjntdyhshxwhsxnwjylk.supabase.co/functions/v1/twilio-status-callback",
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          error = `twilio_${res.status}`;
          console.error("[followup-catchup] twilio error", res.status, text);
        } else {
          const json = (await res.json()) as { sid?: string };
          providerId = json.sid ?? null;
          sendOk = true;
        }
      } catch (e) {
        error = e instanceof Error ? e.message : "send_exception";
      }

      await supabaseAdmin.from("sms_conversation_log").insert({
        lead_id: c.id,
        phone: c.phone,
        direction: "outbound",
        body: c.message,
        from_ai: false,
        provider_message_id: providerId,
        status: sendOk ? "sent" : "failed",
        metadata: {
          kind: c.kind,
          step: c.step_label,
          sent_by: "admin_catchup",
          catchup: true,
          ...(error ? { error } : {}),
        },
      });

      if (sendOk) {
        const sentAt = new Date().toISOString();
        await supabaseAdmin
          .from("leads")
          .update({
            last_sms_at: sentAt,
            followup_count: c.next_count,
            ...(c.mark_completed ? { sequence_status: "completed" } : {}),
          })
          .eq("id", c.id);
      }

      results.push({
        name: c.name,
        phone: c.phone,
        step: c.step_label,
        ok: sendOk,
        ...(error ? { error } : {}),
      });
    }

    return {
      ok: true as const,
      attempted: results.length,
      sent: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  });
