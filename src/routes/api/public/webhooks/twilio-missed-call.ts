// Twilio Voice webhook: missed-call text-back.
// The office phone forwards to our Twilio number after N unanswered rings.
// Twilio POSTs this route (form-encoded), we answer with TwiML and text the caller.
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

const TEXT_BACK_BODY =
  "Hey! This is FIT Beyond Plus — sorry we missed your call! What can we help you with? Reply here and we'll get back to you shortly.";

const VOICE_PROMPT =
  "Thanks for calling FIT Beyond Plus. We're sorry we missed you. We're sending you a text message right now, so just reply there and our team will get back to you shortly. Talk soon!";

function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return "+" + trimmed.slice(1).replace(/\D/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function twiml(xml: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${xml}`, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

function okTwiml() {
  return twiml(
    `<Response><Say voice="Polly.Joanna">${VOICE_PROMPT}</Say><Hangup/></Response>`,
  );
}

// Twilio signs the full request URL + sorted POST params with the auth token.
function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string | null,
  authToken: string,
): boolean {
  if (!signature) return false;
  let data = url;
  for (const key of Object.keys(params).sort()) data += key + params[key];
  const expected = createHmac("sha1", authToken).update(data, "utf8").digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function sendTwilioSms(
  to: string,
  body: string,
): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
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

export const Route = createFileRoute("/api/public/webhooks/twilio-missed-call")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authToken = process.env.TWILIO_AUTH_TOKEN;
          if (!authToken) {
            console.error("[twilio-missed-call] TWILIO_AUTH_TOKEN missing");
            return okTwiml();
          }

          const raw = await request.text();
          const form = new URLSearchParams(raw);
          const params: Record<string, string> = {};
          for (const [k, v] of form.entries()) params[k] = v;

          // Twilio signs the URL it was configured with (always https).
          const url = new URL(request.url);
          url.protocol = "https:";
          url.port = "";
          const signed = verifyTwilioSignature(
            url.toString(),
            params,
            request.headers.get("x-twilio-signature"),
            authToken,
          );
          if (!signed) {
            console.error("[twilio-missed-call] invalid signature", url.toString());
            return new Response("Invalid signature", { status: 403 });
          }

          const fromRaw = params["From"] ?? "";
          if (!fromRaw) {
            console.error("[twilio-missed-call] missing From");
            return okTwiml();
          }
          const caller = normalizePhone(fromRaw);
          const digits = caller.replace(/\D/g, "").slice(-10);
          const nowIso = new Date().toISOString();

          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );

          // Find an existing lead by last-10-digit phone match.
          let leadId: string | null = null;
          if (digits.length === 10) {
            const { data: candidates, error: findErr } = await supabaseAdmin
              .from("leads")
              .select("id, phone, notes")
              .ilike("phone", `%${digits.slice(-4)}%`)
              .limit(50);
            if (findErr) {
              console.error("[twilio-missed-call] lookup failed", findErr.message);
            }
            const existing = (candidates ?? []).find(
              (r) => (r.phone ?? "").replace(/\D/g, "").slice(-10) === digits,
            );
            if (existing) {
              leadId = existing.id as string;
              const entry = `[${nowIso}] Called the gym and didn't reach anyone — automatic missed-call text sent.`;
              const notes = existing.notes ? `${existing.notes}\n${entry}` : entry;
              const { error: upErr } = await supabaseAdmin
                .from("leads")
                .update({ notes, last_contact_method: "sms" })
                .eq("id", existing.id);
              if (upErr) {
                console.error("[twilio-missed-call] update failed", upErr.message);
              }
            }
          }

          if (!leadId) {
            const { data: inserted, error: insErr } = await supabaseAdmin
              .from("leads")
              .insert({
                source: "missed_call",
                name: "Missed call",
                email: `missed-call-${digits || Date.now()}@placeholder.fitbeyondplus.com`,
                phone: caller,
                interest: "Missed phone call",
                message: `Called the gym at ${nowIso} and didn't reach anyone.`,
                lead_type: "customer_lead",
                should_notify: true,
                crm_status: "New Lead",
                last_contact_method: "sms",
                notes: `[${nowIso}] Missed inbound call — automatic text-back sent.`,
              })
              .select("id")
              .single();
            if (insErr || !inserted) {
              console.error("[twilio-missed-call] insert failed", insErr?.message);
            } else {
              leadId = inserted.id as string;
            }
          }

          const send = await sendTwilioSms(caller, TEXT_BACK_BODY);
          if (!send.ok) {
            console.error("[twilio-missed-call] twilio error", send.error);
          } else if (leadId) {
            await supabaseAdmin
              .from("leads")
              .update({ last_sms_at: nowIso, sequence_status: "active" })
              .eq("id", leadId);
          }

          await supabaseAdmin.from("sms_conversation_log").insert({
            lead_id: leadId,
            phone: caller,
            direction: "outbound",
            body: send.ok
              ? TEXT_BACK_BODY
              : `NOT SENT (${send.error}) | ${TEXT_BACK_BODY}`,
            from_ai: false,
            provider_message_id: send.sid ?? null,
            status: send.ok ? "sent" : "failed",
            metadata: { kind: "missed_call", call_sid: params["CallSid"] ?? null },
          });

          return okTwiml();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[twilio-missed-call] fatal", msg);
          // Always give Twilio valid TwiML so the caller never hears an error.
          return okTwiml();
        }
      },
    },
  },
});
