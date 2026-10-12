// Twilio Voice webhook for "Call from FIT". Signature-verified.
// step=connect → TwiML bridging staff to the contact; step=status → call status updates.
import { createFileRoute } from "@tanstack/react-router";

const xml = (body: string) => new Response(body, { status: 200, headers: { "Content-Type": "text/xml; charset=utf-8" } });
const hangup = () => xml(`<?xml version="1.0" encoding="UTF-8"?>\n<Response><Say voice="Polly.Joanna">This call could not be connected.</Say><Hangup/></Response>`);

export const Route = createFileRoute("/api/public/webhooks/crm-call")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.TWILIO_AUTH_TOKEN;
        if (!token) return new Response("not configured", { status: 500 });
        const m = await import("@/lib/crm/calls.server");
        const url = new URL(request.url);
        const signedUrl = `${m.CALL_PUBLIC_BASE}${m.CALL_WEBHOOK_PATH}${url.search}`;
        const params: Record<string, string> = {};
        for (const [k, v] of new URLSearchParams(await request.text())) params[k] = v;
        const sig = request.headers.get("x-twilio-signature");
        if (!m.verifyTwilioSignature(signedUrl, params, sig, token) && !m.verifyTwilioSignature(request.url, params, sig, token))
          return new Response("Invalid signature", { status: 403 });
        const logId = url.searchParams.get("log") ?? "";
        if (!/^[0-9a-f-]{36}$/i.test(logId)) return new Response("bad request", { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (url.searchParams.get("step") === "connect") {
          const { data: log } = await supabaseAdmin.from("crm_call_log").select("contact_id, twilio_call_sid, status").eq("id", logId).maybeSingle();
          if (!log || (log.twilio_call_sid && params.CallSid && log.twilio_call_sid !== params.CallSid)) return hangup();
          const { data: c } = await supabaseAdmin.from("leads").select("phone").eq("id", log.contact_id).maybeSingle();
          const to = m.toE164US(c?.phone);
          const from = m.toE164US(process.env.TWILIO_FROM_NUMBER);
          if (!to || !from) return hangup();
          return xml(m.connectTwiml(to, from, `${m.CALL_PUBLIC_BASE}${m.CALL_WEBHOOK_PATH}?step=status&leg=contact&log=${logId}`));
        }
        const leg = url.searchParams.get("leg") === "contact" ? "contact" : "staff";
        await m.applyStatusCallback(supabaseAdmin, logId, leg, params);
        return new Response("ok");
      },
    },
  },
});
