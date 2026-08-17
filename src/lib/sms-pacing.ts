// Shared pacing rules for AUTOMATED (marketing-style) outbound SMS.
//
// Automated jobs must consult these helpers before sending so two different
// jobs can't stack texts on the same person in the same hour.
//
// Transactional texts are intentionally exempt — they must arrive immediately:
// appointment confirmations/reminders, free-week code / arrival / activation,
// referral rewards, welcome-on-join, staff-initiated manual texts, and inbound
// AI replies.
//
// The Deno edge functions (process-lead-followups, antaris-member-sync) mirror
// these constants inline because they run in a separate runtime and cannot
// import from src/. Keep the values in sync.

export const QUIET_START_HOUR = 9; // 9:00 am Chicago
export const QUIET_END_HOUR = 19; // last automated send starts before 7:00 pm

/** Minimum hours between any two automated texts to the same person, across all jobs. */
export const MIN_GAP_HOURS_AUTOMATED = 24;

/** Minimum hours between two missed-call text-backs to the same number. */
export const MIN_GAP_HOURS_MISSED_CALL = 1;

/** metadata.kind values that count as automated marketing traffic. */
export const AUTOMATED_KINDS = ["drip", "post_trial_nudge", "free_week_reactivation"];

export function chicagoHour(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  return Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
}

export function isQuietHours(now: Date = new Date()): boolean {
  const hour = chicagoHour(now);
  return hour < QUIET_START_HOUR || hour >= QUIET_END_HOUR;
}

export function last10(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "").slice(-10);
}

type MinimalClient = {
  from: (table: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    select: (cols: string) => any;
  };
};

/**
 * Timestamp of the most recent outbound message to this phone whose
 * metadata.kind is in `kinds`. Matches on last-10 digits so phone formatting
 * differences never matter.
 */
export async function lastOutboundOfKind(
  supabase: MinimalClient,
  phone: string | null | undefined,
  kinds: string[],
  lookbackHours = 96,
): Promise<string | null> {
  const digits = last10(phone);
  if (digits.length !== 10) return null;

  const sinceIso = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("sms_conversation_log")
    .select("phone, created_at, metadata")
    .eq("direction", "outbound")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error || !data) return null;

  for (const row of data as Array<{
    phone: string | null;
    created_at: string;
    metadata: Record<string, unknown> | null;
  }>) {
    if (last10(row.phone) !== digits) continue;
    const kind = (row.metadata?.["kind"] ?? "") as string;
    if (!kinds.includes(kind)) continue;
    return row.created_at;
  }
  return null;
}

/** True when a missed-call text-back was already sent to this number recently. */
export async function missedCallOnCooldown(
  supabase: MinimalClient,
  phone: string | null | undefined,
  now: Date = new Date(),
): Promise<boolean> {
  const lastIso = await lastOutboundOfKind(supabase, phone, ["missed_call"], 24);
  if (!lastIso) return false;
  const hoursSince = (now.getTime() - new Date(lastIso).getTime()) / (1000 * 60 * 60);
  return hoursSince < MIN_GAP_HOURS_MISSED_CALL;
}

/**
 * True when an automated text to this phone should be held back: either we're
 * outside 9am-7pm Chicago, or another automated job already texted them inside
 * the minimum gap.
 */
export async function automatedSendBlocked(
  supabase: MinimalClient,
  phone: string | null | undefined,
  opts: { minGapHours?: number; now?: Date } = {},
): Promise<{ blocked: boolean; reason?: string }> {
  const now = opts.now ?? new Date();
  if (isQuietHours(now)) return { blocked: true, reason: "quiet_hours" };

  const minGap = Math.max(opts.minGapHours ?? MIN_GAP_HOURS_AUTOMATED, MIN_GAP_HOURS_AUTOMATED);
  const lastIso = await lastOutboundOfKind(supabase, phone, AUTOMATED_KINDS);
  if (lastIso) {
    const hoursSince = (now.getTime() - new Date(lastIso).getTime()) / (1000 * 60 * 60);
    if (hoursSince < minGap) return { blocked: true, reason: "too_soon" };
  }
  return { blocked: false };
}
