import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AttributionSchema, attributionColumns, type AttributionInput } from "./attribution";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Schema = z
  .object({
    // A recognized returning guest only types their phone, so name/email may
    // be blank — we pull them from the matched lead instead.
    name: z.string().trim().max(200).optional().default(""),
    email: z.string().trim().max(200).optional().default(""),
    phone: z.string().trim().min(1).max(40),
    payment_method: z.enum(["venmo", "paid_at_desk"]),
    lead_id: z.string().uuid().optional().nullable(),
    attribution: AttributionSchema,
  })
  .refine(
    (d) => Boolean(d.lead_id) || (d.name.length > 0 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)),
    { message: "Name and a valid email are required." },
  );

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

const DAY_PASS_PRICE = 10;

type FinalizeInput = {
  name: string;
  email: string;
  phone: string;
  payment_method: "venmo" | "paid_at_desk";
  lead_id?: string | null;
  attribution?: AttributionInput;
};

type FinalizeResult =
  | { ok: true; existing_member: true; lead_id: string | null }
  | { ok: true; existing_member: false; lead_id: string; updated: true }
  | { ok: true; existing_member: false; lead_id: string; created: true }
  | { ok: false; error: string };

// Every day pass gets its own history row, so a repeat guest shows a real
// visit count and dates instead of a single overwritten timestamp.
async function recordPurchase(
  leadId: string,
  purchasedAt: string,
  paymentMethod: string,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("day_pass_purchases").insert({
    lead_id: leadId,
    purchased_at: purchasedAt,
    payment_method: paymentMethod,
    amount: DAY_PASS_PRICE,
    recorded_via: "checkin",
  });
  if (error) console.error("[dayPassCheckin] purchase log failed", error.message);
}

// The actual "make this person a real lead" logic — Antaris check, then
// insert or update the leads row. Shared by the instant Venmo path and
// the staff-approved "paid at desk" path (called once staff approves).
async function finalizeDayPassLead(data: FinalizeInput): Promise<FinalizeResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const now = new Date().toISOString();
  const email = data.email.trim().toLowerCase();
  const phone = data.phone.trim();
  const payment_status = data.payment_method;

  // A lead_id from the up-front phone lookup is the strongest signal we have:
  // the record was chosen before the purchase, so a returning guest can never
  // spin off a second record by typing a different email.
  let existingLead:
    | { id: string; notes: string | null; email: string | null; phone: string | null; name?: string | null }
    | undefined;

  if (data.lead_id) {
    const { data: byId } = await supabaseAdmin
      .from("leads")
      .select("id, notes, email, phone, name")
      .eq("id", data.lead_id)
      .maybeSingle();
    if (byId) existingLead = byId;
  }

  if (!existingLead) {
    // Match by email OR by last-10-digits of phone (format-agnostic).
    const phoneDigits = phone.replace(/\D/g, "").slice(-10);
    const last4 = phoneDigits.slice(-4);
    const orFilters: string[] = [];
    if (email) orFilters.push(`email.ilike.${email}`);
    if (last4.length === 4) orFilters.push(`phone.ilike.%${last4}%`);
    if (orFilters.length > 0) {
      const { data: existingCandidates, error: findErr } = await supabaseAdmin
        .from("leads")
        .select("id, notes, email, phone, name")
        .or(orFilters.join(","));
      if (findErr) {
        console.error("[dayPassCheckin] find error", findErr.message);
      }
      existingLead = (existingCandidates ?? []).find((r) => {
        if (email && (r.email ?? "").trim().toLowerCase() === email) return true;
        if (phoneDigits.length === 10 &&
            (r.phone ?? "").replace(/\D/g, "").slice(-10) === phoneDigits) return true;
        return false;
      });
    }
  }

  const name = data.name.trim() || (existingLead?.name ?? "").trim();
  const resolvedEmail = email || (existingLead?.email ?? "").trim().toLowerCase();

  let existingMember = false;
  try {
    const { checkMemberMatch } = await import("./antaris/client");
    const match = await checkMemberMatch(name, resolvedEmail, phone);
    if (match.isMember && match.confidence >= 80) {
      existingMember = true;
    }
  } catch (e) {
    console.error("[dayPassCheckin] antaris check failed", e);
  }

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
        day_pass_price: DAY_PASS_PRICE,
        // Hard purchase evidence — this is what makes them a Day Pass
        // Customer rather than a prospect in the tracker. Stays the
        // latest-purchase field; full history lives in day_pass_purchases.
        day_pass_purchased_at: now,
        notes,
      })
      .eq("id", existingLead.id);
    if (upErr) {
      console.error("[dayPassCheckin] update error", upErr.message);
      return { ok: false, error: upErr.message };
    }
    await recordPurchase(existingLead.id, now, payment_status);
    return { ok: true, existing_member: false, lead_id: existingLead.id, updated: true };
  }

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("leads")
    .insert({
      source: "day_pass_walkin",
      name,
      email: resolvedEmail,
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
      day_pass_price: DAY_PASS_PRICE,
      day_pass_purchased_at: now,
      ...attributionColumns(data.attribution),
      status: "checked_in",
      notes: noteEntry,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    console.error("[dayPassCheckin] insert error", insErr?.message);
    return { ok: false, error: insErr?.message ?? "insert_failed" };
  }

  await recordPurchase(inserted.id as string, now, payment_status);

  return { ok: true, existing_member: false, lead_id: inserted.id as string, created: true };
}

export const processDayPassCheckin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Schema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!data.lead_id && looksFake(data.name, data.email)) {
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
      const phone = data.phone.trim();
      const digits = phone.replace(/\D/g, "").slice(-10);

      // A second request from the same guest reuses the one already waiting
      // instead of stacking up duplicate rows for staff.
      const { data: waiting } = await supabaseAdmin
        .from("day_pass_pending_checkins")
        .select("id, phone")
        .eq("status", "pending");
      const already = (waiting ?? []).find(
        (r) => digits.length === 10 && (r.phone ?? "").replace(/\D/g, "").slice(-10) === digits,
      );
      if (already) {
        return {
          ok: true as const,
          pending: true as const,
          pending_id: already.id as string,
          existing_member: false as const,
          lead_id: null,
        };
      }

      let name = data.name.trim();
      let email = data.email.trim().toLowerCase();
      if (data.lead_id && (!name || !email)) {
        const { data: lead } = await supabaseAdmin
          .from("leads")
          .select("name, email")
          .eq("id", data.lead_id)
          .maybeSingle();
        if (lead) {
          name = name || (lead.name ?? "");
          email = email || (lead.email ?? "").toLowerCase();
        }
      }

      const { data: pending, error: pendErr } = await supabaseAdmin
        .from("day_pass_pending_checkins")
        .insert({
          name,
          email,
          phone,
          payment_method: "paid_at_desk",
          status: "pending",
          lead_id: data.lead_id ?? null,
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
      .select("id, name, email, phone, status, lead_id")
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
      lead_id: row.lead_id,
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
