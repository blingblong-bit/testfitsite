import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendReferralEmail } from "@/lib/send-referral-email.functions";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type AdminDb = SupabaseClient<Database>;

/**
 * Finds an existing lead by the last 10 digits of their phone number —
 * the same dedup pattern used in submitAppointmentRequest and
 * processDayPassCheckin (phone formats vary wildly across entry points).
 */
async function findLeadByPhone(
  db: AdminDb,
  phone: string,
): Promise<{ id: string; notes: string | null; name: string | null; phone: string | null } | null> {
  const target = (phone ?? "").replace(/\D/g, "").slice(-10);
  if (target.length !== 10) return null;
  const { data, error } = await db
    .from("leads")
    .select("id, notes, name, phone")
    .ilike("phone", `%${target.slice(-4)}%`)
    .limit(50);
  if (error) {
    console.error("[referrals] lead phone lookup failed", error.message);
    return null;
  }
  const match = (data ?? []).find(
    (r) => (r.phone ?? "").replace(/\D/g, "").slice(-10) === target,
  );
  return match ?? null;
}


// Twilio sending + the reserved free-week test numbers live in
// src/lib/sms.server.ts (imported dynamically inside handlers so this
// module stays safe for the client bundle).


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
  lead_id: string | null;

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

function last10(v: string | null | undefined) {
  return (v ?? "").replace(/\D/g, "").slice(-10);
}

