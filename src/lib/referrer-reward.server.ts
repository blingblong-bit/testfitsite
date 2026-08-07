import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { last10, sendPromoSms } from "./sms.server";

type Db = SupabaseClient<Database>;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * referrals.referrer_reward_status state model (free_week only):
 *   null                → not evaluated yet
 *   "skipped_self"      → self-claim, no referrer to reward
 *   "no_referrer"       → no usable referrer phone on the row
 *   "pending"           → reward EARNED, referrer hasn't activated their own
 *                         week yet; applied the moment they do
 *   "extended"          → +7 days applied (terminal, never re-applied)
 */
export type RewardResult =
  | { status: "skipped_self" }
  | { status: "already_processed" }
  | { status: "extended"; new_end: string; own_referral_id: string }
  | { status: "pending" }
  | { status: "no_referrer" }
  | { status: "error"; error: string };

function prettyDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "long",
    day: "numeric",
  });
}

/**
 * Atomically claims the reward for a referral row so a double-click or a
 * retried request can never pay the same referral twice. Returns true only
 * for the caller that won the claim.
 */
async function claimReward(db: Db, referralId: string): Promise<boolean> {
  const fresh = await db
    .from("referrals")
    .update({ referrer_reward_status: "processing" })
    .eq("id", referralId)
    .is("referrer_reward_status", null)
    .select("id");
  if ((fresh.data ?? []).length > 0) return true;

  // Legacy rows written before the pending model existed are still owed
  // their reward — allow exactly one upgrade out of that dead-end state.
  const legacy = await db
    .from("referrals")
    .update({ referrer_reward_status: "processing" })
    .eq("id", referralId)
    .eq("referrer_reward_status", "no_active_window")
    .select("id");
  return (legacy.data ?? []).length > 0;
}

async function findOwnActiveRecord(
  db: Db,
  referrerPhone: string,
): Promise<{ id: string; access_ends_at: string | null } | null> {
  const target = last10(referrerPhone);
  if (target.length !== 10) return null;
  const { data } = await db
    .from("referrals")
    .select("id, friend_contact, access_ends_at")
    .eq("promo_type", "free_week")
    .eq("status", "redeemed")
    .order("access_ends_at", { ascending: false, nullsFirst: false })
    .limit(500);
  const own = (data ?? []).find((r) => last10(r.friend_contact) === target);
  return own ? { id: own.id, access_ends_at: own.access_ends_at } : null;
}

/**
 * Called when a referred friend's arrival is confirmed. Extends the
 * referrer's own free week by 7 days if it's already active, otherwise
 * records the reward as pending so it is applied when they activate.
 * Never allowed to fail the friend's arrival confirmation.
 */
export async function applyReferrerReward(
  db: Db,
  row: {
    id: string;
    referrer_contact: string | null;
    friend_name: string | null;
    is_self_referral?: boolean | null;
    lead_id?: string | null;
  },
  friendDisplayName: string,
): Promise<RewardResult> {
  if (row.is_self_referral) {
    await db
      .from("referrals")
      .update({ referrer_reward_status: "skipped_self" })
      .eq("id", row.id)
      .is("referrer_reward_status", null);
    return { status: "skipped_self" };
  }

  try {
    const referrerPhone = row.referrer_contact ?? "";
    if (last10(referrerPhone).length !== 10) {
      await db
        .from("referrals")
        .update({ referrer_reward_status: "no_referrer" })
        .eq("id", row.id)
        .is("referrer_reward_status", null);
      return { status: "no_referrer" };
    }

    if (!(await claimReward(db, row.id))) return { status: "already_processed" };

    const own = await findOwnActiveRecord(db, referrerPhone);
    const friendLabel = friendDisplayName || row.friend_name || "Your friend";

    if (!own) {
      // Reward is legitimately earned — the referrer just hasn't come in
      // yet. Hold it; applyPendingRewardsForPhone pays it on activation.
      await db
        .from("referrals")
        .update({ referrer_reward_status: "pending" })
        .eq("id", row.id);

      const send = await sendPromoSms(
        referrerPhone,
        `Nice work! ${friendLabel} just came in and activated their free week at FIT Beyond Plus — you've earned an extra 7 days. Come activate your own free week and we'll add it on right away.`,
        { kind: "free_week_reward_pending", sentBy: "free_week_promo", db },
      );
      if (!send.ok) console.error("[referrerReward] pending sms failed", send.error);

      return { status: "pending" };
    }

    const base = Math.max(
      own.access_ends_at ? new Date(own.access_ends_at).getTime() : 0,
      Date.now(),
    );
    const newEnd = new Date(base + WEEK_MS).toISOString();

    await db.from("referrals").update({ access_ends_at: newEnd }).eq("id", own.id);
    await db.from("referrals").update({ referrer_reward_status: "extended" }).eq("id", row.id);

    const send = await sendPromoSms(
      referrerPhone,
      `Hey! ${friendLabel} came in and activated their free week — as a thank you, we just added another 7 days to YOUR free week! Now runs through ${prettyDate(newEnd)}.`,
      { kind: "free_week_reward_extended", sentBy: "free_week_promo", db },
    );
    if (!send.ok) console.error("[referrerReward] sms failed", send.error);

    return { status: "extended", new_end: newEnd, own_referral_id: own.id };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[referrerReward] failed", error);
    return { status: "error", error };
  }
}

