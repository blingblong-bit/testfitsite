import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  slotsForDate,
  filterAvailable,
  formatChicagoDateTime,
  BOOKING_WINDOW_DAYS,
} from "./appointment-availability";

// ---------- helpers ----------

function normalizePhoneE164(raw: string): string {
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
): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) return { ok: false, error: "twilio_not_configured" };
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
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
    console.error("[appointments] twilio error", res.status, t);
    return { ok: false, error: `twilio_${res.status}` };
  }
  const json = (await res.json()) as { sid?: string };
  return { ok: true, sid: json.sid };
}

async function logOutbound(
  leadId: string | null,
  phone: string,
  body: string,
  sid: string | null,
  kind: string,
) {
  if (!leadId) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("sms_conversation_log").insert({
    lead_id: leadId,
    phone,
    direction: "outbound",
    body,
    from_ai: false,
    provider_message_id: sid,
    status: sid ? "sent" : "failed",
    metadata: { kind },
  });
}

// ---------- available slots (public) ----------

export const getAvailableSlotsFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const slots = slotsForDate(data.date);
    if (slots.length === 0) return { slots: [] as string[] };
    // Query the day's confirmed appointments to exclude.
    const start = slots[0];
    const end = new Date(new Date(slots[slots.length - 1]).getTime() + 60 * 60 * 1000).toISOString();
    const { data: taken } = await supabaseAdmin
      .from("appointments")
      .select("confirmed_time")
      .eq("status", "confirmed")
      .gte("confirmed_time", start)
      .lte("confirmed_time", end);
    const takenTimes = (taken ?? [])
      .map((r) => r.confirmed_time as string | null)
      .filter((v): v is string => Boolean(v));
    return { slots: filterAvailable(slots, takenTimes) };
  });

// ---------- public booking submit ----------

const SubmitSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(7).max(40),
  requested_time: z.string().datetime(),
  sms_consent: z.boolean(),
});

function looksFake(name: string, email: string): boolean {
  if (/\d{3,}/.test(name) || /(.)\1{4,}/.test(name)) return true;
  if (/@(mailinator|tempmail|guerrillamail|10minutemail|yopmail|trashmail)\./.test(email.toLowerCase())) {
    return true;
  }
  return false;
}

