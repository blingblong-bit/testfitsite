import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, X, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { confirmFreeWeekArrival, rejectFreeWeekArrival } from "@/lib/referrals";

export const Route = createFileRoute("/_authenticated/admin/free-week-arrivals")({
  head: () => ({
    meta: [
      { title: "Free Week Arrivals — Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminFreeWeekArrivals,
});

type ArrivalRow = {
  id: string;
  referral_code: string;
  redeemed_by: string | null;
  friend_contact: string | null;
  friend_email: string | null;
  referrer_name: string;
  created_at: string;
};

const POLL_MS = 5000;

function AdminFreeWeekArrivals() {
  const [rows, setRows] = useState<ArrivalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const confirm = useServerFn(confirmFreeWeekArrival);
  const reject = useServerFn(rejectFreeWeekArrival);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("referrals")
      .select("id, referral_code, redeemed_by, friend_contact, friend_email, referrer_name, created_at")
      .eq("promo_type", "free_week")
      .eq("status", "arrival_pending")
      .order("created_at", { ascending: true });
    if (!error && data) setRows(data as ArrivalRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  async function handleConfirm(id: string) {
    setActingOn(id);
    const result = await confirm({ data: { referral_id: id } });
    setActingOn(null);
    if (!result.ok) return toast.error(result.error);
    toast.success("Confirmed — free week activated");
    load();
  }

  async function handleReject(id: string) {
    setActingOn(id);
    const result = await reject({ data: { referral_id: id } });
    setActingOn(null);
    if (!result.ok) return toast.error(result.error);
    toast.success("Sent back — code can be used again");
    load();
  }

  function waitingLabel(iso: string): string {
    const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 60) return `${mins} min`;
    const hours = Math.round(mins / 60);
    if (hours < 48) return `${hours} hr`;
    return `${Math.round(hours / 24)} days`;
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

        <h1 className="text-3xl mb-2">Free Week Arrivals</h1>
        <p className="text-sm text-muted-foreground mb-6">
          People who claimed a free week online and were told to come to the front desk.
          Updates automatically every {POLL_MS / 1000}s.
        </p>

        <div className="mb-8 rounded-lg border border-primary/40 bg-primary/5 p-4 text-sm">
          Confirming activates their 7-day access. Don't forget to also create their Antaris
          membership record.
        </div>

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
                className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-lg font-semibold">{r.redeemed_by ?? "(no name)"}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.friend_contact ?? "no phone"}
                    {r.friend_email ? ` • ${r.friend_email}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Code {r.referral_code} • referred by {r.referrer_name} • waiting{" "}
                    {waitingLabel(r.created_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleConfirm(r.id)}
                    disabled={actingOn === r.id}
                    className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" /> Confirm — They're Here
                  </button>
                  <button
                    onClick={() => handleReject(r.id)}
                    disabled={actingOn === r.id}
                    className="inline-flex h-11 items-center gap-2 rounded-md border border-destructive/40 px-5 text-sm font-bold uppercase tracking-wide text-destructive hover:bg-destructive/10 disabled:opacity-60"
                  >
                    <X className="h-4 w-4" /> Not Actually Here
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
