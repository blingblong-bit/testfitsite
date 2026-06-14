import { supabase } from "@/integrations/supabase/client";

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
};

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
        .map((p) =>
          p.length === 0 ? p : p[0].toUpperCase() + p.slice(1).toLowerCase(),
        )
        .join("-"),
    )
    .join(" ");
}

export async function createReferral(input: {
  referrer_name: string;
  referrer_email: string;
  friend_name: string;
  friend_email: string;
}): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const referrer_name = titleCase(input.referrer_name);
  const friend_name = titleCase(input.friend_name);
  const referrer_email_raw = normalizeEmail(input.referrer_email);
  const friend_email_raw = normalizeEmail(input.friend_email);

  // Stricter email regex: local@domain.tld with no whitespace, valid tld 2+ chars
  const emailRe = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

  if (!referrer_name) return { ok: false, error: "Referrer name is required." };
  if (!friend_name) return { ok: false, error: "Friend name is required." };
  if (!referrer_email_raw || !emailRe.test(referrer_email_raw))
    return { ok: false, error: "Please enter a valid referrer email address." };
  if (!friend_email_raw || !emailRe.test(friend_email_raw))
    return { ok: false, error: "Please enter a valid friend email address." };
  if (referrer_email_raw === friend_email_raw)
    return { ok: false, error: "Referrer and friend emails must be different." };

  const normalized_referrer_email = referrer_email_raw;
  const normalized_friend_email = friend_email_raw;

  // Duplicate check on friend email
  const { data: existing, error: dupErr } = await supabase
    .from("referrals")
    .select("id, friend_email")
    .ilike("friend_email", normalized_friend_email);
  if (dupErr) return { ok: false, error: dupErr.message };
  if ((existing ?? []).length > 0) {
    return {
      ok: false,
      error: "This email has already been referred and cannot receive another referral code.",
    };
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { error } = await supabase.from("referrals").insert({
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
    });
    if (!error) return { ok: true, code };
    if (!/duplicate|unique/i.test(error.message)) {
      return { ok: false, error: error.message };
    }
  }
  return { ok: false, error: "Could not generate a unique referral code. Try again." };
}

export async function redeemReferral(
  code: string,
  redeemedBy?: string | null,
): Promise<{ ok: true; referral: Referral } | { ok: false; error: string }> {
  const clean = code.trim().toUpperCase();
  if (!clean) return { ok: false, error: "Invalid referral code." };

  const { data, error } = await supabase
    .from("referrals")
    .select("*")
    .eq("referral_code", clean)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Invalid referral code." };
  if (data.status === "redeemed")
    return { ok: false, error: "This referral code has already been redeemed." };

  const { data: updated, error: upErr } = await supabase
    .from("referrals")
    .update({
      status: "redeemed",
      redeemed_at: new Date().toISOString(),
      redeemed_by: redeemedBy?.trim() || null,
    })
    .eq("id", data.id)
    .select("*")
    .single();
  if (upErr) return { ok: false, error: upErr.message };

  const friendEmail = (data.friend_email ?? "").trim();
  const legacyContact = (data.friend_contact ?? "").trim();
  const email = friendEmail || (/@/.test(legacyContact) ? legacyContact : "");
  const phone = !friendEmail && legacyContact && !/@/.test(legacyContact) ? legacyContact : null;

  await supabase.from("leads").insert({
    source: "referral_day_pass",
    status: "checked_in",
    name: data.friend_name,
    email,
    phone,
    referral_code: data.referral_code,
    referred_by: data.referrer_name,
    notes: "Redeemed free day pass from referral code.",
    lead_type: "customer_lead",
    lead_score: 100,
    should_notify: false,
    spam_reason: null,
  });

  return { ok: true, referral: updated as Referral };
}
