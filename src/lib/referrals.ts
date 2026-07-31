import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sendReferralEmail } from "@/lib/send-referral-email.functions";

export type Referral = {
  id: string;
  referral_code: string;
  referrer_name: string;
  referrer_email: string | null;
  referrer_contact: string | null;
  normalized_referrer_email: string | null;
  friend_name: string;
  friend_email: string | null;
  friend_contact: string | null;
  status: string;
  email_sent: boolean;
  email_sent_at: string | null;
  email_status: "pending" | "sent" | "failed";
  redeemed_at: string | null;
  redeemed_by: string | null;
  created_at: string;
  promo_type: "day_pass" | "free_week";
  access_starts_at: string | null;
  access_ends_at: string | null;
};

// End-of-summer free week claim deadline: Sept 7, 2026 11:59:59 PM
// Central (CDT, UTC-5 — Sept is after DST change), precomputed to UTC.
const FREE_WEEK_CLAIM_DEADLINE = "2026-09-08T04:59:59.000Z";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function normalizeEmail(v: string) {
  return v.trim().toLowerCase();
}

function titleCase(v: string) {
  return v
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) =>
      w
        .split("-")
        .map((p) => (p.length === 0 ? p : p[0].toUpperCase() + p.slice(1).toLowerCase()))
        .join("-"),
    )
    .join(" ");
}

const CreateReferralSchema = z.object({
  referrer_name: z.string(),
  referrer_email: z.string(),
  friend_name: z.string(),
  friend_email: z.string(),
  promo_type: z.enum(["day_pass", "free_week"]).default("day_pass"),
  is_self_referral: z.boolean().default(false),
});

/**
 * Creates a referral code. Runs server-side with supabaseAdmin (service
 * role) because the referrals and leads tables have no anon RLS policy —
 * this was previously called directly from the browser client and
 * silently failed for real anonymous visitors ("new row violates
 * row-level security policy").
 */
export const createReferral = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CreateReferralSchema.parse(d))
  .handler(async ({
    data: input,
  }): Promise<{ ok: true; code: string } | { ok: false; error: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const referrer_name = titleCase(input.referrer_name);
    const friend_name = titleCase(input.friend_name);
    const referrer_email_raw = normalizeEmail(input.referrer_email);
    const friend_email_raw = normalizeEmail(input.friend_email);

    const emailRe = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

    if (!referrer_name) return { ok: false, error: "Your name is required." };
    if (!friend_name) return { ok: false, error: "Name is required." };
    if (!referrer_email_raw || !emailRe.test(referrer_email_raw))
      return { ok: false, error: "Please enter a valid email address." };
    if (!friend_email_raw || !emailRe.test(friend_email_raw))
      return { ok: false, error: "Please enter a valid email address." };
    if (!input.is_self_referral && referrer_email_raw === friend_email_raw)
      return { ok: false, error: "Referrer and friend emails must be different." };

    if (input.promo_type === "free_week" && Date.now() > new Date(FREE_WEEK_CLAIM_DEADLINE).getTime()) {
      return { ok: false, error: "This offer has ended. Thanks for checking it out!" };
    }

    // Day-pass referrals require the referrer to be a real, verified
    // member — this is the traditional "existing customer vouches for a
    // friend" referral. Free-week is intentionally left open (it's an
    // acquisition promo, not a loyalty perk — see design discussion).
    //
    // Explicit bypass for the gym's own system-generated day-pass codes
    // (walk-ins, appointment approvals via generateDayPassCode) — those
    // use a business account, not a real person, and would never pass
    // Antaris verification.
    const isSystemGeneratedBusinessAccount =
      referrer_email_raw === "info@fitbeyondplus.com" && referrer_name === "Fit Beyond Plus";

    if (input.promo_type === "day_pass" && !isSystemGeneratedBusinessAccount) {
      const { checkMemberMatch } = await import("./antaris/client");
      const match = await checkMemberMatch(referrer_name, referrer_email_raw, "");
      if (!match.isMember || match.confidence < 80) {
        return {
          ok: false,
          error:
            "We couldn't verify your membership. Please make sure your name and email match what's on file, or ask the front desk for help.",
        };
      }
    }

    const normalized_referrer_email = referrer_email_raw;
    const normalized_friend_email = friend_email_raw;

    // Duplicate check, scoped to this promo type — someone can still claim
    // a day-pass referral even if they already used the free-week promo,
    // and vice versa.
    const { data: existing, error: dupErr } = await supabaseAdmin
      .from("referrals")
      .select("id, friend_email")
      .eq("promo_type", input.promo_type)
      .ilike("friend_email", normalized_friend_email);
    if (dupErr) return { ok: false, error: dupErr.message };
    if ((existing ?? []).length > 0) {
      return {
        ok: false,
        error:
          input.promo_type === "free_week"
            ? "This email has already claimed the free week offer."
            : "This email has already been referred and cannot receive another referral code.",
      };
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      const { data: inserted, error } = await supabaseAdmin
        .from("referrals")
        .insert({
          referral_code: code,
          referrer_name,
          referrer_email: normalized_referrer_email,
          normalized_referrer_email,
          friend_name,
          friend_email: normalized_friend_email,
          status: "sent",
          email_sent: false,
          email_sent_at: null,
          email_status: "pending",
          promo_type: input.promo_type,
        })
        .select("id")
        .single();
      if (!error && inserted) {
        // The referral email template hardcodes "free day pass" language,
        // which would be misleading for a free-week claim. Skip it for
        // free_week — the on-screen QR confirmation is the primary
        // interface for that flow instead.
        if (input.promo_type !== "day_pass") {
          await supabaseAdmin
            .from("referrals")
            .update({ email_status: "pending" })
            .eq("id", inserted.id);
          return { ok: true, code };
        }
        try {
          const result = await sendReferralEmail({
            data: {
              friend_name,
              friend_email: normalized_friend_email,
              referrer_name,
              referral_code: code,
            },
          });
          if (result.ok) {
            await supabaseAdmin
              .from("referrals")
              .update({ email_status: "sent", email_sent: true, email_sent_at: new Date().toISOString() })
              .eq("id", inserted.id);
          } else {
            console.error("[createReferral] email failed", result.error);
            await supabaseAdmin
              .from("referrals")
              .update({ email_status: "failed", email_sent: false })
              .eq("id", inserted.id);
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : "send_exception";
          console.error("[createReferral] email exception", msg);
          await supabaseAdmin
            .from("referrals")
            .update({ email_status: "failed", email_sent: false })
            .eq("id", inserted.id);
        }
        return { ok: true, code };
      }
      if (error && !/duplicate|unique/i.test(error.message)) {
        return { ok: false, error: error.message };
      }
    }
    return { ok: false, error: "Could not generate a unique referral code. Try again." };
  });

const LookupReferralSchema = z.object({ code: z.string() });

export const lookupReferral = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => LookupReferralSchema.parse(d))
  .handler(async ({
    data,
  }): Promise<{ ok: true; referral: Referral } | { ok: false; error: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const clean = data.code.trim().toUpperCase();
    if (!clean) return { ok: false, error: "Invalid referral code." };
    const { data: row, error } = await supabaseAdmin
      .from("referrals")
      .select("*")
      .eq("referral_code", clean)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!row) return { ok: false, error: "Invalid referral code." };
    if (row.status === "redeemed")
      return { ok: false, error: "This referral code has already been redeemed." };
    return { ok: true, referral: row as Referral };
  });