export const submitAppointmentRequest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SubmitSchema.parse(d))
  .handler(async ({ data }) => {
    if (looksFake(data.name, data.email)) {
      // Return success-shaped noop to avoid signaling to bots.
      return { ok: true as const };
    }
    if (!data.sms_consent) {
      return { ok: false as const, error: "SMS consent is required to book." };
    }
    // Requested time must be within the booking window and in the future.
    const reqMs = new Date(data.requested_time).getTime();
    const now = Date.now();
    if (reqMs < now || reqMs > now + BOOKING_WINDOW_DAYS * 24 * 60 * 60 * 1000) {
      return { ok: false as const, error: "That time is no longer available." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();
    const phone = data.phone.trim();

    // Dedup lead (same pattern as processDayPassCheckin): match by email or
    // by last-10-digits of phone.
    const phoneDigits = phone.replace(/\D/g, "").slice(-10);
    const last4 = phoneDigits.slice(-4);
    const orFilters = [`email.ilike.${email}`];
    if (last4.length === 4) orFilters.push(`phone.ilike.%${last4}%`);
    const { data: existingCandidates } = await supabaseAdmin
      .from("leads")
      .select("id, email, phone")
      .or(orFilters.join(","))
      .limit(50);
    let leadId: string | null =
      (existingCandidates ?? []).find((r) => {
        if ((r.email ?? "").trim().toLowerCase() === email) return true;
        if (
          phoneDigits.length === 10 &&
          (r.phone ?? "").replace(/\D/g, "").slice(-10) === phoneDigits
        ) return true;
        return false;
      })?.id ?? null;

    if (!leadId) {
      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("leads")
        .insert({
          source: "schedule_visit",
          name: data.name.trim(),
          email,
          phone,
          interest: "Tour / visit",
          message: `Requested a visit for ${formatChicagoDateTime(data.requested_time)}`,
          lead_type: "customer_lead",
          should_notify: true,
          lead_score: 85,
          crm_status: "New Lead",
          sequence_status: "active",
        })
        .select("id")
        .single();
      if (insErr || !inserted) {
        console.error("[appointments] lead insert failed", insErr?.message);
        return { ok: false as const, error: "Could not save your request." };
      }
      leadId = inserted.id as string;
    }

    const { data: appt, error: apptErr } = await supabaseAdmin
      .from("appointments")
      .insert({
        lead_id: leadId,
        name: data.name.trim(),
        phone,
        email,
        requested_time: data.requested_time,
        status: "pending",
        type: "tour",
      })
      .select("id")
      .single();
    if (apptErr || !appt) {
      console.error("[appointments] insert failed", apptErr?.message);
      return { ok: false as const, error: "Could not save your request." };
    }

    // Send the "we got your request" text.
    const to = normalizePhoneE164(phone);
    const firstName = data.name.trim().split(/\s+/)[0] || "there";
    const msg = `Hey ${firstName}! We got your request for ${formatChicagoDateTime(
      data.requested_time,
    )} — we'll confirm shortly!`;
    const send = await sendTwilioSms(to, msg);
    await logOutbound(leadId, to, msg, send.sid ?? null, "appointment_requested");

    return { ok: true as const, appointment_id: appt.id as string };
  });

// ---------- admin actions ----------

async function requireAdmin(context: {
  supabase: any;
  userId: string;
}): Promise<boolean> {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  return Boolean(data);
}

const IdSchema = z.object({ appointment_id: z.string().uuid() });

export const approveAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!(await requireAdmin(context))) return { ok: false as const, error: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("appointments")
      .select("id, name, phone, requested_time, status, lead_id")
      .eq("id", data.appointment_id)
      .single();
    if (error || !row) return { ok: false as const, error: "Not found." };
    if (row.status !== "pending" && row.status !== "alternative_suggested") {
      return { ok: false as const, error: `Already ${row.status}.` };
    }
    const confirmed = row.requested_time;
    await supabaseAdmin
      .from("appointments")
      .update({
        status: "confirmed",
        confirmed_time: confirmed,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (row.lead_id) {
      await supabaseAdmin
        .from("leads")
        .update({
          tour_scheduled: true,
          tour_date: confirmed,
          crm_status: "Tour Scheduled",
          sequence_status: "paused",
        })
        .eq("id", row.lead_id);
    }

    const to = normalizePhoneE164(row.phone);
    const firstName = String(row.name ?? "there").split(/\s+/)[0] || "there";
    const msg = `You're all set, ${firstName}! Your visit to FIT Beyond Plus is confirmed for ${formatChicagoDateTime(
      confirmed,
    )}. See you then at 449 W Lincoln St, Tullahoma!`;
    const send = await sendTwilioSms(to, msg);
    await logOutbound(row.lead_id, to, msg, send.sid ?? null, "appointment_confirmed");
    return { ok: true as const };
  });

export const suggestAlternativeAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        appointment_id: z.string().uuid(),
        suggested_time: z.string().datetime(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await requireAdmin(context))) return { ok: false as const, error: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("appointments")
      .select("id, name, phone, lead_id, status")
      .eq("id", data.appointment_id)
      .single();
    if (error || !row) return { ok: false as const, error: "Not found." };
    if (row.status !== "pending" && row.status !== "alternative_suggested") {
      return { ok: false as const, error: `Already ${row.status}.` };
    }

    await supabaseAdmin
      .from("appointments")
      .update({
        status: "alternative_suggested",
        suggested_time: data.suggested_time,
      })
      .eq("id", row.id);

    const to = normalizePhoneE164(row.phone);
    const msg = `That time doesn't work, but how about ${formatChicagoDateTime(
      data.suggested_time,
    )} instead? Reply YES to confirm or let us know what works better.`;
    const send = await sendTwilioSms(to, msg);
    await logOutbound(row.lead_id, to, msg, send.sid ?? null, "appointment_alt_suggested");
    return { ok: true as const };
  });

export const declineAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!(await requireAdmin(context))) return { ok: false as const, error: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("appointments")
      .update({ status: "declined" })
      .eq("id", data.appointment_id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
