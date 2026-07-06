import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function verifyCalendlySignature(
  header: string | null,
  rawBody: string,
  secret: string,
): boolean {
  if (!header) return false;
  const parts = header.split(",").reduce<Record<string, string>>((acc, kv) => {
    const [k, v] = kv.split("=");
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;
  const expected = createHmac("sha256", secret)
    .update(`${t}.${rawBody}`)
    .digest("hex");
  const a = Buffer.from(v1, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function extractPhone(qas: unknown): string | null {
  if (!Array.isArray(qas)) return null;
  for (const qa of qas) {
    if (qa && typeof qa === "object") {
      const q = String((qa as { question?: unknown }).question ?? "").toLowerCase();
      const a = (qa as { answer?: unknown }).answer;
      if (typeof a === "string" && /phone|mobile|cell|number/.test(q)) {
        return a.trim() || null;
      }
    }
  }
  return null;
}

export const Route = createFileRoute("/api/public/webhooks/calendly")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CALENDLY_WEBHOOK_SECRET;
        if (!secret) return json(500, { ok: false, error: "server_misconfigured" });

        const rawBody = await request.text();
        const sig = request.headers.get("calendly-webhook-signature");
        if (!verifyCalendlySignature(sig, rawBody, secret)) {
          return json(401, { ok: false, error: "unauthorized" });
        }

        let payload: {
          event?: string;
          payload?: {
            email?: string;
            name?: string;
            questions_and_answers?: unknown;
            scheduled_event?: { start_time?: string };
          };
        };
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return json(400, { ok: false, error: "invalid_json" });
        }

        const event = payload.event;
        const p = payload.payload ?? {};
        const email = (p.email ?? "").trim().toLowerCase();
        if (!email) return json(200, { ok: true, skipped: "no_email" });

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const { data: leadRows } = await supabaseAdmin
          .from("leads")
          .select("id, notes")
          .ilike("email", email)
          .limit(1);
        const lead = leadRows?.[0];
        const stamp = new Date().toISOString();

        if (event === "invitee.created") {
          const name = (p.name ?? "").trim();
          const phone = extractPhone(p.questions_and_answers);
          const startTime = p.scheduled_event?.start_time ?? null;
          const prettyDate = startTime
            ? new Date(startTime).toLocaleString("en-US", {
                timeZone: "America/Chicago",
              })
            : "unknown time";

          if (lead) {
            const entry = `[${stamp}] Booked via Calendly for ${prettyDate}`;
            const notes = lead.notes ? `${lead.notes}\n${entry}` : entry;
            const { error } = await supabaseAdmin
              .from("leads")
              .update({
                crm_status: "Tour Scheduled",
                tour_scheduled: true,
                tour_date: startTime,
                sequence_status: "paused",
                last_contacted_at: stamp,
                notes,
              })
              .eq("id", lead.id);
            if (error) return json(500, { ok: false, error: error.message });
          } else {
            const { error } = await supabaseAdmin.from("leads").insert({
              source: "calendly",
              name: name || email,
              email,
              phone: phone ?? "",
              crm_status: "Tour Scheduled",
              tour_scheduled: true,
              tour_date: startTime,
              sequence_status: "paused",
              lead_type: "customer_lead",
              should_notify: true,
            });
            if (error) return json(500, { ok: false, error: error.message });
          }
          return json(200, { ok: true });
        }

        if (event === "invitee.canceled") {
          if (lead) {
            const entry = `[${stamp}] Cancelled scheduled visit — returned to follow-up sequence`;
            const notes = lead.notes ? `${lead.notes}\n${entry}` : entry;
            const { error } = await supabaseAdmin
              .from("leads")
              .update({
                tour_scheduled: false,
                tour_date: null,
                crm_status: "Contacted",
                sequence_status: "active",
                notes,
              })
              .eq("id", lead.id);
            if (error) return json(500, { ok: false, error: error.message });
          }
          return json(200, { ok: true });
        }

        return json(200, { ok: true, skipped: "unhandled_event" });
      },
    },
  },
});