/**
 * Called right after someone's OWN free week is activated: pays out every
 * reward they earned while they hadn't arrived yet. Each pending row is
 * claimed with a conditional update, so concurrent activations/retries can
 * never count the same referral twice.
 */
export async function applyPendingRewardsForPhone(
  db: Db,
  args: { ownReferralId: string; phone: string | null; leadId?: string | null },
): Promise<{ applied: number; new_end?: string }> {
  const target = last10(args.phone);
  if (target.length !== 10) return { applied: 0 };

  try {
    // "no_active_window" is the legacy pre-pending state — those rewards
    // were earned too, so they're eligible for payout as well.
    const { data: candidates } = await db
      .from("referrals")
      .select("id, referrer_contact, friend_name, referrer_reward_status")
      .eq("promo_type", "free_week")
      .in("referrer_reward_status", ["pending", "no_active_window"])
      .limit(500);

    const mine = (candidates ?? []).filter(
      (r) => last10(r.referrer_contact) === target && r.id !== args.ownReferralId,
    );
    if (mine.length === 0) return { applied: 0 };

    let applied = 0;
    for (const r of mine) {
      const { data: claimed } = await db
        .from("referrals")
        .update({ referrer_reward_status: "extended" })
        .eq("id", r.id)
        .eq("referrer_reward_status", r.referrer_reward_status ?? "pending")
        .select("id");
      if ((claimed ?? []).length > 0) applied += 1;
    }
    if (applied === 0) return { applied: 0 };

    const { data: own } = await db
      .from("referrals")
      .select("access_ends_at")
      .eq("id", args.ownReferralId)
      .maybeSingle();

    const base = Math.max(
      own?.access_ends_at ? new Date(own.access_ends_at).getTime() : 0,
      Date.now(),
    );
    const newEnd = new Date(base + applied * WEEK_MS).toISOString();
    await db.from("referrals").update({ access_ends_at: newEnd }).eq("id", args.ownReferralId);

    const send = await sendPromoSms(
      args.phone ?? "",
      `Thanks for sending friends our way! We applied ${applied === 1 ? "your referral reward" : `${applied} referral rewards`} (+${applied * 7} days) on top of your free week at FIT Beyond Plus — your access now runs through ${prettyDate(newEnd)}.`,
      {
        kind: "free_week_reward_applied",
        sentBy: "free_week_promo",
        db,
        leadId: args.leadId ?? null,
      },
    );
    if (!send.ok) console.error("[referrerReward] pending payout sms failed", send.error);

    return { applied, new_end: newEnd };
  } catch (e) {
    console.error(
      "[referrerReward] pending payout failed",
      e instanceof Error ? e.message : e,
    );
    return { applied: 0 };
  }
}
