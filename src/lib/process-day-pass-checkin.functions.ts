import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Schema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(1).max(40),
  payment_method: z.enum(["venmo", "paid_at_desk"]),
});

export const processDayPassCheckin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Schema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const now = new Date().toISOString();
    const email = data.email.trim().toLowerCase();
    const phone = data.phone.trim();
    const payment_status = data.payment_method; // "venmo" | "paid_at_desk"

    // 1) Antaris check first
    let existingMember = false;
    try {
      const { checkMemberMatch } = await import("./antaris/client");
      const match = await checkMemberMatch(data.name, data.email, phone);
      if (match.isMember && match.confidence >= 80) {
        existingMember = true;
      }
    } catch (e) {
      console.error("[dayPassCheckin] antaris check failed", e);
    }

    // Find existing lead by email or phone (case-insensitive)
    const orFilters = [`email.ilike.${email}`];
    if (phone) orFilters.push(`phone.eq.${phone}`);
    const { data: existing, error: findErr } = await supabaseAdmin
      .from("leads")
      .select("id, notes")
      .or(orFilters.join(","))
      .limit(1);
    if (findErr) {
      console.error("[dayPassCheckin] find error", findErr.message);
    }
    const existingLead = existing?.[0];

    if (existingMember) {
      const noteEntry = `[${now}] Existing Antaris member checked in for day pass (paid via ${payment_status})`;
      if (existingLead) {
        const notes = existingLead.notes
          ? `${existingLead.notes}\n${noteEntry}`
          : noteEntry;
        await supabaseAdmin
          .from("leads")
          .update({ notes })
          .eq("id", existingLead.id);
      }
      return {
        ok: true as const,
        existing_member: true as const,
        lead_id: existingLead?.id ?? null,
      };
    }

    const noteEntry = `[${now}] Day pass walk-in — paid via ${payment_status}`;

    if (existingLead) {
      const notes = existingLead.notes
        ? `${existingLead.notes}\n${noteEntry}`
        : noteEntry;
      const { error: upErr } = await supabaseAdmin
        .from("leads")
        .update({
          source: "day_pass_walkin",
          lead_type: "customer_lead",
          crm_status: "Tour Completed",
          tour_completed: true,
          tour_date: now,
          should_notify: true,
          sequence_status: "active",
          lead_score: 90,
          payment_status,
          payment_method: data.payment_method,
          day_pass_price: 10,
          notes,
        })
        .eq("id", existingLead.id);
      if (upErr) {
        console.error("[dayPassCheckin] update error", upErr.message);
        return { ok: false as const, error: upErr.message };
      }
      return {
        ok: true as const,
        existing_member: false as const,
        lead_id: existingLead.id,
        updated: true as const,
      };
    }

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("leads")
      .insert({
        source: "day_pass_walkin",
        name: data.name.trim(),
        email,
        phone,
        interest: "Day Pass ($10)",
        message: `Day pass walk-in — paid via ${payment_status}. $10 collected at front desk.`,
        lead_type: "customer_lead",
        crm_status: "Tour Completed",
        tour_completed: true,
        tour_date: now,
        should_notify: true,
        sequence_status: "active",
        lead_score: 90,
        payment_status,
        payment_method: data.payment_method,
        day_pass_price: 10,
        status: "checked_in",
        notes: noteEntry,
      })
      .select("id")
      .single();

    if (insErr || !inserted) {
      console.error("[dayPassCheckin] insert error", insErr?.message);
      return { ok: false as const, error: insErr?.message ?? "insert_failed" };
    }

    return {
      ok: true as const,
      existing_member: false as const,
      lead_id: inserted.id as string,
      created: true as const,
    };
  });
