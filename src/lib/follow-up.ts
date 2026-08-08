// Shared follow-up date helpers. Pure + client-safe.
// The Lead Tracker priority badge treats a past `next_follow_up_date` as an
// overdue follow-up and forces HIGH PRIORITY, even when the lead was contacted
// today. So whenever we actually reach out, push a stale date forward.

const CHICAGO = "America/Chicago";

/** Today's date in America/Chicago as YYYY-MM-DD. */
export function chicagoToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CHICAGO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Today + n days in America/Chicago as YYYY-MM-DD. */
export function chicagoTodayPlus(days: number): string {
  const today = chicagoToday();
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const DEFAULT_FOLLOW_UP_DAYS = 3;

/**
 * Returns the new `next_follow_up_date` to write, or null to leave it alone.
 * Advances only when the date is missing or already in the past — a future
 * date a staff member deliberately set is preserved.
 */
export function advanceFollowUpIfStale(
  current: string | null | undefined,
  days: number = DEFAULT_FOLLOW_UP_DAYS,
): string | null {
  const today = chicagoToday();
  if (current && current >= today) return null;
  return chicagoTodayPlus(days);
}
