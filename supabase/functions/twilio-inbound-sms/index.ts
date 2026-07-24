// Twilio inbound SMS webhook — handles lead replies with Claude auto-response.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const OPT_OUT_KEYWORDS = new Set([
  "STOP",
  "STOPALL",
  "UNSUBSCRIBE",
  "CANCEL",
  "END",
  "QUIT",
]);

const TWIML_EMPTY = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

function twiml() {
  return new Response(TWIML_EMPTY, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
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
): Promise<{ sid?: string; ok: boolean; error?: string }> {
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
    console.error("[twilio] send error", res.status, t);
    return { ok: false, error: `twilio_${res.status}` };
  }
  const json = (await res.json()) as { sid?: string };
  return { ok: true, sid: json.sid };
}

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Parse Twilio form payload
    const form = await req.formData();
    const fromRaw = String(form.get("From") ?? "");
    const bodyRaw = String(form.get("Body") ?? "");
    if (!fromRaw) return twiml();

    const from = normalizePhone(fromRaw);
    const body = bodyRaw.trim();

    // Find lead by last-10-digits of phone (format-agnostic). Fetch candidates
    // whose stored phone contains the last 4 digits, then filter in-memory by
    // matching the normalized last-10-digits — leads may be stored as
    // "9314342243", "(931) 434-2243", "+19314342243", etc.
    const fromDigits = fromRaw.replace(/\D/g, "").slice(-10);
    const last4 = fromDigits.slice(-4);
    const { data: leadRows, error: leadErr } = await supabase
      .from("leads")
      .select("id, name, phone, interest, goal, sms_opted_out, notes, lead_type, created_at")
      .ilike("phone", `%${last4}%`)
      .order("created_at", { ascending: false })
      .limit(50);
    if (leadErr) console.error("[twilio-inbound-sms] select error", leadErr);
    const lead = (leadRows ?? []).find(
      (r) => (r.phone ?? "").replace(/\D/g, "").slice(-10) === fromDigits,
    );
    console.log("[twilio-inbound-sms] lookup", { fromDigits, last4, candidates: leadRows?.length ?? 0, phones: (leadRows ?? []).map((r) => r.phone), err: leadErr?.message });
    if (!lead) {
      console.log("[twilio-inbound-sms] no lead for", from);
      return twiml();
    }

    // Opt-out handling
    const upper = body.toUpperCase();
    if (OPT_OUT_KEYWORDS.has(upper)) {
      await supabase
        .from("leads")
        .update({ sms_opted_out: true, sequence_status: "opted_out" })
        .eq("id", lead.id);
      await supabase.from("sms_conversation_log").insert({
        lead_id: lead.id,
        phone: from,
        direction: "inbound",
        body,
        from_ai: false,
        status: "received",
        metadata: { opt_out: true },
      });
      return twiml();
    }
    if (lead.sms_opted_out) return twiml();

    const nowIso = new Date().toISOString();

    // Mark lead as waiting on response / paused
    await supabase
      .from("leads")
      .update({
        last_response_at: nowIso,
        sequence_status: "paused",
        crm_status: "Waiting on Response",
      })
      .eq("id", lead.id);

    // Build conversation history
    const { data: history } = await supabase
      .from("sms_conversation_log")
      .select("direction, body, created_at")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: true });

    const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
    for (const row of history ?? []) {
      const content = String(row.body ?? "").trim();
      if (!content) continue;
      messages.push({
        role: row.direction === "outbound" ? "assistant" : "user",
        content,
      });
    }
    messages.push({ role: "user", content: body });

    const isExistingMember = lead.lead_type === "existing_member";

    const prospectPrompt = `You are the friendly front desk assistant for FIT Beyond Plus, a full-service gym in Tullahoma, Tennessee. You are texting with a potential member named ${lead.name ?? "there"} who is interested in ${lead.interest ?? lead.goal ?? "getting started"}.

About FIT Beyond Plus:
- Address: 449 W Lincoln St, Tullahoma, TN 37388
- Phone: (931) 222-4449
- Email: info@fitbeyondplus.com
- Offerings: Strength training, cardio, group fitness, kickboxing, Brazilian Jiu-Jitsu (adult and kids), athlete performance training, sauna, connected physical therapy
- Membership options: Single, duo, family, 3-month PIF, 12-month PIF, Silver and Fit
- Free day passes available for first-time visitors

Your job:
- Reply warmly and conversationally like a real person texting — not a bot. Keep replies to 1-3 sentences max.
- Help them take the next step: book a tour, grab a day pass, or get their question answered.
- Never make up specific prices — say someone will follow up with exact pricing.
- Never give medical or injury advice — say we have a physical therapy partner on site they can speak to.

Set needs_human to true and stop responding if:
- They ask to negotiate price or mention a competitor price
- They express frustration or complaint
- They say call me, speak to someone, or manager
- You cannot confidently answer their question
- This is the 5th or more exchange in the conversation
- Their message is emotionally complex or ambiguous

Always respond in this exact JSON format:
{ "reply": "your text reply here", "needs_human": false }
or
{ "reply": null, "needs_human": true, "reason": "brief reason" }`;

    const memberPrompt = `You are the friendly support assistant for FIT Beyond Plus. You are texting with an EXISTING MEMBER named ${lead.name ?? "there"}. Do not try to sell them on joining — they are already a member. Help them with questions about class schedules, hours, freezing or pausing membership, billing questions, guest passes, or general gym info. For anything involving actual account changes, billing disputes, or cancellations, set needs_human to true — staff needs to handle those personally. Keep the same warm, short, conversational tone as the prospect-facing assistant.

About FIT Beyond Plus:
- Address: 449 W Lincoln St, Tullahoma, TN 37388
- Phone: (931) 222-4449
- Email: info@fitbeyondplus.com
- Offerings: Strength training, cardio, group fitness, kickboxing, Brazilian Jiu-Jitsu (adult and kids), athlete performance training, sauna, connected physical therapy

Always respond in this exact JSON format:
{ "reply": "your text reply here", "needs_human": false }
or
{ "reply": null, "needs_human": true, "reason": "brief reason" }`;

    const systemPrompt = isExistingMember ? memberPrompt : prospectPrompt;

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      console.error("[twilio-inbound-sms] ANTHROPIC_API_KEY missing");
      await supabase.from("sms_conversation_log").insert({
        lead_id: lead.id,
        phone: from,
        direction: "inbound",
        body,
        from_ai: false,
        status: "received",
      });
      return twiml();
    }

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        system: systemPrompt,
        messages,
      }),
    });

    let aiReply: string | null = null;
    let needsHuman = true;
    let reason = "ai_error";

    if (!claudeRes.ok) {
      const t = await claudeRes.text();
      console.error("[twilio-inbound-sms] claude error", claudeRes.status, t);
    } else {
      const payload = (await claudeRes.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const text = (payload.content ?? [])
        .map((b) => (b.type === "text" ? b.text ?? "" : ""))
        .join("")
        .trim();
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text) as {
          reply?: string | null;
          needs_human?: boolean;
          reason?: string;
        };
        aiReply = parsed.reply ?? null;
        needsHuman = Boolean(parsed.needs_human);
        reason = parsed.reason ?? "";
      } catch (e) {
        console.error("[twilio-inbound-sms] parse error", e, text);
        needsHuman = true;
        reason = "parse_error";
      }
    }

    // Always log the inbound message
    await supabase.from("sms_conversation_log").insert({
      lead_id: lead.id,
      phone: from,
      direction: "inbound",
      body,
      from_ai: false,
      status: "received",
    });

    if (needsHuman || !aiReply) {
      await supabase
        .from("leads")
        .update({
          crm_status: "Waiting on Response",
          sequence_status: "paused",
        })
        .eq("id", lead.id);

      const staffPhone = Deno.env.get("STAFF_ALERT_PHONE");
      if (staffPhone) {
        const prefix = isExistingMember ? "⚡ [EXISTING MEMBER] " : "⚡ ";
        const alert = `${prefix}${lead.name ?? "A lead"} needs a real response — they said: "${body}". Reason: ${reason || "n/a"}. Check the lead tracker.`;
        await sendTwilioSms(normalizePhone(staffPhone), alert);
      }
      return twiml();
    }

    // Send AI reply to lead
    const sendResult = await sendTwilioSms(from, aiReply);
    if (sendResult.ok) {
      await supabase.from("sms_conversation_log").insert({
        lead_id: lead.id,
        phone: from,
        direction: "outbound",
        body: aiReply,
        from_ai: true,
        provider_message_id: sendResult.sid ?? null,
        status: "sent",
      });
      await supabase
        .from("leads")
        .update({ last_sms_at: new Date().toISOString() })
        .eq("id", lead.id);
    } else {
      console.error("[twilio-inbound-sms] failed to send AI reply", sendResult.error);
    }

    return twiml();
  } catch (err) {
    console.error("[twilio-inbound-sms] exception", err);
    return twiml();
  }
});
