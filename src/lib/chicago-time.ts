/**
 * Helpers for working with real America/Chicago (Central) calendar days.
 *
 * Postgres reads a naive "YYYY-MM-DDT00:00:00" string as UTC, which drops
 * every record after 7pm Central out of "today". Always build query
 * boundaries with the true Chicago offset for that date.
 */

/** Chicago UTC offset for a calendar date, e.g. "-05:00" (summer) / "-06:00". */
export function chicagoOffset(isoDate: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    timeZoneName: "longOffset",
  }).formatToParts(new Date(isoDate + "T12:00:00Z"));
  const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT-6";
  const m = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return "-06:00";
  return `${m[1]}${m[2].padStart(2, "0")}:${m[3] ?? "00"}`;
}

/** Start/end timestamps covering the full Chicago day for `isoDate`. */
export function chicagoDayRange(isoDate: string): { start: string; end: string } {
  const off = chicagoOffset(isoDate);
  return {
    start: `${isoDate}T00:00:00.000${off}`,
    end: `${isoDate}T23:59:59.999${off}`,
  };
}

/** Start/end timestamps covering a full Chicago month, given "YYYY-MM". */
export function chicagoMonthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const first = `${month}-01`;
  const last = `${month}-${String(lastDay).padStart(2, "0")}`;
  return {
    start: chicagoDayRange(first).start,
    end: chicagoDayRange(last).end,
  };
}

/** The Chicago calendar date (YYYY-MM-DD) for an instant. */
export function chicagoDateOf(instant: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof instant === "string" ? new Date(instant) : instant);
}

/** Clock time in Chicago for an instant, e.g. "6:18 PM". */
export function chicagoTimeOf(instant: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
  }).format(typeof instant === "string" ? new Date(instant) : instant);
}

/** Current Chicago calendar date (YYYY-MM-DD). */
export function todayChicago(): string {
  return chicagoDateOf(new Date());
}

/** Current Chicago month (YYYY-MM). */
export function currentMonthChicago(): string {
  return todayChicago().slice(0, 7);
}
