// Antaris member sync — polls recent leads and marks conversions when a
// matching Active member is found in Antaris. READ-ONLY toward Antaris.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkMemberMatch, getMembershipAgreements } from "./antaris-client.ts";

const TEST_EMAIL = "smstest@fitbeyondplus.com";

// Reserved development/testing phone numbers — keep in sync with
// src/lib/sms.server.ts (separate runtime, cannot share the module).
const TEST_PHONE_NUMBERS = [
  "9315550001",
  "9315550002",
  "9315550003",
  "9315550004",
  "9315550005",
];

function isTestPhone(raw: string | null | undefined): boolean {
  return TEST_PHONE_NUMBERS.includes((raw ?? "").replace(/\D/g, "").slice(-10));
}

type LeadRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  last_sms_at: string | null;
  created_at: string | null;
};

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

// Pacing rules for AUTOMATED texts — mirrored from src/lib/sms-pacing.ts
// (separate runtime, cannot share the module). Keep values in sync.
const QUIET_START_HOUR = 9; // 9:00 am Chicago
const QUIET_END_HOUR = 19; // last automated send starts before 7:00 pm
const MIN_GAP_HOURS_AUTOMATED = 24;
const AUTOMATED_KINDS = ["drip", "post_trial_nudge", "free_week_reactivation"];

function chicagoHour(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  return Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
}

function isQuietHours(now: Date = new Date()): boolean {
  const hour = chicagoHour(now);
  return hour < QUIET_START_HOUR || hour >= QUIET_END_HOUR;
}

function last10(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "").slice(-10);
}

// True when another automated job already texted this person inside the
// minimum gap, or we're outside allowed hours.
async function automatedSendBlocked(
  supabase: ReturnType<typeof createClient>,
  phone: string | null | undefined,
  now: Date = new Date(),
): Promise<{ blocked: boolean; reason?: string }> {
  if (isQuietHours(now)) return { blocked: true, reason: "quiet_hours" };

  const digits = last10(phone);
  if (digits.length !== 10) return { blocked: false };

  const sinceIso = new Date(now.getTime() - 96 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("sms_conversation_log")
    .select("phone, created_at, metadata")
    .eq("direction", "outbound")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(500);

  for (const row of (data ?? []) as unknown as Array<{
    phone: string | null;
    created_at: string;
    metadata: Record<string, unknown> | null;
  }>) {
    if (last10(row.phone) !== digits) continue;
    const kind = (row.metadata?.["kind"] ?? "") as string;
    if (!AUTOMATED_KINDS.includes(kind)) continue;
    const hoursSince = (now.getTime() - new Date(row.created_at).getTime()) / (1000 * 60 * 60);
    return hoursSince < MIN_GAP_HOURS_AUTOMATED
      ? { blocked: true, reason: "too_soon" }
      : { blocked: false };
  }
  return { blocked: false };
}

async function sendWelcomeIfNeeded(
  supabase: ReturnType<typeof createClient>,
  lead: LeadRow,
): Promise<void> {
  if (lead.last_sms_at) return;
  if (!lead.phone) return;

  // Welcome-on-join is transactional, but still respect quiet hours so nobody
  // gets a 2am text; it will go out on the next sync inside business hours.
  if (isQuietHours()) return;

  // Atomically claim the send: only one run can flip last_sms_at from null,
  // so overlapping syncs can't both send a welcome text.
  const claimIso = new Date().toISOString();
  const { data: claimed, error: claimErr } = await supabase
    .from("leads")
    .update({ last_sms_at: claimIso })
    .eq("id", lead.id)
    .is("last_sms_at", null)
    .select("id");
  if (claimErr || !claimed || claimed.length === 0) return;


  const to = normalizePhone(lead.phone);
  const body = `Welcome to the FIT Beyond Plus family, ${firstName(lead.name)}! 💪 We're pumped to have you. If you ever have questions, need to update your schedule, or just want to know what's going on at the gym — just text here. See you soon!`;
  const now = new Date().toISOString();
  const isTest =
    (lead.email ?? "").trim().toLowerCase() === TEST_EMAIL || isTestPhone(lead.phone);

  if (isTest) {
    await supabase.from("leads").update({ last_sms_at: now }).eq("id", lead.id);
    await supabase.from("sms_conversation_log").insert({
      lead_id: lead.id,
      phone: to,
      direction: "outbound",
      body: `TEST MODE - SMS not sent | ${body}`,
      from_ai: false,
      provider_message_id: null,
      status: "test_mode",
      metadata: { kind: "welcome", test_mode: true, sent_by: "antaris_sync" },
    });
    return;
  }

  // Release the claim so a later run can retry.
  const releaseClaim = async () => {
    await supabase.from("leads").update({ last_sms_at: null }).eq("id", lead.id);
  };

  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_FROM_NUMBER");
  if (!sid || !token || !from) {
    console.error("[antaris-sync] missing Twilio env");
    await releaseClaim();
    return;
  }
  const auth = btoa(`${sid}:${token}`);
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    },
  );
  if (!res.ok) {
    console.error("[antaris-sync] twilio error", res.status, await res.text());
    await releaseClaim();
    return;
  }
  const j = (await res.json()) as { sid?: string };
  await supabase.from("leads").update({ last_sms_at: now }).eq("id", lead.id);

  await supabase.from("sms_conversation_log").insert({
    lead_id: lead.id,
    phone: to,
    direction: "outbound",
    body,
    from_ai: false,
    provider_message_id: j.sid ?? null,
    status: "sent",
    metadata: { kind: "welcome", sent_by: "antaris_sync" },
  });
}

