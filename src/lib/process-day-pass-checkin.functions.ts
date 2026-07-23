import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Schema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(1).max(40),
  payment_method: z.enum(["venmo", "paid_at_desk"]),
});

// Same signal patterns already proven in lead-classifier.ts, reused here
// since the day pass form doesn't have a free-text message field to run
// the full classifier against.
function looksFake(name: string, email: string): boolean {
  if (/\d{3,}/.test(name) || /(.)\1{4,}/.test(name)) return true;
  if (/@(mailinator|tempmail|guerrillamail|10minutemail|yopmail|trashmail)\./.test(email.toLowerCase())) {
    return true;
  }
  return false;
}

// Real gyms don't get 10+ day pass sign-ups inside 10 minutes. This is the
// backstop against the exact bot pattern that previously hit the old site
// (a script submitting a form every few minutes, ~200/day).
const RATE_LIMIT_WINDOW_MIN = 10;
const RATE_LIMIT_MAX = 10;

type FinalizeInput = {
  name: string;
  email: string;
  phone: string;
  payment_method: "venmo" | "paid_at_desk";
};

type FinalizeResult =
  | { ok: true; existing_member: true; lead_id: string | null }
  | { ok: true; existing_member: false; lead_id: string; updated: true }
  | { ok: true; existing_member: false; lead_id: string; created: true }
  | { ok: false; error: string };

// The actual "make this person a real lead" logic — Antaris check, then
// insert or update the leads row. Shared by the instant Venmo path and
// the staff-approved "paid at desk" path (called once staff approves).
async function finalizeDayPassLead(data: FinalizeInput): Promise<FinalizeResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const now = new Date().toISOString();
  const email = data.email.trim().toLowerCase();
  const phone = data.phone.trim();
  const payment_status = data.payment_method;

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
      const notes = existingLead.notes ? `${existingLead.notes}\n${noteEntry}` : noteEntry;
      await supabaseAdmin.from("leads").update({ notes }).eq("id", existingLead.id);
    }
    return { ok: true, existing_member: true, lead_id: existingLead?.id ?? null };
  }

  const noteEntry = `[${now}] Day pass walk-in — paid via ${payment_status}`;

  if (existingLead) {
    const notes = existingLead.notes ? `${existingLead.notes}\n${noteEntry}` : noteEntry;
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
      return { ok: false, error: upErr.message };
    }
    return { ok: true, existing_member: false, lead_id: existingLead.id, updated: true };
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
    return { ok: false, error: insErr?.message ?? "insert_failed" };
  }

  return { ok: true, existing_member: false, lead_id: inserted.id as string, created: true };
}

export const processDayPassCheckin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Schema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (looksFake(data.name, data.email)) {
      console.warn("[dayPassCheckin] rejected — fake-looking submission", {
        name: data.name,
        email: data.email,
      });
      // Return a generic success-shaped response rather than a specific
      // error, so an automated submitter gets no useful signal back.
      return { ok: true as const, existing_member: false as const, lead_id: null, pending: false as const };
    }

    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MIN * 60 * 1000).toISOString();
    const { count: recentCount, error: rateErr } = await supabaseAdmin
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("source", "day_pass_walkin")
      .gte("created_at", windowStart);
    if (rateErr) {
      console.error("[dayPassCheckin] rate check failed", rateErr.message);
      // Fail open — don't block real guests over a read error.
    } else if ((recentCount ?? 0) >= RATE_LIMIT_MAX) {
      console.warn("[dayPassCheckin] rate limit hit", { recentCount });
      return {
        ok: false as const,
        error: "We're experiencing high demand right now — please see the front desk to check in.",
      };
    }

    // Paid-at-desk means a staff member is physically handling payment
    // right now. Don't finalize the lead until staff confirms it on
    // their end — create a pending request instead.
    if (data.payment_method === "paid_at_desk") {
      const { data: pending, error: pendErr } = await supabaseAdmin
        .from("day_pass_pending_checkins")
        .insert({
          name: data.name.trim(),
          email: data.email.trim().toLowerCase(),
          phone: data.phone.trim(),
          payment_method: "paid_at_desk",
          status: "pending",
        })
        .select("id")
        .single();

      if (pendErr || !pending) {
        console.error("[dayPassCheckin] pending insert error", pendErr?.message);
        return { ok: false as const, error: pendErr?.message ?? "insert_failed" };
      }

      return {
        ok: true as const,
        pending: true as const,
        pending_id: pending.id as string,
        existing_member: false as const,
        lead_id: null,
      };
    }

    // Venmo stays instant — unchanged behavior.
    const result = await finalizeDayPassLead(data);
    return { ...result, pending: false as const };
  });

// --- Staff approval actions ---
// Both require an authenticated admin. Approve runs the same finalize
// logic used for instant Venmo checkouts; reject just closes the request.

export const approveDayPassPending = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ pending_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr || !isAdmin) {
      return { ok: false as const, error: "forbidden" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error: fetchErr } = await supabaseAdmin
      .from("day_pass_pending_checkins")
      .select("id, name, email, phone, status")
      .eq("id", data.pending_id)
      .single();

    if (fetchErr || !row) {
      return { ok: false as const, error: "Request not found." };
    }
    if (row.status !== "pending") {
      return { ok: false as const, error: `Already ${row.status}.` };
    }

    const result = await finalizeDayPassLead({
      name: row.name,
      email: row.email,
      phone: row.phone,
      payment_method: "paid_at_desk",
    });

    if (!result.ok) {
      return { ok: false as const, error: result.error };
    }

    await supabaseAdmin
      .from("day_pass_pending_checkins")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        lead_id: result.lead_id,
      })
      .eq("id", data.pending_id);

    return { ok: true as const, lead_id: result.lead_id };
  });

export const rejectDayPassPending = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ pending_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr || !isAdmin) {
      return { ok: false as const, error: "forbidden" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("day_pass_pending_checkins")
      .update({ status: "rejected", rejected_at: new Date().toISOString() })
      .eq("id", data.pending_id)
      .eq("status", "pending");

    if (error) {
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const };
  });
