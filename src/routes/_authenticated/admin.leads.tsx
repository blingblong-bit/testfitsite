import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Lead = {
  id: string;
  source: string;
  name: string;
  email: string;
  phone: string | null;
  interest: string | null;
  message: string | null;
  created_at: string;
  lead_type: string;
  lead_score: number;
  should_notify: boolean;
  spam_reason: string | null;
};

type Referral = {
  id: string;
  referral_code: string;
  referrer_name: string;
  referrer_email: string | null;
  referrer_contact: string | null;
  normalized_referrer_email: string | null;
  friend_name: string;
  friend_email: string | null;
  friend_contact: string | null;
  status: string;
  email_sent: boolean;
  email_sent_at: string | null;
  email_status: "pending" | "sent" | "failed";
  redeemed_at: string | null;
  redeemed_by: string | null;
  created_at: string;
};

type TypeFilter = "customer_lead" | "vendor_solicitation" | "spam" | "all";
type Tab = "leads" | "referrals";

export const Route = createFileRoute("/_authenticated/admin/leads")({
  head: () => ({
    meta: [
      { title: "Lead Tracker — FIT Beyond Plus Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLeads,
});

function AdminLeads() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("leads");
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [referrals, setReferrals] = useState<Referral[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("customer_lead");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  async function load() {
    setError(null);
    const [{ data: leadsData, error: leadsErr }, { data: refsData, error: refsErr }] = await Promise.all([
      supabase.from("leads").select("*").order("created_at", { ascending: false }),
      supabase.from("referrals").select("*").order("created_at", { ascending: false }),
    ]);
    if (leadsErr) { setError(leadsErr.message); setLeads([]); }
    else setLeads(leadsData as Lead[]);
    if (refsErr) { if (!leadsErr) setError(refsErr.message); setReferrals([]); }
    else setReferrals(refsData as Referral[]);
  }

  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) { setIsAdmin(false); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      const admin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
      setIsAdmin(admin);
      if (admin) load();
    })();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/admin/login" });
  }

  if (isAdmin === false) {
    return (
      <section className="container-page py-20 max-w-lg">
        <p className="text-xs tracking-[0.3em] text-primary">ADMIN</p>
        <h1 className="mt-2 text-3xl">Access denied</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your account is not approved for admin access. Contact an administrator if you believe this is a mistake.
        </p>
        <div className="mt-6 flex gap-3">
          <button onClick={signOut} className="h-10 rounded-md border border-border px-4 text-sm hover:bg-secondary">Sign out</button>
          <button onClick={() => navigate({ to: "/" })} className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">Back to homepage</button>
        </div>
      </section>
    );
  }

  if (isAdmin === null) {
    return <section className="container-page py-20"><p className="text-muted-foreground">Checking access…</p></section>;
  }

  return (
    <section className="container-page py-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.3em] text-primary">ADMIN</p>
          <h1 className="mt-2 text-3xl md:text-4xl">Lead Tracker</h1>
          <p className="mt-2 text-sm text-muted-foreground">Submissions and referrals, most recent first.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/staff-home" })}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm hover:bg-secondary"
          >
            <Home className="h-4 w-4" /> Admin Homescreen
          </button>
          <button onClick={load} className="h-10 rounded-md border border-border px-4 text-sm hover:bg-secondary">Refresh</button>
          <button onClick={signOut} className="h-10 rounded-md border border-border px-4 text-sm hover:bg-secondary">Sign out</button>
        </div>
      </div>

      <div className="mt-6 flex gap-2 border-b border-border">
        <TabBtn active={tab === "leads"} onClick={() => setTab("leads")}>Leads</TabBtn>
        <TabBtn active={tab === "referrals"} onClick={() => setTab("referrals")}>Referrals</TabBtn>
      </div>

      {error && (
        <div className="mt-8 rounded-md border border-destructive bg-destructive/10 p-4 text-sm">
          {error}. You may not have admin/staff access yet — an admin must grant your account a role.
        </div>
      )}

      {tab === "leads" && (
        <LeadsView
          leads={leads}
          filter={filter}
          setFilter={setFilter}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
        />
      )}
      {tab === "referrals" && <ReferralsView referrals={referrals} />}
    </section>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "px-5 py-3 text-sm uppercase tracking-widest border-b-2 -mb-px transition " +
        (active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "h-9 rounded-full border px-4 text-xs uppercase tracking-widest transition " +
        (active ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-secondary")
      }
    >
      {children}
    </button>
  );
}

function LeadsView({
  leads, filter, setFilter, typeFilter, setTypeFilter,
}: {
  leads: Lead[] | null;
  filter: string; setFilter: (s: string) => void;
  typeFilter: TypeFilter; setTypeFilter: (t: TypeFilter) => void;
}) {
  const byType = leads?.filter((l) => typeFilter === "all" || (l.lead_type ?? "customer_lead") === typeFilter) ?? [];
  const visible = byType.filter((l) => filter === "all" || l.source === filter);
  const sources = Array.from(new Set(byType.map((l) => l.source)));
  const count = (t: TypeFilter) =>
    t === "all" ? (leads?.length ?? 0) : (leads?.filter((l) => (l.lead_type ?? "customer_lead") === t).length ?? 0);

  return (
    <>
      <div className="mt-6 flex flex-wrap gap-2">
        <FilterChip active={typeFilter === "customer_lead"} onClick={() => { setTypeFilter("customer_lead"); setFilter("all"); }}>Customer Leads ({count("customer_lead")})</FilterChip>
        <FilterChip active={typeFilter === "vendor_solicitation"} onClick={() => { setTypeFilter("vendor_solicitation"); setFilter("all"); }}>Vendor Solicitations ({count("vendor_solicitation")})</FilterChip>
        <FilterChip active={typeFilter === "spam"} onClick={() => { setTypeFilter("spam"); setFilter("all"); }}>Spam ({count("spam")})</FilterChip>
        <FilterChip active={typeFilter === "all"} onClick={() => { setTypeFilter("all"); setFilter("all"); }}>All ({count("all")})</FilterChip>
      </div>

      {sources.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>All sources ({byType.length})</FilterChip>
          {sources.map((s) => (
            <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)}>
              {s} ({byType.filter((l) => l.source === s).length})
            </FilterChip>
          ))}
        </div>
      )}

      {leads === null && <p className="mt-10 text-muted-foreground">Loading leads…</p>}
      {leads !== null && visible.length === 0 && <p className="mt-10 text-muted-foreground">No leads yet.</p>}

      <div className="mt-8 space-y-4">
        {visible.map((lead) => (
          <article key={lead.id} className="rounded-lg border border-border bg-card p-6">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg">{lead.name}</h2>
                <p className="text-sm text-muted-foreground">
                  <a href={`mailto:${lead.email}`} className="hover:text-primary">{lead.email}</a>
                  {lead.phone && (<> · <a href={`tel:${lead.phone}`} className="hover:text-primary">{lead.phone}</a></>)}
                </p>
              </div>
              <div className="text-right">
                <span className="inline-block rounded-full bg-primary/15 text-primary px-3 py-1 text-xs uppercase tracking-widest">{lead.source}</span>
                {lead.lead_type && lead.lead_type !== "customer_lead" && (
                  <span className="ml-2 inline-block rounded-full bg-destructive/15 text-destructive px-3 py-1 text-xs uppercase tracking-widest">{lead.lead_type.replace("_", " ")}</span>
                )}
                <p className="mt-1 text-xs text-muted-foreground">{new Date(lead.created_at).toLocaleString()}</p>
                {lead.spam_reason && <p className="mt-1 text-xs text-muted-foreground italic">{lead.spam_reason}</p>}
              </div>
            </header>
            {lead.interest && <p className="mt-3 text-sm"><span className="text-muted-foreground">Interested in:</span> {lead.interest}</p>}
            {lead.message && <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{lead.message}</p>}
          </article>
        ))}
      </div>
    </>
  );
}

