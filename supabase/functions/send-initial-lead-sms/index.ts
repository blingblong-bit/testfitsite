// Fires from a Supabase database webhook on leads INSERT.
// Sends the personalized first SMS immediately for qualifying leads.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const TEST_EMAIL = "smstest@fitbeyondplus.com";

type LeadRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  interest: string | null;
  source: string | null;
  lead_type: string | null;
  should_notify: boolean | null;
  sms_opted_out: boolean | null;
  became_member: boolean | null;
  crm_status: string | null;
  last_sms_at: string | null;
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

function buildFirstMessage(
  name: string | null,
  interest: string | null,
  source: string | null,
): string {
  const fn = firstName(name);
  const topic = (interest ?? "").toLowerCase();
  const src = (source ?? "").toLowerCase();

  if (src === "day_pass_walkin") {
    return `Hey ${fn}! Thanks for coming in to FIT Beyond Plus today 🎟️ Hope you're loving the gym so far. Let us know if you have any questions — we're happy to help you get set up with a membership whenever you're ready!`;
  }
  if (src.includes("referral") || src.includes("day_pass") || src.includes("day pass")) {
    return `Hey ${fn}! FIT Beyond Plus here — heard you got referred to us, awesome! Want to swing by on a free day pass so we can show you around? 💪`;
  }
  if (topic.includes("personal") || topic.includes("training")) {
    return `Hey ${fn}! This is FIT Beyond Plus in Tullahoma — got your note about personal training. Want to swing by for a free day pass so we can show you around and talk goals? 💪`;
  }
  if (topic.includes("kick")) {
    return `Hey ${fn}! FIT Beyond Plus here — thanks for the interest in kickboxing! Happy to get you a free day pass so you can try a class. When works for you? 🥊`;
  }
  if (topic.includes("bjj") || topic.includes("jiu")) {
    return `Hey ${fn}! FIT Beyond Plus here — thanks for reaching out about BJJ. Happy to grab you a free day pass so you can come try a class. When works for you?`;
  }
  if (topic.includes("class")) {
    return `Hey ${fn}! FIT Beyond Plus here — thanks for reaching out about our classes. Happy to grab you a free day pass so you can try one out. When works for you? 💪`;
  }
  if (topic.includes("member")) {
    return `Hey ${fn}! This is FIT Beyond Plus — thanks for the interest in a membership! Want to come check out the gym on a free day pass first? Just reply and we'll set it up 💪`;
  }
  return `Hey ${fn}! This is FIT Beyond Plus in Tullahoma — thanks for reaching out! Want to come check us out on a free day pass? Just reply and we'll get you set up 💪`;
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

Deno.serve(async (req) => {
  try {
    // Supabase DB webhook payload: { type, table, record, old_record, schema }
    const payload = (await req.json().catch(() => null)) as
      | { type?: string; record?: LeadRow }
      | null;

    if (!payload || payload.type !== "INSERT" || !payload.record) {
      return new Response(JSON.stringify({ ok: false, error: "bad_payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const lead = payload.record;

    // Gate: only real customer leads that opted in and haven't been contacted
    if (
      lead.lead_type !== "customer_lead" ||
      lead.should_notify !== true ||
      lead.sms_opted_out === true ||
      lead.became_member === true ||
      lead.crm_status === "Joined" ||
      lead.crm_status === "Lost Lead" ||
      lead.last_sms_at !== null ||
      !lead.phone
    ) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const to = normalizePhone(lead.phone);
    const body = buildFirstMessage(lead.name, lead.interest, lead.source);

    const isTest = (lead.email ?? "").trim().toLowerCase() === TEST_EMAIL;
    const nowIso = new Date().toISOString();

    if (isTest) {
      const testBody = `TEST MODE - SMS not sent | ${body}`;
      await supabase
        .from("leads")
        .update({
          last_sms_at: nowIso,
          sequence_status: "active",
          crm_status: "Contacted",
        })
        .eq("id", lead.id);
      await supabase.from("sms_conversation_log").insert({
        lead_id: lead.id,
        phone: to,
        direction: "outbound",
        body: testBody,
        from_ai: false,
        provider_message_id: null,
        status: "test_mode",
        metadata: { kind: "initial", test_mode: true },
      });
      return new Response(
        JSON.stringify({ ok: true, test_mode: true, message: body }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    const send = await sendTwilioSms(to, body);
    if (!send.ok) {
      console.error("[send-initial-lead-sms] twilio error", send.error);
      return new Response(JSON.stringify({ ok: false, error: send.error }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("leads")
      .update({
        last_sms_at: nowIso,
        sequence_status: "active",
        crm_status: "Contacted",
      })
      .eq("id", lead.id);

    await supabase.from("sms_conversation_log").insert({
      lead_id: lead.id,
      phone: to,
      direction: "outbound",
      body,
      from_ai: false,
      provider_message_id: send.sid ?? null,
      status: "sent",
      metadata: { kind: "initial" },
    });

    return new Response(JSON.stringify({ ok: true, sid: send.sid }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[send-initial-lead-sms] fatal", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
