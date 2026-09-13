import { useEffect, useState } from "react";
import { PhoneMissed, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  id: string;
  created_at: string;
  phone: string;
  lead_id: string | null;
  status: string | null;
  delivery_status: string | null;
  error_code: string | null;
  body: string;
};

type LeadInfo = { id: string; name: string; crm_status: string | null; created_at: string };

function formatChicago(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function prettyPhone(raw: string): string {
  const d = (raw ?? "").replace(/\D/g, "").slice(-10);
  if (d.length !== 10) return raw;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function deliveryLabel(r: Row): { text: string; tone: string } {
  const ds = (r.delivery_status ?? "").toLowerCase();
  if (r.status === "failed" || ds === "undelivered" || ds === "failed") {
    return {
      text: r.error_code ? `Text failed (${r.error_code})` : "Text failed",
      tone: "border-destructive text-destructive",
    };
  }
  if (ds === "delivered") return { text: "Text delivered", tone: "border-border text-foreground" };
  return { text: "Text sent", tone: "border-border text-muted-foreground" };
}

export function MissedCallsView() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [leads, setLeads] = useState<Record<string, LeadInfo>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("sms_conversation_log")
      .select("id, created_at, phone, lead_id, status, delivery_status, error_code, body")
      .eq("metadata->>kind", "missed_call")
      .order("created_at", { ascending: false })
      .limit(500);
    if (err) {
      setError(err.message);
      setRows([]);
      setLoading(false);
      return;
    }
    const list = (data ?? []) as Row[];
    setRows(list);

    const ids = Array.from(new Set(list.map((r) => r.lead_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: leadRows } = await supabase
        .from("leads")
        .select("id, name, crm_status, created_at")
        .in("id", ids);
      const map: Record<string, LeadInfo> = {};
      for (const l of (leadRows ?? []) as LeadInfo[]) map[l.id] = l;
      setLeads(map);
    } else {
      setLeads({});
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <PhoneMissed className="h-5 w-5 text-primary" /> Missed Calls
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every caller who reached our texting line without being answered, and whether they
            landed in the Lead Tracker.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm hover:bg-secondary disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {error && (
        <div className="mt-6 rounded-md border border-destructive bg-destructive/10 p-4 text-sm">
          {error}
        </div>
      )}

      {rows === null && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}

      {rows !== null && rows.length === 0 && (
        <div className="mt-6 rounded-md border border-border p-6 text-sm text-muted-foreground">
          No missed calls yet. Callers only show up here once the gym's main line forwards
          unanswered calls to our texting number.
        </div>
      )}

      {rows !== null && rows.length > 0 && (
        <div className="mt-6 space-y-3">
          {rows.map((r) => {
            const lead = r.lead_id ? leads[r.lead_id] : undefined;
            const isNewRecord =
              lead && Math.abs(+new Date(lead.created_at) - +new Date(r.created_at)) < 120_000;
            const d = deliveryLabel(r);
            return (
              <div key={r.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="font-semibold">{prettyPhone(r.phone)}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatChicago(r.created_at)}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wider ${d.tone}`}
                  >
                    {d.text}
                  </span>
                  {lead ? (
                    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] uppercase tracking-wider">
                      {isNewRecord ? "New record created" : "Matched existing lead"}
                    </span>
                  ) : (
                    <span className="rounded-full border border-destructive px-2 py-0.5 text-[11px] uppercase tracking-wider text-destructive">
                      Not in Lead Tracker
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm">
                  {lead ? (
                    <>
                      <span className="font-medium">{lead.name}</span>
                      {lead.crm_status ? (
                        <span className="text-muted-foreground"> — {lead.crm_status}</span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      No lead record is linked to this call.
                    </span>
                  )}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">{r.body}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