async function sendSms(
  supabase: ReturnType<typeof createClient>,
  lead: { id: string; email: string | null },
  phone: string,
  body: string,
  kind: string,
): Promise<boolean> {
  const to = normalizePhone(phone);
  const isTest =
    (lead.email ?? "").trim().toLowerCase() === TEST_EMAIL || isTestPhone(phone);

  if (isTest) {
    await supabase.from("sms_conversation_log").insert({
      lead_id: lead.id,
      phone: to,
      direction: "outbound",
      body: `TEST MODE - SMS not sent | ${body}`,
      from_ai: false,
      provider_message_id: null,
      status: "test_mode",
      metadata: { kind, test_mode: true, sent_by: "antaris_sync" },
    });
    return true;
  }

  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_FROM_NUMBER");
  if (!sid || !token || !from) {
    console.error("[antaris-sync] missing Twilio env");
    return false;
  }
  const auth = btoa(`${sid}:${token}`);
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    },
  );
  if (!res.ok) {
    console.error("[antaris-sync] twilio error", res.status, await res.text());
    return false;
  }
  const j = (await res.json()) as { sid?: string };
  await supabase.from("sms_conversation_log").insert({
    lead_id: lead.id,
    phone: to,
    direction: "outbound",
    body,
    from_ai: false,
    provider_message_id: j.sid ?? null,
    status: "sent",
    metadata: { kind, sent_by: "antaris_sync" },
  });
  return true;
}

