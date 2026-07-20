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
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    },
  );
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, error: `twilio_${res.status}: ${t}` };
  }
  const json = (await res.json()) as { sid?: string };
  return { ok: true, sid: json.sid };
}

// Hormozi Gym Launch cadence: 6 follow-ups after the initial welcome text.
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
  {
    minDays: 10,
    build: (_fn) =>
      `No contracts, no pressure, no weird sales pitch — just wanted you to know that's genuinely how we operate at FIT Beyond Plus. Whenever you're ready, we're here.`,
  },
  {
    minDays: 14,
    build: (fn) =>
      `${fn}, last message from me — the 7-day free trial offer is still on the table if you want it, no pressure either way. Just reply here anytime, we're at 449 W Lincoln St in Tullahoma 🙏`,
  },
];

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: leads, error } = await supabase
      .from("leads")
      .select(
        "id, name, email, phone, interest, created_at, followup_count, sequence_status, crm_status, last_response_at",
      )
      .eq("lead_type", "customer_lead")
      .eq("should_notify", true)
      .eq("sms_opted_out", false)
      .eq("became_member", false)
      .eq("sequence_status", "active")
      .is("last_response_at", null)
      .lt("followup_count", 6)
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
        if (idx < 0 || idx >= FOLLOWUPS.length) continue;

        const step = FOLLOWUPS[idx];
        const createdMs = lead.created_at ? new Date(lead.created_at).getTime() : 0;
        const daysSinceCreated = (now - createdMs) / (1000 * 60 * 60 * 24);
        if (daysSinceCreated < step.minDays) continue;

        const to = normalizePhone(lead.phone);
        const body = step.build(firstName(lead.name ?? ""), lead.interest ?? null);
        const newCount = idx + 1;
        const update: Record<string, unknown> = {
          last_sms_at: new Date().toISOString(),
          followup_count: newCount,
        };
        if (newCount >= 6) update.sequence_status = "completed";

        const stepLabel = `followup_${newCount}`;
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
            metadata: { kind: "drip", step: stepLabel, test_mode: true },
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
          metadata: { kind: "drip", step: stepLabel },
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
