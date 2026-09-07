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

// ---- internal staff alerts (mirrors src/lib/staff-alerts.server.ts) ----
// Operational alerts go individually to every configured staff number;
// developer-only alerts go to DEVELOPER_NOTIFICATION_PHONE. No group thread,
// and one failed recipient never blocks the others.

function parsePhoneList(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const list = raw
    .split(/[,;\s]+/)
    .map((v) => v.trim())
    .filter(Boolean)
    .map(normalizePhone)
    .filter((v) => v.replace(/\D/g, "").length >= 10);
  return Array.from(new Set(list));
}

function staffAlertRecipients(audience: "operations" | "developer"): string[] {
  const legacy = parsePhoneList(Deno.env.get("STAFF_ALERT_PHONE"));
  if (audience === "developer") {
    const dev = parsePhoneList(Deno.env.get("DEVELOPER_NOTIFICATION_PHONE"));
    return dev.length ? dev : legacy;
  }
  const ops = parsePhoneList(Deno.env.get("STAFF_NOTIFICATION_PHONES"));
  return ops.length ? ops : legacy;
}

async function sendStaffAlert(
  message: string,
  audience: "operations" | "developer" = "operations",
): Promise<void> {
  const recipients = staffAlertRecipients(audience);
  if (recipients.length === 0) {
    console.error(
      `[staff-alerts] no recipients configured for audience "${audience}" — alert not sent:`,
      message,
    );
    return;
  }
  await Promise.all(
    recipients.map(async (to) => {
      try {
        const r = await sendTwilioSms(to, message);
        if (!r.ok) {
          console.error(`[staff-alerts] send failed (${audience}) to ${to}:`, r.error);
        }
      } catch (err) {
        console.error(
          `[staff-alerts] send threw (${audience}) to ${to}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }),
  );
}

// ---- inquiry classifier + response playbook (mirrors src/lib/ai-reply-rules.ts) ----

type InquiryType =
  | "pricing"
  | "schedule_classes"
  | "membership_options"
  | "day_pass_tour"
  | "complaint_frustrated"
  | "general_info"
  | "operational";

function classifyInquiry(body: string): InquiryType {
  const lower = body.toLowerCase();

  if (
    /(out of order|not working|isn'?t working|doesn'?t work|broken|broke down|fixed yet|repaired|shut off|turned off|temporarily)/.test(
      lower,
    ) ||
    /(tanning|sauna|shower|locker|bathroom|restroom|towel|machine|treadmill|bike|rower|equipment|weights?|door|wifi|ac\b|air condition|heat(er)?\b|parking)/.test(
      lower,
    ) ||
    /(class(es)? (today|tonight|canceled|cancelled)|is (there|the) .*class|who'?s teaching|instructor (there|today))/.test(
      lower,
    ) ||
    /(are (you|y'?all|we) open|you open (today|now|right now)|closed (today|now)|what time do you (open|close)|open (today|right now))/.test(
      lower,
    ) ||
    /(lost|left) (my|a|an) /i.test(lower) ||
    /found my/i.test(lower) ||
    /(dirty|filthy|messy|smell|gross|nobody was|no one was)/i.test(lower)
  ) {
    return "operational";
  }

  if (
    /\b(price|pricing|cost|how much|rate|membership fee|monthly|annual|pay|payment|discount|deal|offer)\b/i.test(
      lower,
    )
  ) {
    return "pricing";
  }

  if (
    /\b(class|classes|schedule|when.*(class|kickbox|bjj|yoga|barre|hiit)|what time|today|tonight|tomorrow|instructor|teacher|coach.*class)\b/i.test(
      lower,
    )
  ) {
    return "schedule_classes";
  }

  if (
    /\b(membership|join|joining|sign up|contract|commit|silver and fit|family|duo|single|couple|plan)\b/i.test(
      lower,
    )
  ) {
    return "membership_options";
  }

  if (
    /\b(day pass|drop in|drop-in|tour|visit|come in|stop by|check out|try.*(gym|class|day)|free week|free pass)\b/i.test(
      lower,
    )
  ) {
    return "day_pass_tour";
  }

  if (
    /\b(angry|pissed|frustrat|disappoint|terrible|awful|horrible|unhappy|complaint|complain|cancel.*membership|quit|refund|bad experience|worst|ridiculous|unacceptable)\b/i.test(
      lower,
    )
  ) {
    return "complaint_frustrated";
  }

  return "general_info";
}

// ===========================================================================
// APPROVED CONTEXT (mirror of src/lib/gym-facts.ts)
// DO NOT EDIT WITHOUT SYNCING src/lib/gym-facts.ts — the Staff Portal page
// "AI Reply Rules" renders that file, this is what Claude actually receives.
// ===========================================================================
const APPROVED_CONTEXT = `APPROVED GYM INFORMATION (the only facts you may state):
- Name: FIT Beyond Plus
- Address: 449 W Lincoln St, Tullahoma, TN 37388
- Phone: (931) 222-4449
- Email: info@fitbeyondplus.com
- Website: https://fitbeyondplus.com
- Staffed hours:
  • Monday–Friday: 9:00am – 8:00pm (staffed)
  • Saturday: 9:00am – 6:00pm (staffed)
  • Sunday: 10:00am – 5:00pm (staffed)
- Access: Members get 24/7 keycard access, every day of the year.
- Amenities:
  • Locker rooms and showers
  • Sauna
  • Tanning beds (included with every gym membership)
  • Full strength and free-weight floor
  • Cardio equipment
  • Functional / turf training area
  • 13,500 sq ft facility
- Programs:
  • All group fitness classes included with membership (schedule: fitbeyondplus.com/classes)
  • Kickboxing — adults and kids
  • Brazilian Jiu-Jitsu — adults and kids
  • Personal training and athlete performance training
- Perks:
  • Free orientation session with every membership

APPROVED PRICING TABLE (the only prices you may quote):
Monthly memberships:
  • Single: $39/month
  • Duo (2 adults): $59/month
  • Duo +1 (3 adults): $69/month
  • Family (up to 5 in the same household): $82/month
  • Tanning only (no gym membership required): $25/month
Paid-in-full options:
  • Single — 1 week pass: $35
  • Single — 1 month: $55
  • Single — 3 months: $123
  • Single — 6 months: $234
  • Single — 1 year: $449
  • Duo — 1 year: $660
  • Duo +1 — 1 year: $753
  • Family — 1 year: $914
Day pass:
  • Single-day pass: $10
Discounts:
  • Active military and first responders: 15% off. No other discounts exist.

ANNUAL FEE POLICY (explicit — never infer beyond this):
  • Amount: $49.99.
  • Applies to: monthly memberships only (Single, Duo, Duo +1, Family monthly).
  • When charged: billed once a year on July 1st.
  • Exempt: all paid-in-full memberships (1 week, 1 month, 3 months, 6 months, 1 year, duo/family annual) — no annual fee.
  • Exempt: short-term passes and the single-day pass — no annual fee.
  • Exempt: tanning-only plan — no annual fee.
  • Monthly memberships have no contract.
  • Anything else about the annual fee (proration, refunds, waivers, timing exceptions, first-year handling) is NOT defined here — escalate instead of explaining it.

Anything not listed above — other discounts, promotions, payment plans, cancellation terms, contract exceptions, freezes, refunds — is NOT approved information. Never invent it. Say a staff member will confirm, and escalate.`;

const LEAD_ID_PLACEHOLDER = "{{lead_id}}";

// ===========================================================================
// SALES RULEBOOK (mirror of src/lib/ai-reply-rules.ts)
// DO NOT EDIT WITHOUT SYNCING src/lib/ai-reply-rules.ts.
// ===========================================================================
const SALES_RULEBOOK = `You are the SMS sales assistant for FIT Beyond Plus. Your job is to help leads get the information they need quickly, remove unnecessary friction, and move qualified leads toward joining, visiting, or speaking with staff.

GENERAL RULES

1. Answer known factual questions immediately. If the answer is clearly in the approved gym information above, answer it directly instead of escalating — location, hours, locker rooms, showers, 24/7 access, amenities, membership options, approved prices.

2. Quote ONLY prices from the approved pricing table. Never invent pricing, discounts, promotions, payment plans, cancellation terms, or exceptions. If they ask about something not in the approved data, say a staff member will confirm it and escalate.

3. When a lead states buying intent, prioritize helping them buy what they asked for. High intent looks like: "I want to join", "I'm interested in the one-week pass", "Can I come today?", "How do I sign up?", "I want the monthly membership", "Can I start tonight?". Do NOT redirect someone asking to purchase a specific membership or pass into a free-trial or generic tour flow.

4. For high-intent leads: answer their question immediately, ask ONE simple next-step question, and set high_intent: true with a short high_intent_note describing exactly what they want.
   Example — Customer: "I'm in town for a week and want the one-week pass."
   Reply: "Absolutely! Our 1-week pass is $35. What day were you hoping to come in? I can have someone get you set up."
   high_intent_note: "Wants the 1-week pass, in town for a week."

5. Escalating internally must NOT stop you from answering a safe question. If showers are in the approved info, answer: "Yes! We have locker rooms and showers, so you can clean up before heading home." You can still flag staff internally at the same time.

6. Keep texts short, natural, friendly, conversational. Usually 1–3 short sentences. Never sound like a corporate chatbot. Do not over-explain.

7. Ask only one main question at a time. Good: "What day were you hoping to come in?" Bad: "What day, what time, which membership, and have you visited before?"

8. Do not create unnecessary steps. Prefer question → answer → next step. Avoid question → marketing message → scheduling page → staff confirmation → another appointment → purchase.

9. Free day pass / free trial offers are mainly for leads who are unsure, browsing, comparing gyms, or want to see the facility first. Do NOT push the free day pass at someone who already said they want to buy a specific pass or membership.

10. Escalate to staff (set needs_human: true) for: custom discounts, negotiations, billing disputes, unusual payment arrangements, cancellation disputes, contract exceptions, complaints, refunds, competitor negotiations, anything not covered by the approved information, and anything you are uncertain about. When escalating, still give a brief natural response where appropriate — "I can have someone confirm that for you." — instead of stopping abruptly.

11. Competitor and lost-lead handling — read these carefully, they are different situations:
   - OBJECTION ("Planet Fitness is cheaper.") → the lead is STILL ACTIVE. Do not treat as lost. Add "price" to objections. Do not argue, do not criticize the competitor, do not invent a counter-offer. Escalate if it becomes a negotiation.
   - COMPARISON ("I'm comparing you to Planet Fitness.") → STILL ACTIVE. Answer approved questions normally. Not lost.
   - ACTUAL LOSS ("I went with Planet Fitness." / "I already joined Planet Fitness because they were cheaper.") → set likely_lost: true, reply short and polite ("Totally understand — thanks for letting us know!"), and list every reason they gave in lost_reasons.
   - Mixed signals ("Planet Fitness is cheaper, but I still want to come look at your gym.") → NOT lost. Record "price" as an objection and help them visit.
   You never change the lead's status yourself — staff decide that. You only record reasons.

12. Never argue with a customer and never criticize a competitor.

13. Never pressure a lead after they clearly decline.

14. If a message contains a question AND buying intent, answer the question FIRST.
   Example — "I want the week pass. Do y'all have showers?" → "Absolutely — our 1-week pass is $35, and yes, we have locker rooms and showers. What day were you hoping to come in?"

15. Always follow the customer's actual stated goal: week pass → help with the week pass; membership → help with the membership; tour → help schedule the tour; pricing → give approved pricing; facility question → answer it. Do not force every lead through the same script.

PRIMARY OBJECTIVE
Make it as easy as possible for a qualified lead to become a customer while staying inside approved pricing, policies, and gym information. The ideal flow is: customer asks → you answer → you give one clear next step → staff are alerted when needed. Speed, clarity, and low friction are the priorities.

SCHEDULING LINK
When a visit or tour genuinely needs to be booked, use this personalized link: fitbeyondplus.com/schedule-visit?lead=${LEAD_ID_PLACEHOLDER}

HARD LIMITS
- Never give medical or injury advice.
- Never tell someone to "call the front desk" or "stop by the desk" instead of answering — either answer or escalate.
- If your reply promises that staff will follow up, check something, or get back to them, you MUST set needs_human: true.
- If you cannot confidently answer from the approved information, set needs_human: true instead of guessing.
- Operational, right-now questions (broken equipment, is the sauna working, class canceled, lost item, cleanliness, are you open right now) are handled before you are ever called. If one reaches you, set needs_human: true and reply: null.`;

const JSON_CONTRACT = `CRITICAL OUTPUT FORMAT — READ CAREFULLY:
Respond with ONLY a raw JSON object. No other text. No markdown formatting. No code fences (no \`\`\`json, no \`\`\`). No prose before or after. Your entire response must be valid JSON that starts with { and ends with }.

Shape (include every field):
{
  "reply": "your short text reply, or null when escalating with no reply",
  "needs_human": false,
  "reason": "short reason when needs_human is true, otherwise empty string",
  "high_intent": false,
  "high_intent_note": "one short sentence describing exactly what they want to buy or do, otherwise empty string",
  "high_intent_bucket": "one of: week_pass, short_term_pass, monthly_membership, annual_membership, day_pass, tour, browsing, ready_to_join_now, payment_question, classes_programs, none",
  "objections": ["price"],
  "lost_reasons": [],
  "likely_lost": false
}
Allowed values for objections and lost_reasons: competitor, price, availability_response_speed, location, schedule, moved_relocating, health_injury, not_interested, other. Use empty arrays when none apply.`;

function rulebookForLead(leadId: string): string {
  return SALES_RULEBOOK.replaceAll(LEAD_ID_PLACEHOLDER, leadId);
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
      .select("id, name, email, phone, interest, sms_opted_out, notes, lead_type, created_at")
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

    // If this lead has no email on file yet, check if they just texted one
    // (e.g. replying to Claude's "what's your email?" prompt for booking a
    // day pass). Save it so the same conversation turn can pick it up.
    if (!lead.email) {
      const emailMatch = body.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
      if (emailMatch) {
        const capturedEmail = emailMatch[0].toLowerCase();
        const { error: emailUpdateErr } = await supabase
          .from("leads")
          .update({ email: capturedEmail })
          .eq("id", lead.id);
        if (!emailUpdateErr) {
          lead.email = capturedEmail;
        } else {
          console.error("[twilio-inbound-sms] email capture failed", emailUpdateErr.message);
        }
      }
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

    let declinedAltLabel: string | null = null;
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
      // "decline" or "unclear" — fall through to Claude with explicit context
      // so it proactively offers other real open slots instead of replying generically.
      declinedAltLabel = label;
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

    // ---- Hard stop: real-world, right-now gym conditions ----
    // Equipment/amenity status, closures, canceled classes, lost items, facility
    // complaints. The AI has no live visibility into any of it, so it never gets
    // to answer — the question goes straight to staff with no reply sent.
    const OPERATIONAL_PATTERNS =
      /(out of order|not working|isn'?t working|doesn'?t work|broken|broke down|fixed yet|repaired|shut off|turned off|temporarily)|(tanning|sauna|shower|locker|bathroom|restroom|towel|machine|treadmill|bike|rower|equipment|weights?|door|wifi|ac\b|air condition|heat(er)?\b|parking)|(class(es)? (today|tonight|canceled|cancelled)|is (there|the) .*class|who'?s teaching|instructor (there|today))|(are (you|y'?all|we) open|you open (today|now|right now)|closed (today|now)|what time do you (open|close)|open (today|right now))|(lost|left) (my|a|an) |(found my)|(dirty|filthy|messy|smell|gross|nobody was|no one was) /i;

    const inquiryType = classifyInquiry(body);
    const isExistingMember = lead.lead_type === "existing_member";
    const leadLink = `https://fitbeyondplus.com/admin/leads?lead=${lead.id}`;
    const alertPrefix = isExistingMember ? "⚡ [EXISTING MEMBER] " : "⚡ ";

    if (OPERATIONAL_PATTERNS.test(body)) {
      await sendStaffAlert(
        `${alertPrefix}${lead.name ?? "A lead"} (${from}) needs a real person.\nThey said: "${body}"\nInquiry type: ${inquiryType}\nReason: operational_question — no auto-reply was sent.\n${leadLink}`,
        "operations",
      );
      await supabase.from("sms_conversation_log").insert({
        lead_id: lead.id,
        phone: from,
        direction: "system",
        body: `[operational_handoff] no AI reply sent — staff alerted`,
        from_ai: false,
        provider_message_id: null,
        status: "operational_handoff",
        metadata: {
          kind: "operational_handoff",
          reason: "operational_question",
          inquiry_type: inquiryType,
          inbound_body: body,
        },
      });
      return twiml();
    }

    // ---- Staff takeover protection ----
    // Once a staff member texts this lead by hand, the assistant stays out of
    // the way for a few hours: the inbound message is still logged and still
    // counts in reporting (done above), we just don't auto-reply — staff do.
    const TAKEOVER_WINDOW_HOURS = 4;
    const takeoverSince = new Date(
      Date.now() - TAKEOVER_WINDOW_HOURS * 60 * 60 * 1000,
    ).toISOString();
    const { data: staffTexts } = await supabase
      .from("sms_conversation_log")
      .select("id, created_at")
      .eq("lead_id", lead.id)
      .eq("direction", "outbound")
      .eq("from_ai", false)
      .gte("created_at", takeoverSince)
      .order("created_at", { ascending: false })
      .limit(1);

    if ((staffTexts ?? []).length > 0) {
      await sendStaffAlert(
        `${alertPrefix}${lead.name ?? "A lead"} (${from}) replied to your text.\nThey said: "${body}"\nInquiry type: ${inquiryType}\nYou're handling this one, so no auto-reply was sent.\n${leadLink}`,
        "operations",
      );
      await supabase.from("sms_conversation_log").insert({
        lead_id: lead.id,
        phone: from,
        direction: "system",
        body: `[staff_takeover_suppressed] staff texted within ${TAKEOVER_WINDOW_HOURS}h — no AI reply sent`,
        from_ai: false,
        provider_message_id: null,
        status: "staff_takeover_suppressed",
        metadata: {
          kind: "staff_takeover_suppressed",
          reason: "staff_takeover",
          inquiry_type: inquiryType,
          window_hours: TAKEOVER_WINDOW_HOURS,
          inbound_body: body,
        },
      });
      return twiml();
    }




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

    const inquiryType = classifyInquiry(body);
    const isExistingMember = lead.lead_type === "existing_member";

    const playbook = playbookForLead(lead.id);

    const sharedRules = `${playbook}

Global rules for every reply:
- Keep replies to 1-3 short, warm sentences. Text like a real person, not a bot.
- Never make up specific prices, fees, or percentages.
- Never give medical or injury advice.
- Never tell the customer to "call the front desk" or "stop by the desk" as a substitute for answering — either answer helpfully or escalate to staff.
- If your reply promises that staff/our team will follow up, check on something, or get back to them, you MUST set needs_human: true.
- If you cannot confidently answer, set needs_human: true instead of guessing.
- On the 5th or later exchange in this conversation, set needs_human: true.
- If the message is emotionally complex or ambiguous, set needs_human: true.`;

    const prospectPrompt = `You are the friendly front desk assistant for FIT Beyond Plus, a full-service gym in Tullahoma, Tennessee. You are texting with a potential member named ${lead.name ?? "there"} who is interested in ${lead.interest ?? "getting started"}.

About FIT Beyond Plus:
- Address: 449 W Lincoln St, Tullahoma, TN 37388
- Phone: (931) 222-4449
- Email: info@fitbeyondplus.com
- Offerings: Strength training, cardio, group fitness, kickboxing, Brazilian Jiu-Jitsu (adult and kids), athlete performance training, sauna, connected physical therapy
- Membership options: Single, duo, family, 3-month paid-in-full, 12-month paid-in-full, Silver and Fit
- Free day passes / tours available for first-time visitors

The customer's latest message looks like an "${inquiryType}" inquiry.

${sharedRules}

Set needs_human to true and stop responding if:
- They ask to negotiate price or mention a competitor price
- They express frustration or complaint
- They say call me, speak to someone, or manager
- You cannot confidently answer their question
- This is the 5th or more exchange in the conversation
- Their message is emotionally complex or ambiguous${declinedAltLabel ? `\n\nIMPORTANT CONTEXT — RECENT ALTERNATIVE TIME OFFER:\nOur staff previously suggested "${declinedAltLabel}" as an alternative visit time. The customer's latest reply was NOT a clear yes to that time (they either declined it or were ambiguous). Do NOT ignore this. In your reply, briefly acknowledge that "${declinedAltLabel}" doesn't work, and let them know you'll have staff reach out with another time, or point them to fitbeyondplus.com/schedule-visit?lead=${lead.id} to pick something themselves. Do not respond generically or as if the alternative offer never happened.` : ""}

CRITICAL OUTPUT FORMAT — READ CAREFULLY:
Respond with ONLY a raw JSON object. No other text. No markdown formatting. No code fences (no \`\`\`json, no \`\`\`). No prose before or after. Your entire response must be valid JSON that starts with { and ends with }.

Use exactly this shape:
{ "reply": "your text reply here", "needs_human": false }
or when escalating:
{ "reply": null, "needs_human": true, "reason": "brief reason" }`;

    const memberPrompt = `You are the friendly support assistant for FIT Beyond Plus. You are texting with an EXISTING MEMBER named ${lead.name ?? "there"}. Do not try to sell them on joining — they are already a member. Help them with questions about class schedules, hours, freezing or pausing membership, billing questions, guest passes, or general gym info.

About FIT Beyond Plus:
- Address: 449 W Lincoln St, Tullahoma, TN 37388
- Phone: (931) 222-4449
- Email: info@fitbeyondplus.com
- Offerings: Strength training, cardio, group fitness, kickboxing, Brazilian Jiu-Jitsu (adult and kids), athlete performance training, sauna, connected physical therapy

The member's latest message looks like an "${inquiryType}" inquiry.

${sharedRules}

Set needs_human to true and stop responding if:
- You cannot confidently answer their question, or you would have to say you don't know / don't have real-time information
- They ask about anything happening at the gym right now: equipment or amenity status, something broken or out of order, whether we're open, a class being canceled, a lost item, or a cleanliness/facility issue
- They ask to negotiate price or mention a competitor price
- They express frustration or complaint
- They say call me, speak to someone, or manager
- This is the 5th or more exchange in the conversation
- Their message is emotionally complex or ambiguous
- Anything involving account changes, billing disputes, cancellations, or membership changes

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

    // Call Claude with one retry + short backoff on non-2xx / network failure.
    // Every failed attempt is logged durably to sms_conversation_log so this is
    // diagnosable from the database even after Edge Function logs roll over.
    const callClaude = () =>
      fetch("https://api.anthropic.com/v1/messages", {
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

    const logClaudeApiError = async (
      attempt: number,
      status: number | null,
      responseBody: string,
    ) => {
      const preview = responseBody.slice(0, 500).replace(/\s+/g, " ");
      console.error("[twilio-inbound-sms] claude api error", attempt, status, preview);
      const { error: logErr } = await supabase.from("sms_conversation_log").insert({
        lead_id: lead.id,
        phone: from,
        direction: "system",
        body: `[claude_api_error] attempt ${attempt} status ${status ?? "network"}`,
        from_ai: false,
        provider_message_id: null,
        status: "claude_api_error",
        metadata: {
          kind: "claude_api_error",
          attempt,
          http_status: status,
          response_preview: preview,
          inbound_body: body,
        },
      });
      if (logErr) {
        console.error("[twilio-inbound-sms] failed to log claude_api_error:", logErr.message);
      }
    };

    let claudeRes: Response | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await callClaude();
        if (res.ok) {
          claudeRes = res;
          break;
        }
        const t = await res.text();
        await logClaudeApiError(attempt, res.status, t);
      } catch (e) {
        await logClaudeApiError(attempt, null, (e as Error).message);
      }
      if (attempt === 1) await new Promise((r) => setTimeout(r, 1500));
    }

    let aiReply: string | null = null;
    let needsHuman = true;
    let reason = "ai_error";

    if (!claudeRes) {
      // both attempts failed; falls through to needs_human staff alert
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
        };
        aiReply = parsed.reply ?? null;
        needsHuman = Boolean(parsed.needs_human);
        reason = parsed.reason ?? "";
      } catch (e) {
        const preview = text.slice(0, 300).replace(/\s+/g, " ");
        const errMsg = (e as Error).message;
        console.error(
          "[twilio-inbound-sms] parse error — falling back to staff alert:",
          errMsg,
          "| raw response (truncated):",
          preview,
        );
        needsHuman = true;
        reason = "parse_error";

        // Durable, queryable record of the failure — Edge Function log
        // retention rolls over, this doesn't. Query with:
        // .eq("metadata->>kind", "parse_error")
        const { error: parseLogErr } = await supabase.from("sms_conversation_log").insert({
          lead_id: lead.id,
          phone: from,
          direction: "system",
          body: `[parse_error] ${errMsg}`,
          from_ai: false,
          provider_message_id: null,
          status: "parse_error",
          metadata: {
            kind: "parse_error",
            error_message: errMsg,
            raw_response_preview: preview,
            inbound_body: body,
          },
        });
        if (parseLogErr) {
          console.error(
            "[twilio-inbound-sms] failed to log parse_error to sms_conversation_log:",
            parseLogErr.message,
          );
        }
      }
    }

    // Safety net: the AI sometimes writes "let me check with staff / someone will
    // follow up" while leaving needs_human false. That's a silent handoff with
    // nobody notified, so detect the promise in the reply text itself.
    const HANDOFF_PATTERNS =
      /(let me (have|check|ask|find out|confirm|look into|look up|verify|get back to you on)|someone (from our team |from the team )?(will|can) (follow up|reach out|get back|check|contact you|call you|message you)|(our|the) team (will|can) (follow up|reach out|get back|check|contact you|call you|message you)|staff (will|can) (follow up|reach out|get back|check|contact you|call you|message you)|(i'?ll|we'?ll) (have (someone|staff)|follow up|get back to you|double.?check|check on|look into|look up|verify|find out|confirm|pass this along)|have someone (from )?(our team |the team )?(follow up|reach out|get back|contact you|call you)|we can check|i can check|someone will contact you|i will pass this along|we will pass this along)/i;
    const promisedHandoff = Boolean(aiReply && HANDOFF_PATTERNS.test(aiReply));

    // Second safety net: suppress non-answers that send the customer back to
    // the gym without actually helping, or that admit the AI doesn't know.
    const NON_ANSWER_PATTERNS =
      /(i don't have (real-time|live|current|up-to-date) (info|information|data|status)|i don't know|i'm not sure|i cannot confirm|i can't confirm|call the (front desk|gym|desk)|stop by the (front desk|gym|desk)|check with the (front desk|gym|staff)|i have no way to know|i'm unable to verify|i don't have access)/i;
    const nonAnswer = Boolean(aiReply && NON_ANSWER_PATTERNS.test(aiReply));

    if (needsHuman || promisedHandoff || nonAnswer || !aiReply) {
      await supabase
        .from("leads")
        .update({
          crm_status: "Waiting on Response",
          sequence_status: "paused",
        })
        .eq("id", lead.id);

      const prefix = isExistingMember ? "⚡ [EXISTING MEMBER] " : "⚡ ";
      let alertReason = reason || "n/a";
      if (promisedHandoff) alertReason = "assistant promised staff follow-up";
      if (nonAnswer) alertReason = "assistant gave a non-answer";
      const alert = `${prefix}${lead.name ?? "A lead"} needs a real response — they said: "${body}". Reason: ${alertReason}. Check the lead tracker.`;
      await sendStaffAlert(alert, "operations");

      // Escalation means silence: any draft the AI wrote is NOT texted out.
      // Staff answer from the lead tracker so the person never gets a
      // non-answer like "I don't have real-time info, call the front desk".
      if (aiReply) {
        await supabase.from("sms_conversation_log").insert({
          lead_id: lead.id,
          phone: from,
          direction: "system",
          body: `[suppressed_ai_reply] ${aiReply}`,
          from_ai: false,
          provider_message_id: null,
          status: "suppressed",
          metadata: {
            kind: "suppressed_ai_reply",
            reason: alertReason,
            inquiry_type: inquiryType,
            inbound_body: body,
          },
        });
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
        metadata: { inquiry_type: inquiryType },
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
