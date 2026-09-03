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
    .select("phone, created_at, metadata, status")
    .eq("direction", "outbound")
    .neq("status", "failed")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(500);
  for (const row of (data ?? []) as Array<{
    phone: string | null;
    created_at: string;
    metadata: Record<string, unknown> | null;
    status: string | null;
  }>) {
    // A failed send never happened as far as pacing is concerned.
    if (row.status === "failed") continue;
    if (last10(row.phone) !== digits) continue;
    const kind = (row.metadata?.["kind"] ?? "") as string;
    if (!AUTOMATED_KINDS.includes(kind)) continue;

    return row.created_at;
  }
  return null;
}


// ---------------------------------------------------------------------------
// Personalized copy — mirrored from src/lib/followup-copy.ts (separate Deno
// runtime cannot import from src/). Keep the two in sync. Fixed templates,
// selected by what the lead actually asked about. Raw form text is never
// spliced into a sentence.
// ---------------------------------------------------------------------------

type LeadCategory =
  | "kickboxing"
  | "bjj_kids"
  | "bjj"
  | "personal_training"
  | "classes"
  | "weight_loss"
  | "day_pass"
  | "referral"
  | "general";

function categorizeLead(
  interest: string | null | undefined,
  source: string | null | undefined,
): LeadCategory {
  const t = `${interest ?? ""}`.toLowerCase();
  const s = `${source ?? ""}`.toLowerCase();
  const has = (...words: string[]) => words.some((w) => t.includes(w));

  if (has("kickbox", "muay thai", "striking")) return "kickboxing";
  if (has("bjj", "jiu", "jujitsu", "jiu-jitsu", "grappl", "wrestl")) {
    return has("kid", "child", "son", "daughter", "youth", "teen") ? "bjj_kids" : "bjj";
  }
  if (has("kid", "child", "youth", "teen")) return "bjj_kids";
  if (has("personal train", "pt", "one on one", "1 on 1", "trainer", "coach")) {
    return "personal_training";
  }
  if (has("class", "group", "yoga", "barre", "hiit", "cardio class")) return "classes";
  if (has("weight", "lose", "loss", "tone", "shape", "fat", "get fit", "get in shape")) {
    return "weight_loss";
  }
  if (has("day pass", "drop in", "drop-in", "visit", "tour")) return "day_pass";
  if (s === "day_pass_walkin") return "day_pass";
  if (s === "referral_day_pass" || s.includes("referral")) return "referral";
  return "general";
}

const HOOK: Record<LeadCategory, string> = {
  kickboxing: "our kickboxing classes are honestly the most fun way to get in shape here",
  bjj_kids: "our kids Brazilian Jiu-Jitsu classes are a great fit for building confidence",
  bjj: "our adult Brazilian Jiu-Jitsu classes run several nights a week, beginners welcome",
  personal_training: "our trainers build you a real plan instead of guessing",
  classes: "our group classes make it easy to show up and just follow along",
  weight_loss: "most people see the biggest change once they have a real plan to follow",
  day_pass: "you're welcome to come use the gym anytime and see how it feels",
  referral: "your friend already knows how good it is in here",
  general: "we'll help you figure out the right starting point",
};

const INVITE: Record<LeadCategory, string> = {
  kickboxing: "come try a kickboxing class on us",
  bjj_kids: "bring them by to watch or try a kids class",
  bjj: "come try a BJJ class on us",
  personal_training: "come in for a free walkthrough with one of our trainers",
  classes: "come try a class on us",
  weight_loss: "come in for a quick walkthrough and we'll map out a plan",
  day_pass: "come by for a free visit",
  referral: "come by for your free visit",
  general: "come by for a free visit",
};

type CopyLead = { name?: string | null; interest?: string | null; source?: string | null };

function buildFollowupMessage(step: number, lead: CopyLead): string {
  const fn = firstName(lead.name ?? null);
  const cat = categorizeLead(lead.interest, lead.source);
  const hook = HOOK[cat];
  const invite = INVITE[cat];

  switch (step) {
    case 1:
      return `Hey ${fn}, just making sure you saw my message! We'd love to have you check out FIT Beyond Plus — ${invite} whenever it works for you. Still interested? 💪`;
    case 2:
      return `${fn}, no pressure at all — but if you want to see the place for yourself, say the word and I'll ${invite === "come by for a free visit" ? "get you set up with a free visit" : `set you up to ${invite}`}. Takes about 15 minutes, zero obligation.`;
    case 3:
      return `${fn}, ${hook}. That's kind of our thing at FIT Beyond Plus. Whenever you're ready, we've got you.`;
    default:
      return `${fn}, let's make this easy — try FIT Beyond Plus free for 7 days. Full access, no strings, and you can ${invite} while you're at it. Just reply YES and I'll get you set up.`;
  }
}

function buildPostvisitMessage(step: number, lead: CopyLead): string {
  const fn = firstName(lead.name ?? null);
  const cat = categorizeLead(lead.interest, lead.source);
  const referral = (lead.source ?? "").toLowerCase().includes("referral");

  if (step <= 1) {
    return referral
      ? `Hey ${fn}, hope you loved your visit today at FIT Beyond Plus! 💪 Glad your friend sent you our way — any questions about membership or classes?`
      : `Hey ${fn}, hope you loved your visit today at FIT Beyond Plus! 💪 Any questions about membership, classes, or anything you want to know more about?`;
  }

  const nudge =
    cat === "kickboxing" || cat === "bjj" || cat === "bjj_kids" || cat === "classes"
      ? " We can also get you on the class schedule so you know exactly when to come in."
      : cat === "personal_training"
        ? " We can also pair you with a trainer so you've got a plan from day one."
        : "";
  return `Hey ${fn}! Still thinking about it? We'd love to have you as a member.${nudge} Just reply here 🙏`;
}

// Cold cadence: 4 follow-ups after the initial welcome text (days since created_at).
const FOLLOWUPS: Array<{ minDays: number }> = [
  { minDays: 1 },
  { minDays: 3 },
  { minDays: 5 },
  { minDays: 7 },
];

// Post-visit sequence for day-pass walk-ins / referral day-pass leads with a
// completed tour. Anchored on tour_date (hours since). Completes after step 2.
const POSTVISIT: Array<{ minHours: number }> = [{ minHours: 3 }, { minHours: 24 }];


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
          body = buildPostvisitMessage(idx + 1, lead);
          newCount = idx + 1;
          markCompleted = newCount >= POSTVISIT.length;
          stepLabel = `postvisit_${newCount}`;
        } else {
          if (idx < 0 || idx >= FOLLOWUPS.length) continue;
          const step = FOLLOWUPS[idx];
          const createdMs = lead.created_at ? new Date(lead.created_at).getTime() : 0;
          const daysSinceCreated = (now - createdMs) / (1000 * 60 * 60 * 24);
          if (daysSinceCreated < step.minDays) continue;
          body = buildFollowupMessage(idx + 1, lead);
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
          // Log the failure durably so an outage (bad credentials, unfunded
          // account) is visible in the Lead Tracker instead of only in the
          // function logs. followup_count is intentionally NOT advanced, so the
          // step is retried once sending works again.
          await supabase.from("sms_conversation_log").insert({
            lead_id: lead.id,
            phone: to,
            direction: "outbound",
            body,
            from_ai: false,
            provider_message_id: null,
            status: "failed",
            metadata: {
              kind: usePostVisit ? "postvisit" : "drip",
              step: stepLabel,
              error: send.error,
            },
          });
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
