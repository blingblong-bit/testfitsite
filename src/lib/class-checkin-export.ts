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

export type CanceledRow = {
  date: string;
  class_name: string;
  reason: string;
};

export type MonthExport = {
  month: string;
  rows: ExportRow[];
  canceled: CanceledRow[];
  classTotals: { class_name: string; count: number }[];
  dates: string[];
  classNames: string[];
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

/** Load a full Chicago month of check-ins plus cancellations, pre-sorted. */
export async function fetchMonthExport(month: string): Promise<MonthExport> {
  const { start, end } = chicagoMonthRange(month);
  const [ci, cs] = await Promise.all([
    supabase
      .from("class_checkins")
      .select("*")
      .gte("checked_in_at", start)
      .lte("checked_in_at", end)
      .order("checked_in_at", { ascending: true }),
    supabase
      .from("class_sessions")
      .select("session_date, class_name, canceled_reason, status")
      .gte("session_date", `${month}-01`)
      .lte("session_date", `${month}-31`)
      .eq("status", "canceled"),
  ]);

  if (ci.error) throw new Error(ci.error.message);

  const rows: ExportRow[] = (ci.data ?? []).map((r) => {
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

  const totals = new Map<string, number>();
  rows.forEach((r) => totals.set(r.class_name, (totals.get(r.class_name) ?? 0) + 1));

  return {
    month,
    rows,
    canceled: (cs.data ?? []).map((c) => ({
      date: c.session_date,
      class_name: c.class_name,
      reason: c.canceled_reason ?? "",
    })),
    classTotals: [...totals.entries()]
      .map(([class_name, count]) => ({ class_name, count }))
      .sort((a, b) => b.count - a.count || a.class_name.localeCompare(b.class_name)),
    dates: [...new Set(rows.map((r) => r.date))].sort(),
    classNames: [...totals.keys()].sort(),
  };
}

function csvCell(value: string | number | boolean): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvLine(cells: (string | number | boolean)[]): string {
  return cells.map(csvCell).join(",");
}

export function buildMonthCsv(data: MonthExport): string {
  const lines: string[] = [];
  lines.push(csvLine([`Class Check-Ins — ${monthLabel(data.month)}`]));
  lines.push("");
  lines.push(
    csvLine([
      "Date",
      "Weekday",
      "Class",
      "Class Time",
      "Checked In",
      "Name",
      "Phone",
      "Verified",
      "Added Manually",
      "Notes",
    ]),
  );
  data.rows.forEach((r) =>
    lines.push(
      csvLine([
        r.date,
        r.weekday,
        r.class_name,
        r.class_time,
        r.checked_in_at_local,
        r.name,
        r.phone,
        r.verified ? "Yes" : "No",
        r.added_manually ? "Yes" : "No",
        r.notes,
      ]),
    ),
  );

  lines.push("");
  lines.push(csvLine(["Monthly totals per class"]));
  lines.push(csvLine(["Class", "Check-Ins"]));
  data.classTotals.forEach((t) => lines.push(csvLine([t.class_name, t.count])));
  lines.push(csvLine(["TOTAL", data.rows.length]));

  lines.push("");
  lines.push(csvLine(["Totals per class per date"]));
  lines.push(csvLine(["Date", "Weekday", "Class", "Class Time", "Check-Ins"]));
  const perDate = new Map<string, Map<string, ExportRow[]>>();
  data.rows.forEach((r) => {
    const byClass = perDate.get(r.date) ?? new Map<string, ExportRow[]>();
    const key = `${r.class_name} @ ${r.class_time}`;
    byClass.set(key, [...(byClass.get(key) ?? []), r]);
    perDate.set(r.date, byClass);
  });
  data.dates.forEach((d) => {
    const byClass = perDate.get(d);
    if (!byClass) return;
    [...byClass.values()].forEach((group) => {
      const first = group[0];
      lines.push(
        csvLine([d, first.weekday, first.class_name, first.class_time, group.length]),
      );
    });
  });

  if (data.canceled.length) {
    lines.push("");
    lines.push(csvLine(["Canceled classes"]));
    lines.push(csvLine(["Date", "Class", "Reason"]));
    data.canceled.forEach((c) => lines.push(csvLine([c.date, c.class_name, c.reason])));
  }

  return lines.join("\r\n");
}

function autoWidths(rows: (string | number)[][]): { wch: number }[] {
  const widths: number[] = [];
  rows.forEach((r) =>
    r.forEach((cell, i) => {
      const len = String(cell ?? "").length;
      widths[i] = Math.min(40, Math.max(widths[i] ?? 8, len + 2));
    }),
  );
  return widths.map((wch) => ({ wch }));
}

/** Build the grouped monthly workbook (Summary sheet + one sheet per date). */
export async function buildMonthWorkbook(data: MonthExport): Promise<Blob> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  // ---- Summary sheet ----
  const summary: (string | number)[][] = [
    [`Class Check-Ins — ${monthLabel(data.month)}`],
    [],
    ["Total check-ins", data.rows.length],
    ["Days with check-ins", data.dates.length],
    [],
    ["Totals per class"],
    ["Class", "Check-Ins"],
    ...data.classTotals.map((t) => [t.class_name, t.count] as (string | number)[]),
    [],
    ["Attendance by date and class"],
    ["Date", "Weekday", ...data.classNames, "Day Total"],
  ];

  data.dates.forEach((d) => {
    const dayRows = data.rows.filter((r) => r.date === d);
    summary.push([
      d,
      dayRows[0]?.weekday ?? weekdayOf(d),
      ...data.classNames.map(
        (cn) => dayRows.filter((r) => r.class_name === cn).length,
      ),
      dayRows.length,
    ]);
  });
  summary.push([
    "TOTAL",
    "",
    ...data.classNames.map((cn) => data.rows.filter((r) => r.class_name === cn).length),
    data.rows.length,
  ]);

  if (data.canceled.length) {
    summary.push([], ["Canceled classes"], ["Date", "Class", "Reason"]);
    data.canceled.forEach((c) => summary.push([c.date, c.class_name, c.reason]));
  }

  const summarySheet = XLSX.utils.aoa_to_sheet(summary);
  summarySheet["!cols"] = autoWidths(summary);
  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

  // ---- One sheet per date, grouped by class ----
  data.dates.forEach((d) => {
    const dayRows = data.rows.filter((r) => r.date === d);
    const weekday = dayRows[0]?.weekday ?? weekdayOf(d);
    const aoa: (string | number)[][] = [
      [`${d} — ${weekday}`],
      [`${dayRows.length} check-in${dayRows.length === 1 ? "" : "s"}`],
    ];

    const groups = new Map<string, ExportRow[]>();
    dayRows.forEach((r) => {
      const key = `${r.class_time}|${r.class_name}`;
      groups.set(key, [...(groups.get(key) ?? []), r]);
    });

    [...groups.entries()]
      .sort(
        (a, b) =>
          timeToMinutes(a[1][0].class_time) - timeToMinutes(b[1][0].class_time) ||
          a[1][0].class_name.localeCompare(b[1][0].class_name),
      )
      .forEach(([, group]) => {
        const head = group[0];
        aoa.push([]);
        aoa.push([
          `${head.class_name} — ${head.class_time}`,
          `${group.length} checked in`,
        ]);
        aoa.push(["Name", "Phone", "Checked In", "Verified", "Manual", "Notes"]);
        group.forEach((r) =>
          aoa.push([
            r.name,
            r.phone,
            r.checked_in_at_local,
            r.verified ? "Yes" : "No",
            r.added_manually ? "Yes" : "No",
            r.notes,
          ]),
        );
      });

    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    sheet["!cols"] = autoWidths(aoa);
    // Sheet names are capped at 31 chars: "2026-09-02 Wed" fits comfortably.
    XLSX.utils.book_append_sheet(wb, sheet, `${d} ${weekday.slice(0, 3)}`);
  });

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
