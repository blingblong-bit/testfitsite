// Pure helpers for gym sign-in logic (client-safe). Timestamps are stored in
// UTC; any per-day logic uses America/Chicago calendar days.
export const INACTIVE_MEMBER_DAYS = 14;

export function chicagoDayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Whole Chicago calendar days between the last visit and now. */
export function chicagoDaysSince(iso: string | null, now = new Date()): number | null {
  if (!iso) return null;
  const a = Date.parse(chicagoDayKey(new Date(iso)) + "T00:00:00Z");
  const b = Date.parse(chicagoDayKey(now) + "T00:00:00Z");
  return Math.round((b - a) / 86_400_000);
}

export function isActiveMember(l: { contact_type: string | null; became_member: boolean | null }): boolean {
  return l.contact_type === "Member" || (l.became_member === true && l.contact_type !== "Former Member");
}

/** Active member with no scan in the last 14 Chicago days (or never seen). */
export function isInactiveMember(
  l: { contact_type: string | null; became_member: boolean | null; antaris_client_id: string | null; last_visit_at: string | null },
  now = new Date(),
): boolean {
  if (!isActiveMember(l) || !l.antaris_client_id) return false;
  const d = chicagoDaysSince(l.last_visit_at, now);
  return d === null || d >= INACTIVE_MEMBER_DAYS;
}

export function formatLastVisit(iso: string | null, now = new Date()): string {
  if (!iso) return "No scans on record";
  const d = chicagoDaysSince(iso, now) ?? 0;
  const t = new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
  const rel = d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
  return `${t} (${rel})`;
}
