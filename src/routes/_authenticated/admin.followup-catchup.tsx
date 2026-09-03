import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Send, Users } from "lucide-react";
import {
  previewFollowupCatchup,
  sendFollowupCatchup,
} from "@/lib/followup-catchup.functions";

export const Route = createFileRoute("/_authenticated/admin/followup-catchup")({
  head: () => ({
    meta: [
      { title: "Follow-Up Catch-Up — FIT Beyond Plus" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CatchupPage,
  errorComponent: () => (
    <div className="container-page py-16">Something went wrong loading this page.</div>
  ),
  notFoundComponent: () => <div className="container-page py-16">Not found.</div>,
});

function CatchupPage() {
  const preview = useServerFn(previewFollowupCatchup);
  const send = useServerFn(sendFollowupCatchup);
  const [armed, setArmed] = useState(false);

  const previewMut = useMutation({
    mutationFn: async () => preview(),
    onError: (e: Error) => toast.error(e.message),
  });

  const sendMut = useMutation({
    mutationFn: async () => send({ data: { confirm: "SEND" } }),
    onSuccess: (r) => {
      if (!r.ok) toast.error(r.error === "quiet_hours" ? "Outside 9am–7pm — try again during the day." : r.error);
      else toast.success(`Sent ${r.sent} of ${r.attempted} texts`);
      setArmed(false);
      previewMut.mutate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = previewMut.data;

  return (
    <section className="container-page py-12">
      <Link
        to="/staff-home"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Staff Portal
      </Link>

      <h1 className="mt-6 text-3xl">Follow-Up Catch-Up</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Leads whose automated follow-up text is overdue — usually because texting was down. Each
        person gets exactly one text: the correct next step in their sequence, not everything they
        missed. Nothing sends until you press "Send Catch-Up".
      </p>
      <p className="mt-2 max-w-2xl text-xs text-muted-foreground">
        Guardrails still apply: 9:00am–7:00pm Central, opted-out and converted members excluded, and
        nobody who already received a text in the last 24 hours.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          onClick={() => previewMut.mutate()}
          disabled={previewMut.isPending}
          className="inline-flex h-11 items-center gap-2 rounded-md border border-border px-5 text-sm hover:bg-secondary"
        >
          <Users className="h-4 w-4" />
          {previewMut.isPending ? "Loading…" : "Preview recipients"}
        </button>

        {data && data.count > 0 && !armed && (
          <button
            onClick={() => setArmed(true)}
            className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm text-primary-foreground"
          >
            <Send className="h-4 w-4" /> Send Catch-Up ({data.count})
          </button>
        )}

        {armed && (
          <div className="flex items-center gap-3 rounded-md border border-primary/50 bg-primary/5 px-4 py-2">
            <span className="text-sm">Text {data?.count} people now?</span>
            <button
              onClick={() => sendMut.mutate()}
              disabled={sendMut.isPending}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm text-primary-foreground"
            >
              {sendMut.isPending ? "Sending…" : "Yes, send"}
            </button>
            <button
              onClick={() => setArmed(false)}
              className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {data && (
        <div className="mt-10">
          <p className="text-sm">
            <span className="text-2xl">{data.count}</span> lead{data.count === 1 ? "" : "s"} overdue.
          </p>
          {data.quiet_hours && (
            <p className="mt-2 text-xs text-destructive">
              It's outside 9:00am–7:00pm Central right now — sending is blocked until morning.
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Skipped — not due yet: {data.skipped.not_due} · texted in last 24h:{" "}
            {data.skipped.texted_recently} · sequence finished: {data.skipped.sequence_finished} ·
            joined/lost: {data.skipped.closed_status} · invalid phone: {data.skipped.invalid_phone}
          </p>

          {data.candidates.length > 0 && (
            <div className="mt-6 space-y-4">
              {data.candidates.map((c) => (
                <div key={c.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-medium">{c.name ?? "—"}</span>
                    <span className="text-muted-foreground">{c.phone}</span>
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs uppercase tracking-wider text-muted-foreground">
                      {c.step_label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      interest: {c.interest ?? "—"} · copy: {c.category}
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm">{c.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {sendMut.data && sendMut.data.ok && (
        <div className="mt-10 rounded-xl border border-border bg-card p-5">
          <p className="text-sm">
            Sent {sendMut.data.sent} · Failed {sendMut.data.failed}
          </p>
          <ul className="mt-3 space-y-1 text-xs">
            {sendMut.data.results.map((r, i) => (
              <li key={i} className={r.ok ? "text-muted-foreground" : "text-destructive"}>
                {r.name ?? "—"} ({r.phone}) {r.step} — {r.ok ? "sent" : `failed: ${r.error}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
