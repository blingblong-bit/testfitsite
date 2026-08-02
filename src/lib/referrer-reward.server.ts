import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Db = SupabaseClient<Database>;

function last10(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "").slice(-10);
}

function toE164(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return "+" + trimmed.slice(1).replace(/\D/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export type RewardResult =
  | { status: "skipped_self" }
  | { status: "extended"; new_end: string; own_referral_id: string }
  | { status: "no_active_window" }
  | { status: "error"; error: string };

/**
 * Extends the referrer's OWN free week by 7 days as a thank-you once their
 * friend's arrival is confirmed. Purely additive — callers must never let a
 * failure here fail the friend's arrival confirmation.
 */
export async function applyReferrerReward(
  db: Db,
  row: {
    id: string;
    referrer_contact: string | null;
    friend_name: string | null;
    is_self_referral?: boolean | null;
  },
  friendDisplayName: string,
  sendSms: (to: string, body: string) => Promise<{ ok: boolean; error?: string }>,
): Promise<RewardResult> {
  if (row.is_self_referral) return { status: "skipped_self" };

  try {
    const target = last10(row.referrer_contact);

    if (target.length === 10) {
      const { data: candidates } = await db
        .from("referrals")
        .select("id, friend_contact, access_ends_at")
        .eq("promo_type", "free_week")
        .eq("status", "redeemed")
        .order("access_ends_at", { ascending: false, nullsFirst: false })
        .limit(500);

      // Their own prior claim = a row where THEY were the redeeming friend.
      const own = (candidates ?? []).find((r) => last10(r.friend_contact) === target);

      if (own) {
        const base = Math.max(
          own.access_ends_at ? new Date(own.access_ends_at).getTime() : 0,
          Date.now(),
        );
        const newEnd = new Date(base + 7 * 24 * 60 * 60 * 1000).toISOString();

        await db.from("referrals").update({ access_ends_at: newEnd }).eq("id", own.id);
        await db
          .from("referrals")
          .update({ referrer_reward_status: "extended" })
          .eq("id", row.id);

        const pretty = new Date(newEnd).toLocaleDateString("en-US", {
          timeZone: "America/Chicago",
          month: "long",
          day: "numeric",
        });
        const send = await sendSms(
          toE164(row.referrer_contact ?? ""),
          `Hey! ${friendDisplayName || row.friend_name || "Your friend"} came in and redeemed their free week — as a thank you, we just added another 7 days to YOUR free week! Now runs through ${pretty}.`,
        );
        if (!send.ok) console.error("[referrerReward] sms failed", send.error);

        return { status: "extended", new_end: newEnd, own_referral_id: own.id };
      }
    }

    await db
      .from("referrals")
      .update({ referrer_reward_status: "no_active_window" })
      .eq("id", row.id);
    return { status: "no_active_window" };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[referrerReward] failed", error);
    return { status: "error", error };
  }
}
