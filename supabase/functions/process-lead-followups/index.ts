// Runs every 15 minutes via pg_cron. Sends Hormozi Gym Launch drip SMS to active leads.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const TEST_EMAIL = "smstest@fitbeyondplus.com";

function firstName(name: string | null): string {
  if (!name) return "there";
  return name.trim().split(/\s+/)[0] || "there";
}

function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return "+" + trimmed.slice(1).replace(/\D/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

async function sendTwilioSms(
  to: string,
  body: string,
): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_FROM_NUMBER");
  if (!sid || !token || !from) return { ok: false, error: "twilio_not_configured" };

  const auth = btoa(`${sid}:${token}`);
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: to,
        From: from,
        Body: body,
        StatusCallback:
          "https://pjntdyhshxwhsxnwjylk.supabase.co/functions/v1/twilio-status-callback",
      }),
    },
  );
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, error: `twilio_${res.status}: ${t}` };
  }
  const json = (await res.json()) as { sid?: string };
  return { ok: true, sid: json.sid };
}

// Pacing guardrails — mirrored from src/lib/sms-pacing.ts (separate runtime,
// cannot share the module). Keep values in sync. The drip must never fire
// back-to-back just because several steps are already "due" for an older lead,
// and it must not land on top of another automated job's text.
const MIN_GAP_HOURS_DRIP = 48;
const MIN_GAP_HOURS_POSTVISIT = 3;
const MIN_GAP_HOURS_AUTOMATED = 24;
const QUIET_START_HOUR = 9; // 9:00 am Chicago
const QUIET_END_HOUR = 19; // last send starts before 7:00 pm Chicago
const AUTOMATED_KINDS = ["drip", "post_trial_nudge", "free_week_reactivation"];

function chicagoHour(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  return Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
}

function last10(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "").slice(-10);
}

