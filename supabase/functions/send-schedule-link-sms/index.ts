// One-off admin utility: sends a personalized appointment scheduling link
// to a specific lead and logs it to the conversation log so the Lead
// Tracker stays in sync. Invoked manually with the service role key.
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

async function sendTwilioSms(to: string, body: string) {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_FROM_NUMBER");
  if (!sid || !token || !from) {
    return { ok: false as const, error: "twilio_not_configured" };
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
    return { ok: false as const, error: `twilio_${res.status}: ${await res.text()}` };
  }
  const json = (await res.json()) as { sid?: string };
  return { ok: true as const, sid: json.sid };
}

Deno.serve(async (req) => {
  try {
    const body = (await req.json().catch(() => null)) as
      | { lead_id?: string }
      | null;
    if (!body?.lead_id) {
      return Response.json({ ok: false, error: "lead_id required" }, { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: lead, error } = await supabase
      .from("leads")
      .select("id, name, email, phone, sms_opted_out")
      .eq("id", body.lead_id)
      .maybeSingle();

    if (error || !lead) {
      return Response.json({ ok: false, error: "lead_not_found" }, { status: 404 });
    }
    if (!lead.phone) {
      return Response.json({ ok: false, error: "no_phone" }, { status: 400 });
    }
    if (lead.sms_opted_out) {
      return Response.json({ ok: false, error: "opted_out" }, { status: 400 });
    }

    const to = normalizePhone(lead.phone);
    const message = `Hey ${firstName(lead.name)}! FIT Beyond Plus here — you can pick a time to come by for a tour or day pass right here: fitbeyondplus.com/schedule-visit?lead=${lead.id} — your info is already attached, so just choose whatever time works best for you 💪`;

    const isTest = (lead.email ?? "").trim().toLowerCase() === TEST_EMAIL;
    const now = new Date().toISOString();

    let sid: string | null = null;
    if (!isTest) {
      const result = await sendTwilioSms(to, message);
      if (!result.ok) {
        return Response.json({ ok: false, error: result.error }, { status: 502 });
      }
      sid = result.sid ?? null;
    }

    await supabase
      .from("leads")
      .update({
        last_sms_at: now,
        last_contacted_at: now,
        last_contact_method: "sms",
        sequence_status: "paused",
        crm_status: "Waiting on Response",
      })
      .eq("id", lead.id);

    await supabase.from("sms_conversation_log").insert({
      lead_id: lead.id,
      phone: to,
      direction: "outbound",
      body: isTest ? `TEST MODE - SMS not sent | ${message}` : message,
      from_ai: false,
      provider_message_id: sid,
      status: isTest ? "test_mode" : "sent",
      metadata: { kind: "schedule_link", sent_by: "staff", test_mode: isTest },
    });

    return Response.json({ ok: true, test_mode: isTest, sid, to, message });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "exception" },
      { status: 500 },
    );
  }
});
