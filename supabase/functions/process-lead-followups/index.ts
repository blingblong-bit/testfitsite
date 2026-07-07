// Runs every 15 minutes via pg_cron. Sends drip SMS #1/#2/#3 to active leads.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

function text1(name: string, interest: string | null): string {
  const fn = firstName(name);
  const topic = (interest ?? "").toLowerCase();
  if (topic.includes("personal") || topic.includes("training")) {
    return `Hey ${fn}! This is FIT Beyond Plus in Tullahoma — got your note about personal training. Want to swing by for a free day pass so we can show you around and talk goals? 💪`;
  }
  if (topic.includes("class") || topic.includes("kick") || topic.includes("bjj") || topic.includes("jiu")) {
    return `Hey ${fn}! FIT Beyond Plus here — thanks for reaching out about our classes. Happy to grab you a free day pass so you can try one out. When works for you? 💪`;
  }
  if (topic.includes("member")) {
    return `Hey ${fn}! This is FIT Beyond Plus — thanks for the interest in a membership! Want to come check out the gym on a free day pass first? Just reply and we'll set it up 💪`;
  }
  return `Hey ${fn}! This is FIT Beyond Plus in Tullahoma — thanks for reaching out! Want to come check us out on a free day pass? Just reply and we'll get you set up 💪`;
}

function text2(name: string): string {
  return `Hey ${firstName(name)}, just wanted to make sure you got my message! We'd love to have you come check out FIT Beyond Plus. Still interested? 💪`;
}

function text3(name: string): string {
  return `${firstName(name)}, last thing I'll send — if now's not the right time, no worries at all. But if you want to check out the gym or have questions, just reply here anytime. We're at 449 W Lincoln St in Tullahoma 💪`;
}

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: leads, error } = await supabase
      .from("leads")
      .select("id, name, phone, interest, created_at, last_sms_at, last_response_at, sequence_status, crm_status")
      .eq("lead_type", "customer_lead")
      .eq("should_notify", true)
      .eq("sms_opted_out", false)
      .eq("became_member", false)
      .eq("sequence_status", "active")
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
        const to = normalizePhone(lead.phone);
        const createdMs = lead.created_at ? new Date(lead.created_at).getTime() : 0;
        const lastSmsMs = lead.last_sms_at ? new Date(lead.last_sms_at).getTime() : null;
        const minSinceCreated = (now - createdMs) / 60000;
        const hoursSinceSms = lastSmsMs ? (now - lastSmsMs) / 3600000 : null;

        let body: string | null = null;
        let update: Record<string, unknown> | null = null;
        let step: string | null = null;

        if (lastSmsMs === null && minSinceCreated > 5) {
          body = text1(lead.name ?? "", lead.interest);
          update = {
            last_sms_at: new Date().toISOString(),
            sequence_status: "active",
            crm_status: "Contacted",
          };
          step = "text_1";
        } else if (
          hoursSinceSms !== null &&
          hoursSinceSms >= 23 &&
          hoursSinceSms <= 25 &&
          lead.last_response_at === null
        ) {
          body = text2(lead.name ?? "");
          update = { last_sms_at: new Date().toISOString() };
          step = "text_2";
        } else if (
          hoursSinceSms !== null &&
          hoursSinceSms >= 71 &&
          hoursSinceSms <= 73 &&
          lead.last_response_at === null
        ) {
          body = text3(lead.name ?? "");
          update = {
            last_sms_at: new Date().toISOString(),
            sequence_status: "completed",
          };
          step = "text_3";
        }

        if (!body || !update) continue;

        const send = await sendTwilioSms(to, body);
        if (!send.ok) {
          console.error(`[process-lead-followups] send failed lead=${lead.id} step=${step}`, send.error);
          results.push({ lead_id: lead.id, step, ok: false, error: send.error });
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
          metadata: { kind: "drip", step },
        });
        sent++;
        results.push({ lead_id: lead.id, step, ok: true });
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