// Most recent AUTOMATED outbound text to this phone number, regardless of
// which lead record or which job sent it.
// deno-lint-ignore no-explicit-any
async function lastAutomatedOutboundForPhone(
  supabase: any,
  phone: string | null | undefined,
  nowMs: number,
): Promise<string | null> {
  const digits = last10(phone);
  if (digits.length !== 10) return null;
  const sinceIso = new Date(nowMs - 96 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("sms_conversation_log")
    .select("phone, created_at, metadata")
    .eq("direction", "outbound")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(500);
  for (const row of (data ?? []) as Array<{
    phone: string | null;
    created_at: string;
    metadata: Record<string, unknown> | null;
  }>) {
    if (last10(row.phone) !== digits) continue;
    const kind = (row.metadata?.["kind"] ?? "") as string;
    if (!AUTOMATED_KINDS.includes(kind)) continue;
    return row.created_at;
  }
  return null;
}


// Cold cadence: 4 follow-ups after the initial welcome text.
// Each entry: { minDays, build(fn) } — minimum days since lead created_at.
const FOLLOWUPS: Array<{ minDays: number; build: (fn: string, interest?: string | null) => string }> = [

  {
    minDays: 1,
    build: (fn) =>
      `Hey ${fn}, just wanted to make sure you saw my message! We'd love to have you come check out FIT Beyond Plus. Still interested? 💪`,
  },
  {
    minDays: 3,
    build: (fn) =>
      `${fn}, no pressure at all — but if you want to swing by and see the gym for yourself, just say the word and I'll get you set up with a free visit. Takes 15 minutes, zero obligation.`,
  },
  {
    minDays: 5,
    build: (fn, interest) => {
      const goal = interest?.trim();
      if (goal) {
        return `${fn}, a lot of people who come in wanting to ${goal} end up surprised how fast things click once they have a real plan. That's kind of our thing here. Whenever you're ready, we've got you.`;
      }
      return `A lot of our members came in not knowing exactly what they wanted and left with a real plan. That's kind of our thing at FIT Beyond Plus. Happy to do the same for you whenever you're ready.`;
    },
  },
  {
    minDays: 7,
    build: (fn) =>
      `${fn}, let's make this easy — come try FIT Beyond Plus completely free for 7 days. Full access, no strings, see if it's the right fit. Just reply YES and I'll get you set up.`,
  },
];

// Post-visit sequence for day-pass walk-ins / referral day-pass leads with a completed tour.
// Anchored on tour_date (hours since). Completes after step 2.
const POSTVISIT: Array<{ minHours: number; build: (fn: string) => string }> = [
  {
    minHours: 3,
    build: (fn) =>
      `Hey ${fn}, hope you loved your visit today at FIT Beyond Plus! 💪 Any questions about membership or anything you want to know more about?`,
  },
  {
    minHours: 24,
    build: (fn) =>
      `Hey ${fn}! Still thinking about it? We'd love to have you as a member — happy to answer any questions or set up a time to chat. Just reply here 🙏`,
  },
];

function isDayPassSource(source: string | null): boolean {
  const s = (source ?? "").toLowerCase();
  return s === "day_pass_walkin" || s === "referral_day_pass";
}

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Quiet hours: nothing automated goes out outside 9:00am-7:00pm Chicago.
    const hourNowChicago = chicagoHour(new Date());
    if (hourNowChicago < QUIET_START_HOUR || hourNowChicago >= QUIET_END_HOUR) {
      return new Response(
        JSON.stringify({ ok: true, skipped: "quiet_hours", hour: hourNowChicago }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    const { data: leads, error } = await supabase
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
      .lt("followup_count", FOLLOWUPS.length)
      .not("crm_status", "in", '("Joined","Lost Lead")');

    if (error) {
      console.error("[process-lead-followups] query error", error);
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const now = Date.now();
    let processed = 0;
    let sent = 0;
    const results: Array<Record<string, unknown>> = [];

    for (const lead of leads ?? []) {
      processed++;
      try {
        if (!lead.phone) continue;
        const idx = (lead.followup_count ?? 0) as number;

        // Post-visit sequence takes precedence for day-pass leads with a completed tour.
        // These leads never run the cold FOLLOWUPS array.
        const usePostVisit = isDayPassSource(lead.source) && lead.tour_completed === true;

        let body: string;
        let stepLabel: string;
        let newCount: number;
        let markCompleted: boolean;

        // Pacing: measure from the last time we actually texted them (welcome
        // text, promo nudge, manual staff text — anything outbound counts),
        // and additionally from any automated text sent to the same phone
        // number by another job, even under a different lead record.
        const minGapHours = usePostVisit ? MIN_GAP_HOURS_POSTVISIT : MIN_GAP_HOURS_DRIP;
        const { data: lastOut } = await supabase
          .from("sms_conversation_log")
          .select("created_at")
          .eq("lead_id", lead.id)
          .eq("direction", "outbound")
          .order("created_at", { ascending: false })
          .limit(1);
        const lastOutIso = lastOut?.[0]?.created_at ?? lead.last_sms_at ?? null;
        if (lastOutIso) {
          const hoursSinceLast = (now - new Date(lastOutIso).getTime()) / (1000 * 60 * 60);
          // Hard cap of one automated text per lead per day, plus the
          // sequence-specific minimum gap.
          if (hoursSinceLast < Math.max(minGapHours, MIN_GAP_HOURS_AUTOMATED)) {
            results.push({ lead_id: lead.id, ok: true, skipped: "too_soon" });
            continue;
          }
        }

        const lastAutomatedIso = await lastAutomatedOutboundForPhone(supabase, lead.phone, now);
        if (lastAutomatedIso) {
          const hoursSince = (now - new Date(lastAutomatedIso).getTime()) / (1000 * 60 * 60);
          if (hoursSince < MIN_GAP_HOURS_AUTOMATED) {
            results.push({ lead_id: lead.id, ok: true, skipped: "too_soon_other_job" });
            continue;
          }
        }


        if (usePostVisit) {
          if (idx < 0 || idx >= POSTVISIT.length) continue;
          const step = POSTVISIT[idx];
          const anchorIso = lead.tour_date ?? lead.created_at;
          const anchorMs = anchorIso ? new Date(anchorIso).getTime() : 0;
          const hoursSince = (now - anchorMs) / (1000 * 60 * 60);
          if (hoursSince < step.minHours) continue;
          body = step.build(firstName(lead.name ?? ""));
          newCount = idx + 1;
          markCompleted = newCount >= POSTVISIT.length;
          stepLabel = `postvisit_${newCount}`;
        } else {
          if (idx < 0 || idx >= FOLLOWUPS.length) continue;
          const step = FOLLOWUPS[idx];
          const createdMs = lead.created_at ? new Date(lead.created_at).getTime() : 0;
          const daysSinceCreated = (now - createdMs) / (1000 * 60 * 60 * 24);
          if (daysSinceCreated < step.minDays) continue;
          body = step.build(firstName(lead.name ?? ""), lead.interest ?? null);
          newCount = idx + 1;
          markCompleted = newCount >= FOLLOWUPS.length;
          stepLabel = `followup_${newCount}`;
        }


        const to = normalizePhone(lead.phone);
        const update: Record<string, unknown> = {
          last_sms_at: new Date().toISOString(),
          followup_count: newCount,
        };
        if (markCompleted) update.sequence_status = "completed";

        const isTest = (lead.email ?? "").trim().toLowerCase() === TEST_EMAIL;

        if (isTest) {
          await supabase.from("leads").update(update).eq("id", lead.id);
          await supabase.from("sms_conversation_log").insert({
            lead_id: lead.id,
            phone: to,
            direction: "outbound",
            body: `TEST MODE - SMS not sent | ${body}`,
            from_ai: false,
            provider_message_id: null,
            status: "test_mode",
            metadata: { kind: usePostVisit ? "postvisit" : "drip", step: stepLabel, test_mode: true },
          });
          sent++;
          results.push({ lead_id: lead.id, step: stepLabel, ok: true, test_mode: true });
          continue;
        }

        const send = await sendTwilioSms(to, body);
        if (!send.ok) {
          console.error(
            `[process-lead-followups] send failed lead=${lead.id} step=${stepLabel}`,
            send.error,
          );
          results.push({ lead_id: lead.id, step: stepLabel, ok: false, error: send.error });
          continue;
        }

        await supabase.from("leads").update(update).eq("id", lead.id);
        await supabase.from("sms_conversation_log").insert({
          lead_id: lead.id,
          phone: to,
          direction: "outbound",
          body,
          from_ai: false,
          provider_message_id: send.sid ?? null,
          status: "sent",
          metadata: { kind: usePostVisit ? "postvisit" : "drip", step: stepLabel },
        });
        sent++;
        results.push({ lead_id: lead.id, step: stepLabel, ok: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[process-lead-followups] lead ${lead.id} exception`, msg);
        results.push({ lead_id: lead.id, ok: false, error: msg });
      }
    }

    return new Response(JSON.stringify({ ok: true, processed, sent, results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[process-lead-followups] fatal", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
