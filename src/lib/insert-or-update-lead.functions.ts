import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AttributionSchema, attributionColumns } from "./attribution";

const Schema = z.object({
  source: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  interest: z.string().nullable(),
  message: z.string().nullable(),
  status: z.string().nullable(),
  payment_status: z.string().nullable(),
  payment_method: z.string().nullable(),
  day_pass_price: z.number().nullable(),
  referral_code: z.string().nullable(),
  referred_by: z.string().nullable(),
  notes: z.string().nullable(),
  lead_type: z.string(),
  lead_score: z.number().nullable(),
  should_notify: z.boolean(),
  spam_reason: z.string().nullable(),
  attribution: AttributionSchema,
});

/**
 * Inserts a new lead, or updates an existing one if a lead already exists
 * matching the same email or phone (last 10 digits) — same dedup pattern
 * already proven in submitAppointmentRequest and processDayPassCheckin.
 *
 * This runs server-side with supabaseAdmin because the dedup lookup
 * requires reading the leads table, which the public browser client
 * cannot do under RLS.
 *
 * Critically: matching an existing lead means an UPDATE, not an INSERT —
 * the "instant welcome text" trigger (trg_notify_new_lead) only fires on
 * INSERT, so this is what actually prevents a repeat form submission from
 * re-triggering a duplicate welcome text to someone already being contacted.
 */
export const insertOrUpdateLead = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Schema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.trim().toLowerCase();
    const phone = (data.phone ?? "").trim();
    const phoneDigits = phone.replace(/\D/g, "").slice(-10);
    const last4 = phoneDigits.slice(-4);

    const orFilters = [`email.ilike.${email}`];
    if (last4.length === 4) orFilters.push(`phone.ilike.%${last4}%`);

    const { data: candidates, error: findErr } = await supabaseAdmin
      .from("leads")
      .select("id, email, phone, notes")
      .or(orFilters.join(","))
      .limit(50);

    if (findErr) {
      console.error("[insertOrUpdateLead] lookup failed", findErr.message);
    }

    const existing = (candidates ?? []).find((r) => {
      if ((r.email ?? "").trim().toLowerCase() === email) return true;
      if (
        phoneDigits.length === 10 &&
        (r.phone ?? "").replace(/\D/g, "").slice(-10) === phoneDigits
      ) {
        return true;
      }
      return false;
    });

    if (existing) {
      const stamp = new Date().toISOString();
      const entry = `[${stamp}] Submitted ${data.source} form again${
        data.message ? `: "${data.message}"` : ""
      }`;
      const notes = existing.notes ? `${existing.notes}\n${entry}` : entry;

      const { error: upErr } = await supabaseAdmin
        .from("leads")
        .update({
          interest: data.interest ?? undefined,
          notes,
        })
        .eq("id", existing.id);

      if (upErr) {
        console.error("[insertOrUpdateLead] update failed", upErr.message);
        return { ok: false as const, error: upErr.message };
      }

      // Existing lead — do NOT treat as a new-lead event. No insert means
      // the DB trigger never fires, and we skip the admin/customer emails
      // too since this isn't actually a new inquiry.
      return { ok: true as const, isNew: false as const, leadId: existing.id };
    }

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("leads")
      .insert({
        source: data.source,
        name: data.name,
        email,
        phone: data.phone,
        interest: data.interest,
        message: data.message,
        status: data.status,
        payment_status: data.payment_status,
        payment_method: data.payment_method,
        day_pass_price: data.day_pass_price,
        referral_code: data.referral_code,
        referred_by: data.referred_by,
        notes: data.notes,
        lead_type: data.lead_type,
        lead_score: data.lead_score ?? undefined,
        should_notify: data.should_notify,
        spam_reason: data.spam_reason,
        // First touch, written on INSERT only — never on the update path
        // above, so the original acquisition can't be overwritten later.
        ...attributionColumns(data.attribution),
      })
      .select("id")
      .single();

    if (insErr || !inserted) {
      console.error("[insertOrUpdateLead] insert failed", insErr?.message);
      return { ok: false as const, error: insErr?.message ?? "insert_failed" };
    }

    return { ok: true as const, isNew: true as const, leadId: inserted.id as string };
  });
