import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Send, Users } from "lucide-react";
import {
  previewReengagementCampaign,
  sendReengagementCampaign,
} from "@/lib/reengagement-campaign.functions";

export const Route = createFileRoute("/_authenticated/admin/reengagement")({
  head: () => ({
    meta: [
      { title: "Re-Engagement Campaign — FIT Beyond Plus" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReengagementPage,
  errorComponent: () => (
    <div className="container-page py-16">Something went wrong loading this page.</div>
  ),
  notFoundComponent: () => <div className="container-page py-16">Not found.</div>,
});

function ReengagementPage() {
  const preview = useServerFn(previewReengagementCampaign);
  const send = useServerFn(sendReengagementCampaign);
  const [armed, setArmed] = useState(false);

  const previewMut = useMutation({
    mutationFn: async () => preview(),
    onError: (e: Error) => toast.error(e.message),
  });

  const sendMut = useMutation({
    mutationFn: async () => send({ data: { confirm: "SEND" } }),
    onSuccess: (r) => {
      if (!r.ok) toast.error(r.error);
      else toast.success(`Sent ${r.sent} of ${r.attempted} messages`);
      setArmed(false);
      previewMut.mutate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = previewMut.data;

  return (
    <section className="container-page py-12">
      <Link to="/staff-home" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Staff Portal
      </Link>

      <h1 className="mt-6 text-3xl">Re-Engagement Campaigns</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Reconnect with high-priority leads who haven't converted, don't have a tour scheduled,
        and are still eligible for SMS. Nothing sends until you press "Send Campaign". Anyone who
        already received this specific campaign is permanently excluded from it.
      </p>
      <p className="mt-2 max-w-2xl text-xs text-muted-foreground">
        Current campaign: <span className="text-foreground">Free Week</span> (free_week_reactivation) ·
        7-day contact cooldown applies.
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
            <Send className="h-4 w-4" /> Send Campaign ({data.count})
          </button>
        )}

        {armed && (
          <div className="flex items-center gap-3 rounded-md border border-primary/50 bg-primary/5 px-4 py-2">
            <span className="text-sm">Send to {data?.count} people now?</span>
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
            <span className="text-2xl">{data.count}</span> lead{data.count === 1 ? "" : "s"} qualify.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Skipped — not high priority: {data.skipped.not_high_priority} · contacted in last 7 days:{" "}
            {data.skipped.recently_contacted} · tour scheduled: {data.skipped.tour_scheduled} ·
            already in this campaign: {data.skipped.already_campaigned} · duplicate phone:{" "}
            {data.skipped.duplicate_phone} · test/staff numbers: {data.skipped.excluded_number} ·
            invalid phone: {data.skipped.invalid_phone} · joined/lost: {data.skipped.closed_status}
          </p>

          {data.recipients.length > 0 && (
            <div className="mt-6 overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Last Contact</th>
                    <th className="px-4 py-3">Days Since</th>
                    <th className="px-4 py-3">CRM Status</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Tour</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recipients.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-4 py-3">{r.name}</td>
                      <td className="px-4 py-3">{r.phone}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.source ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {r.last_contacted_at
                          ? new Date(r.last_contacted_at).toLocaleDateString()
                          : "Never"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {r.days_since_contact ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.crm_status}</td>
                      <td className="px-4 py-3 uppercase">{r.priority}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.tour_status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.recipients[0] && (
            <div className="mt-6 max-w-xl rounded-xl border border-border bg-card p-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Message preview
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm">{data.recipients[0].message}</p>
            </div>
          )}
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
                {r.name} ({r.phone}) — {r.ok ? "sent" : `failed: ${r.error}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
