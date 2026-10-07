import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/day-pass-approvals")({
  head: () => ({
    meta: [
      { title: "Day Pass Check-Ins — Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DayPassCheckins,
});

type Row = {
  id: string;
  purchased_at: string;
  payment_method: string | null;
  lead_id: string;
  leads: { name: string | null; phone: string | null; email: string | null } | null;
};

const TZ = "America/Chicago";
const POLL_MS = 15000;

function chicagoToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

function shiftDay(ymd: string, delta: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// UTC instant of Chicago midnight for a YYYY-MM-DD date (handles DST).
function chicagoMidnightUtc(ymd: string): Date {
  const guess = new Date(`${ymd}T06:00:00Z`);
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(guess),
  );
  return new Date(guess.getTime() - hour * 3600 * 1000);
}

function methodLabel(m: string | null): string {
  if (m === "venmo") return "Venmo";
  if (m === "paid_at_desk") return "Paid at desk";
  return m ?? "—";
}

function DayPassCheckins() {
  const [day, setDay] = useState(chicagoToday());
  const [rows, setRows] = useState<Row[]>([]);
  const [visits, setVisits] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const start = chicagoMidnightUtc(day).toISOString();
    const end = chicagoMidnightUtc(shiftDay(day, 1)).toISOString();
    const { data } = await supabase
      .from("day_pass_purchases")
      .select("id, purchased_at, payment_method, lead_id, leads(name, phone, email)")
      .gte("purchased_at", start)
      .lt("purchased_at", end)
      .order("purchased_at", { ascending: true });
    const list = (data ?? []) as unknown as Row[];
    setRows(list);
    const ids = [...new Set(list.map((r) => r.lead_id))];
    if (ids.length) {
      const { data: all } = await supabase
        .from("day_pass_purchases")
        .select("lead_id")
        .in("lead_id", ids)
        .lt("purchased_at", end);
      const m: Record<string, number> = {};
      for (const p of all ?? []) m[p.lead_id as string] = (m[p.lead_id as string] ?? 0) + 1;
      setVisits(m);
    } else setVisits({});
    setLoading(false);
  }, [day]);

  useEffect(() => {
    setLoading(true);
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const label = new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  });
  const isToday = day === chicagoToday();

  return (
    <div className="min-h-screen bg-background">
      <div className="container-page py-8">
        <div className="flex items-center justify-between mb-6">
          <Link to="/admin/leads" className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm hover:bg-secondary">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <button onClick={load} className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm hover:bg-secondary">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        <h1 className="text-3xl mb-2">Day Pass Check-Ins</h1>
        <p className="text-sm text-muted-foreground mb-6">Everyone who submitted the day pass form, by day.</p>

        <div className="flex items-center gap-2 mb-6">
          <button onClick={() => setDay(shiftDay(day, -1))} aria-label="Previous day" className="h-10 w-10 inline-flex items-center justify-center rounded-md border border-border hover:bg-secondary">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} className="h-10 rounded-md border border-border bg-card px-3 text-sm" />
          <button onClick={() => setDay(shiftDay(day, 1))} disabled={isToday} aria-label="Next day" className="h-10 w-10 inline-flex items-center justify-center rounded-md border border-border hover:bg-secondary disabled:opacity-40">
            <ChevronRight className="h-4 w-4" />
          </button>
          {!isToday && (
            <button onClick={() => setDay(chicagoToday())} className="h-10 rounded-md border border-border px-4 text-sm hover:bg-secondary">Today</button>
          )}
        </div>

        <p className="mb-3 text-sm"><span className="font-semibold">{label}</span> · {rows.length} day pass{rows.length === 1 ? "" : "es"}</p>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">No day passes this day.</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-widest text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="p-3">Time</th><th className="p-3">Name</th><th className="p-3">Phone</th><th className="p-3">Payment</th><th className="p-3">Visit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const n = visits[r.lead_id] ?? 1;
                  return (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="p-3 whitespace-nowrap">{new Date(r.purchased_at).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" })}</td>
                      <td className="p-3 font-semibold">{r.leads?.name ?? "—"}</td>
                      <td className="p-3">{r.leads?.phone || "—"}</td>
                      <td className="p-3">{methodLabel(r.payment_method)}</td>
                      <td className="p-3">{n > 1 ? `Returning (#${n})` : "First time"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