const RedeemReferralSchema = z.object({
  code: z.string(),
  full_name: z.string(),
  email: z.string(),
  phone: z.string(),
});

export const redeemReferral = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => RedeemReferralSchema.parse(d))
  .handler(async ({
    data: input,
  }): Promise<{ ok: true; referral: Referral } | { ok: false; error: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const clean = input.code.trim().toUpperCase();
    if (!clean) return { ok: false, error: "Invalid referral code." };

    const full_name = input.full_name.trim();
    const email = input.email.trim().toLowerCase();
    const phone = input.phone.trim();
    if (!full_name) return { ok: false, error: "Full name is required." };
    if (!email) return { ok: false, error: "Email is required." };
    if (!phone) return { ok: false, error: "Phone number is required." };

    const { data, error } = await supabaseAdmin
      .from("referrals")
      .select("*")
      .eq("referral_code", clean)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Invalid referral code." };
    if (data.status === "redeemed")
      return { ok: false, error: "This referral code has already been redeemed." };

    const nowIso = new Date().toISOString();
    const isFreeWeek = data.promo_type === "free_week";

    const referralUpdate: {
      status: string;
      redeemed_at: string;
      redeemed_by: string;
      friend_contact: string;
      access_starts_at?: string;
      access_ends_at?: string;
    } = {
      status: "redeemed",
      redeemed_at: nowIso,
      redeemed_by: full_name,
      // Persist the redeemer's phone here so class check-in can later
      // match "does this person have an active free-week promo" — this
      // wasn't stored on the referral row before, only on the lead.
      friend_contact: phone,
    };
    if (isFreeWeek) {
      referralUpdate.access_starts_at = nowIso;
      referralUpdate.access_ends_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    }

    const { data: updated, error: upErr } = await supabaseAdmin
      .from("referrals")
      .update(referralUpdate)
      .eq("id", data.id)
      .select("*")
      .single();
    if (upErr) return { ok: false, error: upErr.message };

    const noteEntry = isFreeWeek
      ? `[${nowIso}] Redeemed End of Summer free week promo — access through ${
          (referralUpdate.access_ends_at as string) ?? ""
        }`
      : `[${nowIso}] Redeemed free day pass at front desk`;

    const { data: existingLeads, error: findLeadErr } = await supabaseAdmin
      .from("leads")
      .select("id, notes")
      .ilike("email", email)
      .limit(1);
    if (findLeadErr) return { ok: false, error: findLeadErr.message };

    const existingLead = existingLeads?.[0];
    const leadFields = isFreeWeek
      ? {
          crm_status: "Tour Completed",
          sequence_status: "paused", // don't fire cold follow-ups during their active free week
          lead_score: 100,
        }
      : {
          crm_status: "Tour Completed",
          sequence_status: "active",
          lead_score: 100,
        };

    if (existingLead) {
      const notes = existingLead.notes ? `${existingLead.notes}\n${noteEntry}` : noteEntry;
      await supabaseAdmin
        .from("leads")
        .update({
          tour_completed: true,
          tour_date: nowIso,
          notes,
          ...leadFields,
        })
        .eq("id", existingLead.id);
    } else {
      await supabaseAdmin.from("leads").insert({
        source: isFreeWeek ? "referral_free_week" : "referral_day_pass",
        status: "redeemed",
        name: full_name,
        email,
        phone,
        referral_code: data.referral_code,
        referred_by: data.referrer_name,
        notes: noteEntry,
        lead_type: "customer_lead",
        should_notify: true,
        spam_reason: null,
        tour_completed: true,
        tour_date: nowIso,
        ...leadFields,
      });
    }

    return { ok: true, referral: updated as Referral };
  });
