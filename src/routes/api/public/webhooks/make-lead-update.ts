import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CRM_STATUSES = [
  "New Lead",
  "Contacted",
  "Waiting on Response",
  "Tour Scheduled",
  "Tour Completed",
  "Joined",
  "Lost Lead",
] as const;

const SEQUENCE_STATUSES = ["active", "paused", "completed", "opted_out"] as const;

const BodySchema = z
  .object({
    lead_id: z.string().uuid().optional(),
    email: z.string().trim().email().max(254).optional(),
    crm_status: z.enum(CRM_STATUSES).optional(),
    sequence_status: z.enum(SEQUENCE_STATUSES).optional(),
    last_contacted_at: z.string().datetime().optional(),
    last_sms_at: z.string().datetime().optional(),
    sms_opted_out: z.boolean().optional(),
    notes: z.string().max(4000).optional(),
  })
  .refine((v) => v.lead_id || v.email, {
    message: "lead_id or email is required",
  });

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/webhooks/make-lead-update")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.MAKE_WEBHOOK_SECRET;
        if (!secret) return json(500, { ok: false, error: "server_misconfigured" });

        const provided = request.headers.get("x-webhook-secret");
        if (!provided || provided !== secret) {
          return json(401, { ok: false, error: "unauthorized" });
        }

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return json(400, { ok: false, error: "invalid_json" });
        }

        const parsed = BodySchema.safeParse(raw);
        if (!parsed.success) {
          return json(400, {
            ok: false,
            error: "invalid_body",
            details: parsed.error.flatten(),
          });
        }
        const data = parsed.data;

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        // Find the lead
        let query = supabaseAdmin.from("leads").select("id, notes").limit(1);
        if (data.lead_id) {
          query = query.eq("id", data.lead_id);
        } else {
          query = query.ilike("email", data.email!);
        }
        const { data: leadRows, error: findErr } = await query;
        if (findErr) return json(500, { ok: false, error: findErr.message });
        const lead = leadRows?.[0];
        if (!lead) return json(404, { ok: false, error: "lead_not_found" });

        // Build update payload with only present fields
        const update: {
          crm_status?: string;
          sequence_status?: string;
          last_contacted_at?: string;
          last_sms_at?: string;
          sms_opted_out?: boolean;
          notes?: string;
        } = {};
        if (data.crm_status !== undefined) update.crm_status = data.crm_status;
        if (data.sequence_status !== undefined)
          update.sequence_status = data.sequence_status;
        if (data.last_contacted_at !== undefined)
          update.last_contacted_at = data.last_contacted_at;
        if (data.last_sms_at !== undefined) update.last_sms_at = data.last_sms_at;
        if (data.sms_opted_out !== undefined)
          update.sms_opted_out = data.sms_opted_out;

        if (data.notes && data.notes.trim().length > 0) {
          const stamp = new Date().toISOString();
          const entry = `[${stamp}] ${data.notes.trim()}`;
          update.notes = lead.notes ? `${lead.notes}\n${entry}` : entry;
        }

        if (Object.keys(update).length === 0) {
          return json(200, { ok: true, updated: lead.id, changed: false });
        }

        const { error: updErr } = await supabaseAdmin
          .from("leads")
          .update(update)
          .eq("id", lead.id);
        if (updErr) return json(500, { ok: false, error: updErr.message });

        return json(200, { ok: true, updated: lead.id });
      },
    },
  },
});