const CreateReferralSchema = z.object({
  referrer_name: z.string(),
  referrer_email: z.string().optional(),
  referrer_phone: z.string().optional(),
  friend_name: z.string(),
  friend_email: z.string().optional(),
  friend_phone: z.string().optional(),
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

    const isFreeWeek = input.promo_type === "free_week";

    const referrer_name = titleCase(input.referrer_name);
    const friend_name = titleCase(input.friend_name);
    const referrer_email_raw = normalizeEmail(input.referrer_email ?? "");
    const friend_email_raw = normalizeEmail(input.friend_email ?? "");
    const referrer_phone_raw = (input.referrer_phone ?? "").trim();
    const friend_phone_raw = (input.friend_phone ?? "").trim();

    const emailRe = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

    if (!referrer_name) return { ok: false, error: "Your name is required." };
    if (!friend_name) return { ok: false, error: "Name is required." };

    if (isFreeWeek) {
      // Free-week claims are phone-only: email may be absent entirely.
      if (last10(friend_phone_raw).length !== 10) {
        return { ok: false, error: "Please enter a valid phone number." };
      }
    } else {
      if (!referrer_email_raw || !emailRe.test(referrer_email_raw))
        return { ok: false, error: "Please enter a valid email address." };
      if (!friend_email_raw || !emailRe.test(friend_email_raw))
        return { ok: false, error: "Please enter a valid email address." };
      if (!input.is_self_referral && referrer_email_raw === friend_email_raw)
        return { ok: false, error: "Referrer and friend emails must be different." };
    }

    if (isFreeWeek && Date.now() > new Date(FREE_WEEK_CLAIM_DEADLINE).getTime()) {
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

    const normalized_referrer_email = referrer_email_raw || null;
    const normalized_friend_email = friend_email_raw || null;

    // Duplicate check, scoped to this promo type — someone can still claim
    // a day-pass referral even if they already used the free-week promo,
    // and vice versa. Free-week is phone-based (no email collected).
    if (isFreeWeek) {
      const target = last10(friend_phone_raw);
      const { data: existing, error: dupErr } = await supabaseAdmin
        .from("referrals")
        .select("id, friend_contact")
        .eq("promo_type", "free_week");
      if (dupErr) return { ok: false, error: dupErr.message };
      if ((existing ?? []).some((r) => last10(r.friend_contact) === target)) {
        return {
          ok: false,
          error: "This phone number has already claimed the free week offer.",
        };
      }
    } else {
      const { data: existing, error: dupErr } = await supabaseAdmin
        .from("referrals")
        .select("id, friend_email")
        .eq("promo_type", input.promo_type)
        .ilike("friend_email", friend_email_raw);
      if (dupErr) return { ok: false, error: dupErr.message };
      if ((existing ?? []).length > 0) {
        return {
          ok: false,
          error: "This email has already been referred and cannot receive another referral code.",
        };
      }
    }

    const normalizedPhone = friend_phone_raw ? friend_phone_raw : null;

    // Non-blocking membership tracking for free-week claims: purely
    // informational (member vs general public). Never blocks or delays.
    let referrer_is_member: boolean | null = null;
    if (isFreeWeek) {
      try {
        const { checkMemberMatch } = await import("./antaris/client");
        const match = await Promise.race([
          checkMemberMatch(referrer_name, referrer_email_raw, referrer_phone_raw),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
        ]);
        if (match) referrer_is_member = match.isMember && match.confidence >= 80;
      } catch (e) {
        console.error(
          "[createReferral] non-blocking antaris check failed",
          e instanceof Error ? e.message : e,
        );
      }
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
          friend_contact: normalizedPhone,
          referrer_contact: referrer_phone_raw || null,
          status: "sent",
          email_sent: false,
          email_sent_at: null,
          email_status: "pending",
          promo_type: input.promo_type,
          referrer_is_member,
          is_self_referral: input.is_self_referral,
        })
        .select("id")
        .single();

      if (!error && inserted) {
        // The referral email template hardcodes "free day pass" language,
        // which would be misleading for a free-week claim. Skip it for
        // free_week — an instant SMS with the code/QR link is the primary
        // confirmation for that flow instead (email is skipped entirely).
        if (input.promo_type !== "day_pass") {
          await supabaseAdmin
            .from("referrals")
            .update({ email_status: "pending" })
            .eq("id", inserted.id);

          let smsOk = false;
          if (normalizedPhone) {
            const { sendPromoSms } = await import("./sms.server");
            const redeemUrl = `https://fitbeyondplus.com/redeem-referral?code=${code}`;
            const msg = input.is_self_referral
              ? `FIT Beyond Plus: You're in! Your free week code is ${code}. Redeem it at the front desk or here: ${redeemUrl}`
              : `FIT Beyond Plus: ${referrer_name} sent you a free week! Your code is ${code}. Redeem it at the front desk or here: ${redeemUrl}`;
            const send = await sendPromoSms(normalizedPhone, msg, {
              kind: "free_week_code",
              sentBy: "free_week_promo",
              db: supabaseAdmin,
            });
            smsOk = send.ok;
            if (!send.ok) {
              console.error("[createReferral] free_week instant sms failed", send.error);
            }
          }


          // Create the lead immediately at claim time so it shows up in the
          // Lead Tracker right away — redemption and staff confirmation then
          // update this SAME lead via referrals.lead_id. Never blocks the
          // referral response.
          if (isFreeWeek && smsOk && normalizedPhone) {
            try {
              const nowIso = new Date().toISOString();
              const note = `[${nowIso}] Claimed End of Summer free week — code ${code}`;
              const existing = await findLeadByPhone(supabaseAdmin, normalizedPhone);
              let leadId: string | null = existing?.id ?? null;

              if (existing) {
                const notes = existing.notes ? `${existing.notes}\n${note}` : note;
                await supabaseAdmin
                  .from("leads")
                  .update({
                    notes,
                    referral_code: code,
                    referred_by: referrer_name,
                  })
                  .eq("id", existing.id);
              } else {
                const { data: newLead, error: leadErr } = await supabaseAdmin
                  .from("leads")
                  .insert({
                    source: "referral_free_week",
                    name: friend_name,
                    // leads.email is NOT NULL; free-week claims are phone-only.
                    email: "",

                    phone: normalizedPhone,
                    referral_code: code,
                    referred_by: referrer_name,
                    notes: note,
                    lead_type: "customer_lead",
                    should_notify: true,
                    spam_reason: null,
                    crm_status: "Contacted",
                    sequence_status: "active",
                  })
                  .select("id")
                  .single();
                if (leadErr) throw new Error(leadErr.message);
                leadId = newLead?.id ?? null;
              }

              if (leadId) {
                await supabaseAdmin
                  .from("referrals")
                  .update({ lead_id: leadId })
                  .eq("id", inserted.id);
              }
            } catch (e) {
              console.error(
                "[createReferral] free_week lead creation failed",
                e instanceof Error ? e.message : e,
              );
            }
          }

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
    if (data.status === "arrival_pending")
      return {
        ok: false,
        error:
          "This code is already checked in — stop by the front desk and we'll activate your free week.",
      };

    const nowIso = new Date().toISOString();
    const isFreeWeek = data.promo_type === "free_week";

    // Free week is only truly redeemed once staff confirms the person
    // physically showed up. Park the submitted details on the referral
    // row and wait for confirmFreeWeekArrival — no lead, no access window.
    if (isFreeWeek) {
      const { data: pending, error: pendErr } = await supabaseAdmin
        .from("referrals")
        .update({
          status: "arrival_pending",
          redeemed_by: full_name,
          friend_contact: phone,
          friend_email: email,
        })
        .eq("id", data.id)
        .select("*")
        .single();
      if (pendErr) return { ok: false, error: pendErr.message };

      // Move the SAME lead created at claim time forward — never create a
      // duplicate. Fallback creates one only if claim-time creation failed.
      try {
        const note = `[${nowIso}] Arrived at front desk, awaiting staff confirmation`;
        const leadId = (pending as { lead_id?: string | null }).lead_id ?? null;

        if (leadId) {
          const { data: lead } = await supabaseAdmin
            .from("leads")
            .select("id, notes, name, phone")
            .eq("id", leadId)
            .maybeSingle();
          const notes = lead?.notes ? `${lead.notes}\n${note}` : note;
          const patch: {
            crm_status: string;
            notes: string;
            phone?: string;
            name?: string;
            email?: string;
          } = {

            crm_status: "Waiting on Response",
            notes,
          };
          if (lead && (lead.phone ?? "").replace(/\D/g, "").slice(-10) !== last10(phone)) {
            patch.phone = phone;
          }
          if (lead && (lead.name ?? "").trim() !== full_name) patch.name = full_name;
          if (email) patch.email = email;
          await supabaseAdmin.from("leads").update(patch).eq("id", leadId);
        } else {
          const existing = await findLeadByPhone(supabaseAdmin, phone);
          let newId: string | null = existing?.id ?? null;
          if (existing) {
            const notes = existing.notes ? `${existing.notes}\n${note}` : note;
            await supabaseAdmin
              .from("leads")
              .update({ crm_status: "Waiting on Response", notes, name: full_name, email })
              .eq("id", existing.id);
          } else {
            const { data: created, error: insErr } = await supabaseAdmin
              .from("leads")
              .insert({
                source: "referral_free_week",
                name: full_name,
                email,
                phone,
                referral_code: data.referral_code,
                referred_by: data.referrer_name,
                notes: note,
                lead_type: "customer_lead",
                should_notify: true,
                spam_reason: null,
                crm_status: "Waiting on Response",
                sequence_status: "active",
              })
              .select("id")
              .single();
            if (insErr) throw new Error(insErr.message);
            newId = created?.id ?? null;
          }
          if (newId) {
            await supabaseAdmin.from("referrals").update({ lead_id: newId }).eq("id", data.id);
          }
        }
      } catch (e) {
        console.error(
          "[redeemReferral] free_week lead update failed",
          e instanceof Error ? e.message : e,
        );
      }


      const { sendPromoSms } = await import("./sms.server");
      const send = await sendPromoSms(
        phone,
        `You're all set, ${full_name}! Come by the front desk at FIT Beyond Plus and we'll get your free week activated. We're at 449 W Lincoln St, Tullahoma!`,
        {
          kind: "free_week_arrival_pending",
          sentBy: "free_week_promo",
          db: supabaseAdmin,
          leadId: (pending as { lead_id?: string | null }).lead_id ?? null,
        },
      );
      if (!send.ok) console.error("[redeemReferral] free_week arrival sms failed", send.error);


      return { ok: true, referral: pending as Referral };
    }


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

const ArrivalSchema = z.object({ referral_id: z.string().uuid() });

/**
 * Staff-only: confirms a free-week claimant physically arrived. This is
 * the point where the promo actually becomes redeemed — access window
 * opens and the lead record is created/updated.
 */
export const confirmFreeWeekArrival = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ArrivalSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr || !isAdmin) return { ok: false, error: "forbidden" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error: fetchErr } = await supabaseAdmin
      .from("referrals")
      .select("*")
      .eq("id", data.referral_id)
      .maybeSingle();
    if (fetchErr) return { ok: false, error: fetchErr.message };
    if (!row) return { ok: false, error: "Referral not found." };
    if (row.promo_type !== "free_week") return { ok: false, error: "Not a free-week referral." };
    if (row.status !== "arrival_pending")
      return { ok: false, error: `Referral is not awaiting arrival (status: ${row.status}).` };

    const nowIso = new Date().toISOString();
    const endsIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: upErr } = await supabaseAdmin
      .from("referrals")
      .update({
        status: "redeemed",
        redeemed_at: nowIso,
        access_starts_at: nowIso,
        access_ends_at: endsIso,
      })
      .eq("id", row.id);
    if (upErr) return { ok: false, error: upErr.message };

    const full_name = (row.redeemed_by ?? row.friend_name ?? "").trim();
    const email = (row.friend_email ?? "").trim().toLowerCase();
    const phone = (row.friend_contact ?? "").trim();

    const noteEntry = `[${nowIso}] Arrival confirmed by staff — End of Summer free week activated, access through ${endsIso}`;
    const leadFields = {
      crm_status: "Tour Completed",
      sequence_status: "paused",
      lead_score: 100,
    };

    // Prefer the lead linked at claim time — that's the same record the
    // Lead Tracker has been showing since the claim. Email/phone matching
    // is only a fallback for referrals created before lead_id existed.
    let existingLead: { id: string; notes: string | null } | undefined;
    const linkedLeadId = (row as { lead_id?: string | null }).lead_id ?? null;
    if (linkedLeadId) {
      const { data: linked } = await supabaseAdmin
        .from("leads")
        .select("id, notes")
        .eq("id", linkedLeadId)
        .maybeSingle();
      if (linked) existingLead = linked;
    }
    if (!existingLead && email) {
      const { data: existingLeads, error: findLeadErr } = await supabaseAdmin
        .from("leads")
        .select("id, notes")
        .ilike("email", email)
        .limit(1);
      if (findLeadErr) return { ok: false, error: findLeadErr.message };
      existingLead = existingLeads?.[0];
    }
    if (!existingLead && phone) {
      const byPhone = await findLeadByPhone(supabaseAdmin, phone);
      if (byPhone) existingLead = { id: byPhone.id, notes: byPhone.notes };
    }


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
      const { data: created } = await supabaseAdmin
        .from("leads")
        .insert({
          source: "referral_free_week",
          status: "redeemed",
          name: full_name,
          email,
          phone,
          referral_code: row.referral_code,
          referred_by: row.referrer_name,
          notes: noteEntry,
          lead_type: "customer_lead",
          should_notify: true,
          spam_reason: null,
          tour_completed: true,
          tour_date: nowIso,
          ...leadFields,
        })
        .select("id")
        .single();
      if (created?.id) {
        await supabaseAdmin.from("referrals").update({ lead_id: created.id }).eq("id", row.id);
      }
    }
    if (existingLead) {
      await supabaseAdmin.from("referrals").update({ lead_id: existingLead.id }).eq("id", row.id);
    }


    const { sendPromoSms } = await import("./sms.server");
    const linkedLead = existingLead?.id ?? (row as { lead_id?: string | null }).lead_id ?? null;

    if (phone) {
      const send = await sendPromoSms(
        phone,
        `You're active, ${full_name || "friend"}! Your free week at FIT Beyond Plus is officially started and runs through ${new Date(endsIso).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "long", day: "numeric" })}. See you soon!`,
        { kind: "free_week_activated", sentBy: "free_week_promo", db: supabaseAdmin, leadId: linkedLead },
      );
      if (!send.ok) console.error("[confirmFreeWeekArrival] sms failed", send.error);
    }

    // Referrer reward: extend the referrer's OWN free week by 7 days.
    // Never allowed to fail the friend's arrival confirmation above.
    try {
      const { applyReferrerReward, applyPendingRewardsForPhone } = await import(
        "./referrer-reward.server"
      );
      await applyReferrerReward(supabaseAdmin, row, full_name);

      // This person may themselves have earned rewards from friends who
      // arrived before them — pay those out now that their week is active.
      await applyPendingRewardsForPhone(supabaseAdmin, {
        ownReferralId: row.id,
        phone,
        leadId: linkedLead,
      });
    } catch (e) {
      console.error(
        "[confirmFreeWeekArrival] referrer reward failed",
        e instanceof Error ? e.message : e,
      );
    }



    return { ok: true };

  });

/**
 * Staff-only: undo an arrival check-in (wrong info, not actually here).
 * Puts the code back to 'sent' so it can be used again. No lead effects.
 */
export const rejectFreeWeekArrival = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ArrivalSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr || !isAdmin) return { ok: false, error: "forbidden" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error: fetchErr } = await supabaseAdmin
      .from("referrals")
      .select("id, status, promo_type")
      .eq("id", data.referral_id)
      .maybeSingle();
    if (fetchErr) return { ok: false, error: fetchErr.message };
    if (!row) return { ok: false, error: "Referral not found." };
    if (row.status !== "arrival_pending")
      return { ok: false, error: `Referral is not awaiting arrival (status: ${row.status}).` };

    const { error: upErr } = await supabaseAdmin
      .from("referrals")
      .update({ status: "sent" })
      .eq("id", row.id);
    if (upErr) return { ok: false, error: upErr.message };

    return { ok: true };
  });
