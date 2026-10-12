// Optional inbound Voice handler for the FIT number (NOT active until set in Twilio).
// Rings LEAD_ALERT_PHONE first; if unanswered, hands off to the existing
// missed-call text-back flow unchanged. No recording, no voicemail.
import { createFileRoute } from "@tanstack/react-router";

const BASE = "https://fitbeyondplus.com/api/public/webhooks";
const xml = (b: string) => new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${b}`, { headers: { "Content-Type": "text/xml; charset=utf-8" } });

export const Route = createFileRoute("/api/public/webhooks/inbound-call-forward")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.TWILIO_AUTH_TOKEN;
        if (!token) return new Response("not configured", { status: 500 });
        const { verifyTwilioSignature, toE164US } = await import("@/lib/crm/calls.server");
        const url = new URL(request.url);
        const params: Record<string, string> = {};
        for (const [k, v] of new URLSearchParams(await request.text())) params[k] = v;
        const sig = request.headers.get("x-twilio-signature");
        if (!verifyTwilioSignature(`${BASE}/inbound-call-forward${url.search}`, params, sig, token)) return new Response("Invalid signature", { status: 403 });
        const missed = `<Response><Redirect method="POST">${BASE}/twilio-missed-call</Redirect></Response>`;
        if (url.searchParams.get("after") === "1") {
          return xml(params.DialCallStatus === "completed" ? "<Response><Hangup/></Response>" : missed);
        }
        const staff = toE164US(process.env.LEAD_ALERT_PHONE);
        if (!staff) return xml(missed);
        return xml(`<Response><Dial timeout="20" record="do-not-record" action="${BASE}/inbound-call-forward?after=1" method="POST"><Number>${staff}</Number></Dial></Response>`);
      },
    },
  },
});