// Post-free-week re-engagement: trial ended, never became a paying member.
async function runPostTrialNudges(
  supabase: ReturnType<typeof createClient>,
): Promise<{ nudged: number; errors: number }> {
  let nudged = 0;
  let errors = 0;
  const nowIso = new Date().toISOString();

  const { data: refs, error } = await supabase
    .from("referrals")
    .select(
      "id, friend_name, lead_id, access_ends_at, leads!referrals_lead_id_fkey(id, name, email, phone, became_member, sms_opted_out)",
    )
    .eq("promo_type", "free_week")
    .eq("status", "redeemed")
    .eq("post_trial_nudge_sent", false)
    .not("lead_id", "is", null)
    .lt("access_ends_at", nowIso);

  if (error) {
    console.error("[antaris-sync] post-trial query failed", error.message);
    return { nudged, errors: 1 };
  }

  for (const r of (refs ?? []) as unknown as Array<{
    id: string;
    friend_name: string | null;
    lead_id: string;
    leads: {
      id: string;
      name: string | null;
      email: string | null;
      phone: string | null;
      became_member: boolean | null;
      sms_opted_out: boolean | null;
    } | null;
  }>) {
    try {
      const lead = r.leads;
      if (!lead) continue;
      if (lead.became_member === true) continue;
      if (lead.sms_opted_out) continue;
      if (!lead.phone) continue;

      // Cross-job pacing: quiet hours + no automated text inside 24h, so the
      // nudge never lands on top of a drip message.
      const pacing = await automatedSendBlocked(supabase, lead.phone);
      if (pacing.blocked) {
        console.log("[antaris-sync] nudge held", r.id, pacing.reason);
        continue;
      }


      const name = firstName(lead.name ?? r.friend_name);
      const body = `Hey ${name}! Your free week at FIT Beyond Plus just wrapped up — hope you loved it! Ready to make it official? Reply here and we'll get you set up, or stop by anytime.`;

      const ok = await sendSms(supabase, lead, lead.phone, body, "post_trial_nudge");
      if (!ok) {
        errors += 1;
        continue;
      }

      const ts = new Date().toISOString();
      const { error: refErr } = await supabase
        .from("referrals")
        .update({ post_trial_nudge_sent: true })
        .eq("id", r.id);
      if (refErr) throw refErr;

      const { error: leadErr } = await supabase
        .from("leads")
        .update({
          sequence_status: "active",
          crm_status: "Contacted",
          last_sms_at: ts,
          last_contact_method: "sms",
        })
        .eq("id", lead.id);
      if (leadErr) throw leadErr;

      nudged += 1;
    } catch (e) {
      errors += 1;
      console.error("[antaris-sync] post-trial nudge error", r.id, e);
    }
  }

  return { nudged, errors };
}

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, name, email, phone, notes, last_sms_at, created_at")
    .eq("became_member", false)
    .eq("lead_type", "customer_lead")
    .or("crm_status.is.null,and(crm_status.neq.Joined,crm_status.neq.Lost Lead)")
    .gte("created_at", since);

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  let checked = 0;
  let converted = 0;
  let errors = 0;

  for (const lead of (leads ?? []) as LeadRow[]) {
    checked += 1;
    try {
      const name = lead.name ?? "";
      const email = lead.email ?? "";
      const phone = lead.phone ?? "";
      if (!name && !email) continue;

      const match = await checkMemberMatch(name, email, phone);
      if (!match.isMember) continue;

      const ts = new Date().toISOString();

      // Free-week trial records in Antaris look like memberships but have a
      // $0(.01) price or a "free week" buyer note — never a real conversion.
      let freeWeek: { amount: string; note: string } | null = null;
      if (match.clientId) {
        try {
          const agreements = await getMembershipAgreements(match.clientId);
          for (const a of agreements) {
            const init = Number(a.initial_payment_amount ?? NaN);
            const rec = Number(a.recurring_payment_amount ?? NaN);
            const note = String(a.buyer_note ?? "");
            const cheap =
              (Number.isFinite(init) && init <= 0.01) ||
              (Number.isFinite(rec) && rec <= 0.01);
            const noted = note.toLowerCase().includes("free week");
            if (cheap || noted) {
              const amt = Number.isFinite(init) ? init : rec;
              freeWeek = {
                amount: Number.isFinite(amt) ? amt.toFixed(2) : "unknown",
                note,
              };
              break;
            }
          }
        } catch (e) {
          console.error("[antaris-sync] memberships lookup failed", lead.id, e);
        }
      }

      if (freeWeek) {
        const detail =
          `Antaris record detected as free-week trial (not a paying conversion) — payment: $${freeWeek.amount}, note: '${freeWeek.note}'`;
        // Sync runs every 2 hours; only note the trial once per detected amount
        // so the lead's history doesn't fill with identical lines all week.
        if ((lead.notes ?? "").includes(detail)) continue;
        const line = `[${ts}] ${detail}`;
        const notes = lead.notes ? `${lead.notes}\n${line}` : line;
        const { error: fwErr } = await supabase
          .from("leads")
          .update({ notes })
          .eq("id", lead.id);
        if (fwErr) throw fwErr;
        continue;
      }


      // Antaris date_joined is day-granular (YYYY-MM-DD), so compare days —
      // joining the same day the lead came in is still a genuine conversion.
      const joinDay = match.joinDate ? String(match.joinDate).slice(0, 10) : "";
      const leadDay = lead.created_at
        ? new Date(lead.created_at).toLocaleDateString("en-CA", {
            timeZone: "America/Chicago",
          })
        : "";
      const isGenuineConversion =
        /^\d{4}-\d{2}-\d{2}$/.test(joinDay) && !!leadDay && joinDay >= leadDay;

      const noteLine = isGenuineConversion
        ? `[${ts}] Converted — Antaris join date (${joinDay}) confirms signup on/after lead creation (${leadDay})`
        : `[${ts}] Existing member match — Antaris join date (${joinDay || "unavailable"}) predates lead creation (${leadDay})`;

      const nextNotes = lead.notes ? `${lead.notes}\n${noteLine}` : noteLine;

      const updatePayload: Record<string, unknown> = {
        became_member: true,
        crm_status: "Joined",
        sequence_status: "completed",
        converted_at: ts,
        should_notify: false,
        notes: nextNotes,
      };
      // Real Antaris join date (YYYY-MM-DD) — set for any confirmed member.
      if (match.joinDate) {
        const d = String(match.joinDate).slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) updatePayload.membership_start_date = d;
      }
      if (!isGenuineConversion) {
        updatePayload.lead_type = "existing_member";
      }


      const { error: updErr } = await supabase
        .from("leads")
        .update(updatePayload)
        .eq("id", lead.id);
      if (updErr) throw updErr;

      converted += 1;
      await sendWelcomeIfNeeded(supabase, lead);

    } catch (e) {
      errors += 1;
      console.error("[antaris-sync] lead error", lead.id, e);
    }
  }

  const nudge = await runPostTrialNudges(supabase);

  return new Response(
    JSON.stringify({
      checked,
      converted,
      errors: errors + nudge.errors,
      post_trial_nudged: nudge.nudged,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
