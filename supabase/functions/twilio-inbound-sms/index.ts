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
    console.error("[twilio] send error", res.status, t);
    return { ok: false, error: `twilio_${res.status}` };
  }
  const json = (await res.json()) as { sid?: string };
  return { ok: true, sid: json.sid };
}

// ---- appointment availability (inline, mirrors src/lib/appointment-availability.ts) ----

const APPOINTMENT_HOURS: Record<number, { start: number; end: number } | null> = {
  0: { start: 10, end: 17 }, // Sunday
  1: { start: 9, end: 20 },  // Monday
  2: { start: 9, end: 20 },
  3: { start: 9, end: 20 },
  4: { start: 9, end: 20 },
  5: { start: 9, end: 20 },
  6: { start: 9, end: 18 },  // Saturday
};

function chicagoParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    weekday: get("weekday"),
  };
}

const WEEKDAY_TO_NUM: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// Convert Chicago wall time (y-m-d h:00) → UTC ISO string.
function chicagoWallToUTC(y: number, m: number, d: number, hh: number): string {
  // Approximate: build a UTC date matching wall time, then correct offset by
  // measuring the difference between the same instant's Chicago wall clock.
  const guess = new Date(Date.UTC(y, m - 1, d, hh, 0, 0));
  const p = chicagoParts(guess);
  const guessedWallMs = Date.UTC(p.year, p.month - 1, p.day, p.hour, 0, 0);
  const targetWallMs = Date.UTC(y, m - 1, d, hh, 0, 0);
  const delta = targetWallMs - guessedWallMs;
  return new Date(guess.getTime() + delta).toISOString();
}

function chicagoDateISOForOffset(offsetDays: number): { iso: string; y: number; m: number; d: number; wd: number } {
  const now = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  const p = chicagoParts(now);
  return { iso: `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`, y: p.year, m: p.month, d: p.day, wd: WEEKDAY_TO_NUM[p.weekday] ?? 0 };
}

async function getAvailableSlotsForNextDays(
  supabase: ReturnType<typeof createClient>,
  days: number,
): Promise<Array<{ iso: string; label: string }>> {
  const results: Array<{ iso: string; label: string }> = [];
  const nowMs = Date.now();

  // Load all confirmed appts within the window in one query.
  const horizonIso = new Date(nowMs + days * 24 * 60 * 60 * 1000).toISOString();
  const { data: taken } = await supabase
    .from("appointments")
    .select("confirmed_time")
    .eq("status", "confirmed")
    .gte("confirmed_time", new Date(nowMs).toISOString())
    .lte("confirmed_time", horizonIso);
  const takenSet = new Set((taken ?? []).map((r) => r.confirmed_time as string));

  for (let offset = 0; offset < days; offset++) {
    const { y, m, d, wd } = chicagoDateISOForOffset(offset);
    const hours = APPOINTMENT_HOURS[wd];
    if (!hours) continue;
    for (let hh = hours.start; hh < hours.end; hh++) {
      const iso = chicagoWallToUTC(y, m, d, hh);
      if (new Date(iso).getTime() < nowMs + 60 * 60 * 1000) continue; // need 1hr lead time
      if (takenSet.has(iso)) continue;
      const label = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(iso));
      results.push({ iso, label });
    }
  }
  return results;
}

// Classify whether the user's reply affirms a suggested alternative appointment
// time. Uses Claude with a strict yes/no/other rubric (no keyword hardcoding).
async function classifyAlternativeResponse(
  anthropicKey: string,
  suggestedLabel: string,
  userMessage: string,
): Promise<"accept" | "decline" | "unclear"> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 20,
        system: `You classify a customer's SMS reply about a proposed appointment time. The proposed time was: "${suggestedLabel}". Read the reply. Output EXACTLY one word: ACCEPT, DECLINE, or UNCLEAR. No other text, no punctuation.`,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
    if (!res.ok) return "unclear";
    const j = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const txt = (j.content ?? []).map((b) => b.text ?? "").join("").trim().toUpperCase();
    if (txt.startsWith("ACCEPT")) return "accept";
    if (txt.startsWith("DECLINE")) return "decline";
    return "unclear";
  } catch (e) {
    console.error("[twilio-inbound-sms] classifier exception", (e as Error).message);
    return "unclear";
  }
}

function formatChicagoDateTimeLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
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

    // Find lead by last-10-digits of phone (format-agnostic).
    const fromDigits = fromRaw.replace(/\D/g, "").slice(-10);
    const last4 = fromDigits.slice(-4);
    const { data: leadRows, error: leadErr } = await supabase
      .from("leads")
      .select("id, name, phone, interest, sms_opted_out, notes, lead_type, created_at")
      .ilike("phone", `%${last4}%`)
      .order("created_at", { ascending: false })
      .limit(50);
    if (leadErr) console.error("[twilio-inbound-sms] select error", leadErr.message);
    const lead = (leadRows ?? []).find(
      (r) => (r.phone ?? "").replace(/\D/g, "").slice(-10) === fromDigits,
    );
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
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    // Always log the inbound message up front.
    await supabase.from("sms_conversation_log").insert({
      lead_id: lead.id,
      phone: from,
      direction: "inbound",
      body,
      from_ai: false,
      status: "received",
    });

    // ---- Step 1: is there a pending "alternative_suggested" appointment awaiting a yes/no? ----
    const { data: altAppt } = await supabase
      .from("appointments")
      .select("id, suggested_time")
      .eq("lead_id", lead.id)
      .eq("status", "alternative_suggested")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (altAppt?.suggested_time && anthropicKey) {
      const label = formatChicagoDateTimeLabel(altAppt.suggested_time);
      const verdict = await classifyAlternativeResponse(anthropicKey, label, body);
      if (verdict === "accept") {
        await supabase
          .from("appointments")
          .update({
            status: "confirmed",
            confirmed_time: altAppt.suggested_time,
            confirmed_at: nowIso,
          })
          .eq("id", altAppt.id);
        const confirmMsg = `Great — you're confirmed for ${label}. See you then at FIT Beyond Plus, 449 W Lincoln St, Tullahoma!`;
        const send = await sendTwilioSms(from, confirmMsg);
        if (send.ok) {
          await supabase.from("sms_conversation_log").insert({
            lead_id: lead.id,
            phone: from,
            direction: "outbound",
            body: confirmMsg,
            from_ai: true,
            provider_message_id: send.sid ?? null,
            status: "sent",
            metadata: { kind: "appt_alt_confirmed", appointment_id: altAppt.id },
          });
        }
        await supabase
          .from("leads")
          .update({
            tour_scheduled: true,
            tour_date: altAppt.suggested_time,
            crm_status: "Tour Scheduled",
            sequence_status: "paused",
            last_sms_at: nowIso,
            last_response_at: nowIso,
          })
          .eq("id", lead.id);
        return twiml();
      }
      // "decline" or "unclear" — fall through to normal Claude flow; the model will
      // see the conversation history including the alternative offer.
    }

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
    // The current inbound is already logged; don't re-append.

    const isExistingMember = lead.lead_type === "existing_member";

    // For prospects, offer real open slots so Claude can propose concrete times.
    let slotsBlock = "";
    if (!isExistingMember) {
      const slots = await getAvailableSlotsForNextDays(supabase, 3);
      const trimmed = slots.slice(0, 8);
      if (trimmed.length > 0) {
        slotsBlock = `\n\nOPEN VISIT SLOTS (next 3 days, Central time). If the customer wants to schedule a visit/tour, offer 2 or 3 of these specific times in your reply and ask which works best:\n${trimmed.map((s) => `- ${s.label}  [iso: ${s.iso}]`).join("\n")}\n\nIf the customer clearly picks ONE of these exact slots, include the "book_slot" field with that iso value in your JSON.`;
      }
    }

    const prospectPrompt = `You are the friendly front desk assistant for FIT Beyond Plus, a full-service gym in Tullahoma, Tennessee. You are texting with a potential member named ${lead.name ?? "there"} who is interested in ${lead.interest ?? "getting started"}.

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
- Their message is emotionally complex or ambiguous${slotsBlock}

CRITICAL OUTPUT FORMAT — READ CAREFULLY:
Respond with ONLY a raw JSON object. No other text. No markdown formatting. No code fences (no \`\`\`json, no \`\`\`). No prose before or after. Your entire response must be valid JSON that starts with { and ends with }.

Use exactly this shape:
{ "reply": "your text reply here", "needs_human": false }
or with a booked slot:
{ "reply": "your text reply here", "needs_human": false, "book_slot": "2025-11-14T20:00:00.000Z" }
or when escalating:
{ "reply": null, "needs_human": true, "reason": "brief reason" }`;

    const memberPrompt = `You are the friendly support assistant for FIT Beyond Plus. You are texting with an EXISTING MEMBER named ${lead.name ?? "there"}. Do not try to sell them on joining — they are already a member. Help them with questions about class schedules, hours, freezing or pausing membership, billing questions, guest passes, or general gym info. For anything involving actual account changes, billing disputes, or cancellations, set needs_human to true — staff needs to handle those personally. Keep the same warm, short, conversational tone as the prospect-facing assistant.

About FIT Beyond Plus:
- Address: 449 W Lincoln St, Tullahoma, TN 37388
- Phone: (931) 222-4449
- Email: info@fitbeyondplus.com
- Offerings: Strength training, cardio, group fitness, kickboxing, Brazilian Jiu-Jitsu (adult and kids), athlete performance training, sauna, connected physical therapy

CRITICAL OUTPUT FORMAT — READ CAREFULLY:
Respond with ONLY a raw JSON object. No other text. No markdown formatting. No code fences (no \`\`\`json, no \`\`\`). No prose before or after. Your entire response must be valid JSON that starts with { and ends with }.

Use exactly this shape:
{ "reply": "your text reply here", "needs_human": false }
or
{ "reply": null, "needs_human": true, "reason": "brief reason" }`;

    const systemPrompt = isExistingMember ? memberPrompt : prospectPrompt;

    if (!anthropicKey) {
      console.error("[twilio-inbound-sms] ANTHROPIC_API_KEY missing");
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
        max_tokens: 350,
        system: systemPrompt,
        messages,
      }),
    });

    let aiReply: string | null = null;
    let needsHuman = true;
    let reason = "ai_error";
    let bookSlot: string | null = null;

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
      let cleaned = text;
      const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenced) cleaned = fenced[1].trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      const candidate = jsonMatch ? jsonMatch[0] : cleaned;

      try {
        const parsed = JSON.parse(candidate) as {
          reply?: string | null;
          needs_human?: boolean;
          reason?: string;
          book_slot?: string | null;
        };
        aiReply = parsed.reply ?? null;
        needsHuman = Boolean(parsed.needs_human);
        reason = parsed.reason ?? "";
        bookSlot = parsed.book_slot ?? null;
      } catch (e) {
        const preview = text.slice(0, 300).replace(/\s+/g, " ");
        console.error(
          "[twilio-inbound-sms] parse error — falling back to staff alert:",
          (e as Error).message,
          "| raw response (truncated):",
          preview,
        );
        needsHuman = true;
        reason = "parse_error";
      }
    }

    // If Claude picked a valid slot, create a pending appointment.
    if (bookSlot && !isExistingMember) {
      // Confirm the slot is still open (not already confirmed by someone else).
      const { data: conflict } = await supabase
        .from("appointments")
        .select("id")
        .eq("status", "confirmed")
        .eq("confirmed_time", bookSlot)
        .maybeSingle();
      if (!conflict) {
        await supabase.from("appointments").insert({
          lead_id: lead.id,
          name: lead.name ?? "Lead",
          phone: from,
          email: null,
          requested_time: bookSlot,
          status: "pending",
          type: "tour",
        });
      } else {
        // Slot got taken between prompt build and reply — escalate to staff.
        needsHuman = true;
        reason = "slot_conflict";
        aiReply = null;
      }
    }

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
        metadata: bookSlot ? { kind: "appt_booked_via_ai", requested_time: bookSlot } : null,
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
