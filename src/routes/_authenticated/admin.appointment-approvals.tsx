import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, X, Clock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  approveAppointment,
  suggestAlternativeAppointment,
  declineAppointment,
  getAvailableSlotsFn,
} from "@/lib/appointments.functions";
import {
  formatChicagoDateTime,
  formatChicagoTime,
  formatChicagoDate,
  upcomingDates,
  chicagoDateISO,
} from "@/lib/appointment-availability";

export const Route = createFileRoute(
  "/_authenticated/admin/appointment-approvals",
)({
  head: () => ({
    meta: [
      { title: "Appointment Approvals — Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAppointmentApprovals,
});

type Row = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  requested_time: string;
  suggested_time: string | null;
  status: "pending" | "alternative_suggested";
  created_at: string;
};

const POLL_MS = 5000;

function AdminAppointmentApprovals() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState<Row | null>(null);

  const approve = useServerFn(approveAppointment);
  const suggest = useServerFn(suggestAlternativeAppointment);
  const decline = useServerFn(declineAppointment);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("appointments")
      .select("id, name, phone, email, requested_time, suggested_time, status, created_at")
      .in("status", ["pending", "alternative_suggested"])
      .order("requested_time", { ascending: true });
    if (!error && data) setRows(data as Row[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  async function handleApprove(id: string) {
    setActingOn(id);
    const result = await approve({ data: { appointment_id: id } });
    setActingOn(null);
    if (!result.ok) return toast.error(result.error);
    toast.success("Confirmed — customer notified");
    load();
  }

  async function handleDecline(id: string) {
    setActingOn(id);
    const result = await decline({ data: { appointment_id: id } });
    setActingOn(null);
    if (!result.ok) return toast.error(result.error);
    toast.success("Declined");
    load();
  }

  async function handleSuggest(row: Row, iso: string) {
    setActingOn(row.id);
    const result = await suggest({
      data: { appointment_id: row.id, suggested_time: iso },
    });
    setActingOn(null);
    if (!result.ok) return toast.error(result.error);
    toast.success("Alternative sent");
    setSuggesting(null);
    load();
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container-page py-8">
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/staff-home"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm hover:bg-secondary"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <button
            onClick={load}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm hover:bg-secondary"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        <h1 className="text-3xl mb-2">Appointment Approvals</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Pending visit requests. Auto-refreshes every {POLL_MS / 1000}s.
        </p>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
            No pending requests.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-border bg-card p-5"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold">{r.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {r.phone} {r.email ? `• ${r.email}` : ""}
                    </p>
                    <p className="mt-2 text-sm">
                      Requested:{" "}
                      <strong>{formatChicagoDateTime(r.requested_time)}</strong>
                    </p>
                    {r.suggested_time && (
                      <p className="mt-1 text-sm text-primary">
                        Alt suggested: {formatChicagoDateTime(r.suggested_time)}{" "}
                        (waiting on reply)
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Status: {r.status}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleApprove(r.id)}
                      disabled={actingOn === r.id}
                      className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-60"
                    >
                      <Check className="h-4 w-4" /> Approve
                    </button>
                    <button
                      onClick={() =>
                        setSuggesting(suggesting?.id === r.id ? null : r)
                      }
                      disabled={actingOn === r.id}
                      className="inline-flex h-11 items-center gap-2 rounded-md border border-border px-5 text-sm font-bold uppercase tracking-wide disabled:opacity-60"
                    >
                      <Clock className="h-4 w-4" /> Suggest alt
                    </button>
                    <button
                      onClick={() => handleDecline(r.id)}
                      disabled={actingOn === r.id}
                      className="inline-flex h-11 items-center gap-2 rounded-md border border-destructive/40 px-5 text-sm font-bold uppercase tracking-wide text-destructive hover:bg-destructive/10 disabled:opacity-60"
                    >
                      <X className="h-4 w-4" /> Decline
                    </button>
                  </div>
                </div>

                {suggesting?.id === r.id && <SuggestPicker onPick={(iso) => handleSuggest(r, iso)} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SuggestPicker({ onPick }: { onPick: (iso: string) => void }) {
  const days = upcomingDates();
  const [date, setDate] = useState(chicagoDateISO());
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const getSlots = useServerFn(getAvailableSlotsFn);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    getSlots({ data: { date } })
      .then((r) => {
        if (!cancel) setSlots(r.slots);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [date, getSlots]);

  return (
    <div className="mt-4 rounded-md border border-border bg-background p-4">
      <p className="text-sm font-semibold mb-3">Pick an alternative time</p>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
        {days.map((d) => (
          <button
            key={d}
            onClick={() => setDate(d)}
            className={`shrink-0 rounded border px-3 py-2 text-xs ${
              d === date
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50"
            }`}
          >
            {formatChicagoDate(`${d}T18:00:00Z`)}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : slots.length === 0 ? (
        <p className="text-xs text-muted-foreground">No open slots that day.</p>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {slots.map((s) => (
            <button
              key={s}
              onClick={() => onPick(s)}
              className="rounded border border-border bg-card px-2 py-2 text-xs hover:border-primary/50"
            >
              {formatChicagoTime(s)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
