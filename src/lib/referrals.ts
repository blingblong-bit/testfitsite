import { supabase } from "@/integrations/supabase/client";

export type Referral = {
  id: string;
  referral_code: string;
  referrer_name: string;
  referrer_contact: string;
  friend_name: string;
  friend_contact: string;
  status: string;
  redeemed_at: string | null;
  redeemed_by: string | null;
  created_at: string;
};

function generateCode(): string {
  // 10-char alphanumeric (uppercase, no confusing chars)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function normalize(v: string) {
  return v.trim().toLowerCase().replace(/[\s()\-]/g, "");
}

export async function createReferral(input: {
  referrer_name: string;
  referrer_contact: string;
  friend_name: string;
  friend_contact: string;
}): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const friend_contact = input.friend_contact.trim();
  if (!friend_contact) return { ok: false, error: "Friend contact is required." };

  // Duplicate check: same friend (by normalized contact) already referred
  const { data: existing, error: dupErr } = await supabase
    .from("referrals")
    .select("id, friend_contact");
  if (dupErr) return { ok: false, error: dupErr.message };
  const norm = normalize(friend_contact);
  if ((existing ?? []).some((r) => normalize(r.friend_contact) === norm)) {
    return { ok: false, error: "This person has already been referred and cannot receive another referral code." };
  }

  // Generate unique code (retry on collision)
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { error } = await supabase.from("referrals").insert({
      referral_code: code,
      referrer_name: input.referrer_name.trim(),
      referrer_contact: input.referrer_contact.trim(),
      friend_name: input.friend_name.trim(),
      friend_contact,
      status: "sent",
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
  if (data.status === "redeemed") return { ok: false, error: "This referral code has already been redeemed." };

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
  return { ok: true, referral: updated as Referral };
}
