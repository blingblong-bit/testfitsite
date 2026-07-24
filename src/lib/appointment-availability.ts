// Appointment scheduling config + availability helpers.
// All time math runs in America/Chicago to match the rest of the system
// (class-checkin, class-schedule, etc.).

import type { DayOfWeek } from "./class-schedule";
import { DAYS } from "./class-schedule";

export type Hours = { start: string; end: string } | null; // "HH:mm" 24h

// Booking-eligible hours (kept tighter than staffed hours so a tour never
// runs up against close). Matches the staffed hours on the contact page.
export const APPOINTMENT_HOURS: Record<DayOfWeek, Hours> = {
  Sunday: { start: "10:00", end: "17:00" },
  Monday: { start: "09:00", end: "20:00" },
  Tuesday: { start: "09:00", end: "20:00" },
  Wednesday: { start: "09:00", end: "20:00" },
  Thursday: { start: "09:00", end: "20:00" },
  Friday: { start: "09:00", end: "20:00" },
  Saturday: { start: "09:00", end: "18:00" },
};

export const SLOT_MINUTES = 30;
export const BOOKING_WINDOW_DAYS = 14;

// Chicago wall-clock helpers ---------------------------------------------

// Parts of a Date rendered in America/Chicago.
function chicagoParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "long",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    weekday: get("weekday") as DayOfWeek,
  };
}

export function dayOfWeekInChicago(d: Date): DayOfWeek {
  return chicagoParts(d).weekday;
}

// Convert a Chicago wall-clock time (Y/M/D H:M) to a UTC ISO string.
// Handles DST by picking the offset that renders back to the requested wall time.
export function chicagoWallToUTC(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): string {
  for (const off of [5, 6]) {
    const utcMs = Date.UTC(year, month - 1, day, hour + off, minute);
    const p = chicagoParts(new Date(utcMs));
    if (
      p.year === year &&
      p.month === month &&
      p.day === day &&
      p.hour === hour &&
      p.minute === minute
    ) {
      return new Date(utcMs).toISOString();
    }
  }
  return new Date(Date.UTC(year, month - 1, day, hour + 6, minute)).toISOString();
}

// "YYYY-MM-DD" for a given Date rendered in Chicago.
export function chicagoDateISO(d: Date = new Date()): string {
  const p = chicagoParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

// Parse "YYYY-MM-DD" (Chicago-local date) into y/m/d components.
export function parseDateISO(iso: string): { year: number; month: number; day: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { year: y, month: m, day: d };
}

// Format an absolute timestamp as a friendly Chicago string
// (e.g. "Tue, Jul 28 at 3:30 PM").
export function formatChicagoDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function formatChicagoTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function formatChicagoDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}

// Rolling list of the next N days as Chicago-local ISO date strings, starting today.
export function upcomingDates(days: number = BOOKING_WINDOW_DAYS): string[] {
  const out: string[] = [];
  const now = new Date();
  const nowMs = now.getTime();
  // We can't just add 24h because DST would drift; instead walk by 1-day
  // increments using Chicago-local dates.
  const startIso = chicagoDateISO(now);
  const { year, month, day } = parseDateISO(startIso);
  const baseUtc = Date.UTC(year, month - 1, day);
  for (let i = 0; i < days; i++) {
    const d = new Date(baseUtc + i * 24 * 60 * 60 * 1000);
    // Rebuild Chicago date from this UTC day midnight to avoid DST drift:
    // shift by 12h so any TZ offset lands in the same calendar day.
    const p = chicagoParts(new Date(baseUtc + i * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000));
    void d;
    void nowMs;
    out.push(`${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`);
  }
  return out;
}

// All possible slot start times (as UTC ISO strings) for a given Chicago date,
// regardless of bookings. Filters out slots already in the past.
export function slotsForDate(dateIso: string): string[] {
  const { year, month, day } = parseDateISO(dateIso);
  const probeUtcMs = Date.UTC(year, month - 1, day, 12, 0); // noon UTC → same date in Chicago
  const weekday = dayOfWeekInChicago(new Date(probeUtcMs));
  const hours = APPOINTMENT_HOURS[weekday];
  if (!hours) return [];
  const [sh, sm] = hours.start.split(":").map(Number);
  const [eh, em] = hours.end.split(":").map(Number);
  const startTotal = sh * 60 + sm;
  const endTotal = eh * 60 + em;

  const now = Date.now();
  const slots: string[] = [];
  for (let m = startTotal; m + SLOT_MINUTES <= endTotal; m += SLOT_MINUTES) {
    const hour = Math.floor(m / 60);
    const minute = m % 60;
    const iso = chicagoWallToUTC(year, month, day, hour, minute);
    // Keep at least a 30-minute buffer for near-term same-day slots.
    if (new Date(iso).getTime() > now + 30 * 60 * 1000) {
      slots.push(iso);
    }
  }
  return slots;
}

// Filter slots by removing ones already booked (confirmed_time set).
export function filterAvailable(slots: string[], takenIsoTimes: Iterable<string>): string[] {
  const taken = new Set<number>();
  for (const t of takenIsoTimes) taken.add(new Date(t).getTime());
  return slots.filter((s) => !taken.has(new Date(s).getTime()));
}
