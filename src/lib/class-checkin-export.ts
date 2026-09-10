import { supabase } from "@/integrations/supabase/client";
import {
  chicagoDateOf,
  chicagoMonthRange,
  chicagoTimeOf,
} from "@/lib/chicago-time";
import { DAYS, type DayOfWeek } from "@/lib/class-schedule";

export type ExportRow = {
  date: string;
  weekday: DayOfWeek;
  class_name: string;
  class_time: string;
  name: string;
  phone: string;
  checked_in_at_local: string;
  verified: boolean;
  added_manually: boolean;
  notes: string;
};

export type MonthExport = {
  month: string;
  rows: ExportRow[];
  dates: string[];
};

function timeToMinutes(time: string): number {
  const m = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return 9999;
  let hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  if (m[3].toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (m[3].toUpperCase() === "AM" && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function weekdayOf(isoDate: string): DayOfWeek {
  const d = new Date(isoDate + "T12:00:00");
  return DAYS[d.getDay()];
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "Sep 2" — short day label for roster headers. */
function dayLabel(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Load a full Chicago month of check-ins, pre-sorted by date, class time, name. */
export async function fetchMonthExport(month: string): Promise<MonthExport> {
  const { start, end } = chicagoMonthRange(month);
  const { data, error } = await supabase
    .from("class_checkins")
    .select("*")
    .gte("checked_in_at", start)
    .lte("checked_in_at", end)
    .order("checked_in_at", { ascending: true });

  if (error) throw new Error(error.message);

  const rows: ExportRow[] = (data ?? []).map((r) => {
    const date = chicagoDateOf(r.checked_in_at);
    return {
      date,
      weekday: weekdayOf(date),
      class_name: r.class_name,
      class_time: r.class_time,
      name: r.name,
      phone: r.phone,
      checked_in_at_local: chicagoTimeOf(r.checked_in_at),
      verified: r.verified,
      added_manually: r.added_manually,
      notes: r.notes ?? "",
    };
  });

  rows.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      timeToMinutes(a.class_time) - timeToMinutes(b.class_time) ||
      a.class_name.localeCompare(b.class_name) ||
      a.name.localeCompare(b.name),
  );

  return {
    month,
    rows,
    dates: [...new Set(rows.map((r) => r.date))].sort(),
  };
}

function csvCell(value: string | number | boolean): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvLine(cells: (string | number | boolean)[]): string {
  return cells.map(csvCell).join(",");
}

/** Day-by-day roster: each day of the month followed by everyone who checked in. */
export function buildMonthCsv(data: MonthExport): string {
  const lines: string[] = [];
  lines.push(csvLine([`Class Check-Ins — ${monthLabel(data.month)}`]));

  data.dates.forEach((d) => {
    const dayRows = data.rows.filter((r) => r.date === d);
    const weekday = dayRows[0]?.weekday ?? weekdayOf(d);
    lines.push("");
    lines.push(
      csvLine([
        `${dayLabel(d)} — ${weekday} (${dayRows.length} check-in${dayRows.length === 1 ? "" : "s"})`,
      ]),
    );
    dayRows.forEach((r) =>
      lines.push(
        csvLine([
          `${r.name} — ${r.class_name} ${r.class_time} — checked in ${r.checked_in_at_local}`,
        ]),
      ),
    );
  });

  lines.push("");
  lines.push(csvLine([`Month total: ${data.rows.length} check-ins`]));

  return lines.join("\r\n");
}

function autoWidths(rows: (string | number)[][]): { wch: number }[] {
  const widths: number[] = [];
  rows.forEach((r) =>
    r.forEach((cell, i) => {
      const len = String(cell ?? "").length;
      widths[i] = Math.min(60, Math.max(widths[i] ?? 8, len + 2));
    }),
  );
  return widths.map((wch) => ({ wch }));
}

/** Single-sheet workbook: bolded day headers, each followed by that day's check-ins. */
export async function buildMonthWorkbook(data: MonthExport): Promise<Blob> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  const aoa: (string | number)[][] = [[`Class Check-Ins — ${monthLabel(data.month)}`]];
  // Row indices (0-based) of day header rows, bolded after the sheet is built.
  const headerRows: number[] = [0];

  data.dates.forEach((d) => {
    const dayRows = data.rows.filter((r) => r.date === d);
    const weekday = dayRows[0]?.weekday ?? weekdayOf(d);
    aoa.push([]);
    headerRows.push(aoa.length);
    aoa.push([
      `${dayLabel(d)} — ${weekday} (${dayRows.length} check-in${dayRows.length === 1 ? "" : "s"})`,
    ]);
    dayRows.forEach((r) =>
      aoa.push([
        r.name,
        `${r.class_name} ${r.class_time}`,
        `checked in ${r.checked_in_at_local}`,
      ]),
    );
  });

  aoa.push([]);
  aoa.push([`Month total: ${data.rows.length} check-ins`]);

  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet["!cols"] = autoWidths(aoa);
  headerRows.forEach((r) => {
    const cell = sheet[XLSX.utils.encode_cell({ r, c: 0 })];
    if (cell) cell.s = { font: { bold: true } };
  });
  XLSX.utils.book_append_sheet(wb, sheet, monthLabel(data.month).slice(0, 31));

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