function ReferralsView({ referrals }: { referrals: Referral[] | null }) {
  if (referrals === null) return <p className="mt-10 text-muted-foreground">Loading referrals…</p>;

  const total = referrals.length;
  const redeemed = referrals.filter((r) => r.status === "redeemed").length;
  const rate = total === 0 ? 0 : Math.round((redeemed / total) * 100);

  // Leaderboard: group redeemed referrals by normalized referrer email
  const groups = new Map<string, { name: string; count: number }>();
  for (const r of referrals) {
    if (r.status !== "redeemed") continue;
    const key =
      (r.normalized_referrer_email ?? r.referrer_email ?? "").trim().toLowerCase() ||
      `name:${r.referrer_name.trim().toLowerCase()}`;
    const existing = groups.get(key);
    if (existing) existing.count += 1;
    else groups.set(key, { name: r.referrer_name.trim(), count: 1 });
  }
  const leaderboard = Array.from(groups.values()).sort((a, b) => b.count - a.count);

  const topReferrer = leaderboard[0]?.name ?? "—";

  return (
    <div className="mt-8 space-y-10">
      {/* Metrics */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric label="Total Sent" value={String(total)} />
        <Metric label="Total Redeemed" value={String(redeemed)} />
        <Metric label="Redemption Rate" value={`${rate}%`} />
        <Metric label="Top Referrer" value={topReferrer} />
      </div>

      {/* Leaderboard */}
      <div>
        <h2 className="text-xs tracking-[0.3em] text-primary">LEADERBOARD</h2>
        <h3 className="mt-2 text-2xl">Top Referrers (redeemed only)</h3>
        {leaderboard.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No redeemed referrals yet.</p>
        ) : (
          <div className="mt-4 rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs uppercase tracking-widest">
                <tr>
                  <th className="text-left px-4 py-3 w-16">#</th>
                  <th className="text-left px-4 py-3">Member</th>
                  <th className="text-right px-4 py-3">Redeemed</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row, i) => (
                  <tr key={row.name} className="border-t border-border">
                    <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold">{row.name}</td>
                    <td className="px-4 py-3 text-right font-bold text-primary">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* All referrals table */}
      <div>
        <h2 className="text-xs tracking-[0.3em] text-primary">ALL REFERRALS</h2>
        <h3 className="mt-2 text-2xl">Referral History</h3>
        {referrals.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No referrals yet.</p>
        ) : (
          <div className="mt-4 rounded-lg border border-border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs uppercase tracking-widest">
                <tr>
                  <th className="text-left px-4 py-3">Referrer Name</th>
                  <th className="text-left px-4 py-3">Referrer Email</th>
                  <th className="text-left px-4 py-3">Friend Name</th>
                  <th className="text-left px-4 py-3">Friend Email</th>
                  <th className="text-left px-4 py-3">Code</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Email Status</th>
                  <th className="text-left px-4 py-3">Email Sent</th>
                  <th className="text-left px-4 py-3">Created</th>
                  <th className="text-left px-4 py-3">Redeemed</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r) => (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="px-4 py-3 font-semibold">{r.referrer_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.referrer_email ?? r.referrer_contact ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold">{r.friend_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.friend_email ?? r.friend_contact ?? "—"}</td>
                    <td className="px-4 py-3 font-mono">{r.referral_code}</td>
                    <td className="px-4 py-3">
                      <span className={
                        "inline-block rounded-full px-3 py-1 text-xs uppercase tracking-widest " +
                        (r.status === "redeemed"
                          ? "bg-primary/15 text-primary"
                          : "bg-secondary text-muted-foreground")
                      }>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {r.email_sent ? (r.email_sent_at ? new Date(r.email_sent_at).toLocaleString() : "Yes") : "No"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.redeemed_at ? new Date(r.redeemed_at).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}
