import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sendManualSms } from "@/lib/send-manual-sms.functions";
import { isInactiveMember, formatLastVisit, chicagoDaysSince, INACTIVE_MEMBER_DAYS } from "@/lib/gym/signins";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const inactiveQuery = queryOptions({
  queryKey: ["crm", "inactive-members"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("leads")
      .select("id, name, phone, contact_type, became_member, antaris_client_id, last_visit_at, sms_opted_out, last_sms_at")
      .or("contact_type.eq.Member,became_member.eq.true")
      .order("last_visit_at", { ascending: true, nullsFirst: true })
      .limit(1000);
    if (error) throw error;
    const all = data ?? [];
    return {
      inactive: all.filter((l) => isInactiveMember(l)),
      unlinked: all.filter((l) => !l.antaris_client_id).length,
    };
  },
});

export const Route = createFileRoute("/_authenticated/crm/inactive-members")({
  head: () => ({ meta: [
    { title: "Inactive Members — FIT CRM" },
    { name: "description", content: "Active FIT members with no front-desk scan in 14 days." },
    { property: "og:title", content: "Inactive Members — FIT CRM" },
    { property: "og:description", content: "Active FIT members with no front-desk scan in 14 days." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(inactiveQuery),
  component: InactiveMembers,
});

function firstName(n: string) { return n.trim().split(/\s+/)[0] || "there"; }

function InactiveMembers() {
  const { data } = useSuspenseQuery(inactiveQuery);
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Inactive Members</h1>
        <p className="text-sm text-muted-foreground">
          Active members with no front-desk scan in {INACTIVE_MEMBER_DAYS}+ days (Chicago time). Nothing is texted automatically.
          {data.unlinked > 0 && ` ${data.unlinked} member contact(s) aren't linked to Antaris yet and are not shown.`}
        </p>
      </div>
      {data.inactive.length === 0 ? (
        <p className="text-sm text-muted-foreground">Every linked member has visited in the last {INACTIVE_MEMBER_DAYS} days.</p>
      ) : (
        <ul className="space-y-3">{data.inactive.map((m) => <MemberRow key={m.id} m={m} />)}</ul>
      )}
    </div>
  );
}

type Row = { id: string; name: string; phone: string | null; last_visit_at: string | null; sms_opted_out: boolean; last_sms_at: string | null };

function MemberRow({ m }: { m: Row }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const sendSms = useServerFn(sendManualSms);
  const [msg, setMsg] = useState(`Hey ${firstName(m.name)}, we've missed you at FIT! Everything going okay? Let us know if we can help you get back on track.`);
  const [busy, setBusy] = useState(false);
  const days = chicagoDaysSince(m.last_visit_at);

  async function send() {
    if (busy || !m.phone || !msg.trim()) return;
    setBusy(true);
    try {
      const { data: s, error } = await supabase.auth.getSession();
      if (error || !s.session) { toast.error("Your session has ended. Sign in again before sending."); return; }
      if ((s.session.expires_at ?? 0) <= Math.floor(Date.now() / 1000) + 60) {
        const { data: r, error: re } = await supabase.auth.refreshSession();
        if (re || !r.session) { toast.error("Your session has ended. Sign in again before sending."); return; }
      }
      const r = await sendSms({ data: { lead_id: m.id, phone: m.phone, message: msg.trim() } });
      if (r.ok) { toast.success("Text sent"); qc.invalidateQueries({ queryKey: ["crm", "inactive-members"] }); }
      else toast.error(r.error === "forbidden" ? "Only admins can send texts." : `Not sent: ${r.error}`);
    } catch {
      toast.error("Could not confirm the text was sent. Check the conversation before trying again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-md border border-border bg-card p-3 space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <button className="font-medium hover:text-primary text-left" onClick={() => navigate({ to: "/crm/inactive-members", search: { contact: m.id } })}>{m.name}</button>
        <span className="text-xs text-destructive">{days === null ? "No scans in the last 45 days" : `${days} days since last scan`}</span>
      </div>
      <p className="text-xs text-muted-foreground">Last visit: {formatLastVisit(m.last_visit_at)}{m.phone ? ` · ${m.phone}` : ""}</p>
      {!m.phone ? <p className="text-xs text-muted-foreground">No phone on file.</p>
        : m.sms_opted_out ? <p className="text-xs text-muted-foreground">Opted out of texts.</p>
        : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={2} className="text-sm" aria-label={`Message to ${m.name}`} />
            <Button onClick={send} disabled={busy || !msg.trim()} className="sm:self-start">{busy ? "Sending…" : "Send text"}</Button>
          </div>
        )}
    </li>
  );
}
