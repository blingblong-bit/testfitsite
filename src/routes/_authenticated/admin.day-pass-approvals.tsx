import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, X, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { approveDayPassPending, rejectDayPassPending } from "@/lib/process-day-pass-checkin.functions";

export const Route = createFileRoute("/_authenticated/admin/day-pass-approvals")({
  head: () => ({
    meta: [
      { title: "Day Pass Approvals — Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDayPassApprovals,
});

type PendingRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  requested_at: string;
  status: "pending" | "approved" | "rejected";
};

const POLL_MS = 5000;

function AdminDayPassApprovals() {
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const approve = useServerFn(approveDayPassPending);
  const reject = useServerFn(rejectDayPassPending);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("day_pass_pending_checkins")
      .select("id, name, email, phone, requested_at, status")
      .eq("status", "pending")
      .order("requested_at", { ascending: true });
    if (!error && data) setRows(data as PendingRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  async function handleApprove(id: string) {
    setActingOn(id);
    const result = await approve({ data: { pending_id: id } });
    setActingOn(null);
    if (!result.ok) return toast.error(result.error);
    toast.success("Approved — checked in");
    load();
  }

  async function handleReject(id: string) {
    setActingOn(id);
    const result = await reject({ data: { pending_id: id } });
    setActingOn(null);
    if (!result.ok) return toast.error(result.error);
    toast.success("Request declined");
    load();
  }

  function minutesAgo(iso: string): number {
    return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container-page py-8">
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/admin/leads"
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

        <h1 className="text-3xl mb-2">Day Pass Approvals</h1>
        <p className="text-sm text-muted-foreground mb-8">
          People waiting to have their front-desk payment confirmed. Updates automatically
          every {POLL_MS / 1000}s.
        </p>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
            No one waiting right now.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-5"
              >
                <div>
                  <p className="text-lg font-semibold">{r.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.phone} • {r.email}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Requested {minutesAgo(r.requested_at)} min ago
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(r.id)}
                    disabled={actingOn === r.id}
                    className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" /> Approve
                  </button>
                  <button
                    onClick={() => handleReject(r.id)}
                    disabled={actingOn === r.id}
                    className="inline-flex h-11 items-center gap-2 rounded-md border border-destructive/40 px-5 text-sm font-bold uppercase tracking-wide text-destructive hover:bg-destructive/10 disabled:opacity-60"
                  >
                    <X className="h-4 w-4" /> Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
