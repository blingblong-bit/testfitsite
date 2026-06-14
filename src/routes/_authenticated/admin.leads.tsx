import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

type TypeFilter = "customer_lead" | "vendor_solicitation" | "spam" | "all";

export const Route = createFileRoute("/_authenticated/admin/leads")({
  head: () => ({
    meta: [
      { title: "Leads — FIT Beyond Plus Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLeads,
});

function AdminLeads() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("customer_lead");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  async function load() {
    setError(null);
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      setError(error.message);
      setLeads([]);
      return;
    }
    setLeads(data as Lead[]);
  }

  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) {
        setIsAdmin(false);
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
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
          <button
            onClick={signOut}
            className="h-10 rounded-md border border-border px-4 text-sm hover:bg-secondary"
          >
            Sign out
          </button>
          <button
            onClick={() => navigate({ to: "/" })}
            className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            Back to homepage
          </button>
        </div>
      </section>
    );
  }

  if (isAdmin === null) {
    return <section className="container-page py-20"><p className="text-muted-foreground">Checking access…</p></section>;
  }

  const byType = leads?.filter((l) => typeFilter === "all" || (l.lead_type ?? "customer_lead") === typeFilter) ?? [];
  const visible = byType.filter((l) => filter === "all" || l.source === filter);
  const sources = Array.from(new Set(byType.map((l) => l.source)));
  const count = (t: TypeFilter) =>
    t === "all" ? (leads?.length ?? 0) : (leads?.filter((l) => (l.lead_type ?? "customer_lead") === t).length ?? 0);

  return (
    <section className="container-page py-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.3em] text-primary">ADMIN</p>
          <h1 className="mt-2 text-3xl md:text-4xl">Leads Inbox</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            All contact form submissions, most recent first.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            className="h-10 rounded-md border border-border px-4 text-sm hover:bg-secondary"
          >
            Refresh
          </button>
          <button
            onClick={signOut}
            className="h-10 rounded-md border border-border px-4 text-sm hover:bg-secondary"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <FilterChip active={typeFilter === "customer_lead"} onClick={() => { setTypeFilter("customer_lead"); setFilter("all"); }}>
          Customer Leads ({count("customer_lead")})
        </FilterChip>
        <FilterChip active={typeFilter === "vendor_solicitation"} onClick={() => { setTypeFilter("vendor_solicitation"); setFilter("all"); }}>
          Vendor Solicitations ({count("vendor_solicitation")})
        </FilterChip>
        <FilterChip active={typeFilter === "spam"} onClick={() => { setTypeFilter("spam"); setFilter("all"); }}>
          Spam ({count("spam")})
        </FilterChip>
        <FilterChip active={typeFilter === "all"} onClick={() => { setTypeFilter("all"); setFilter("all"); }}>
          All ({count("all")})
        </FilterChip>
      </div>

      {sources.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
            All sources ({byType.length})
          </FilterChip>
          {sources.map((s) => (
            <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)}>
              {s} ({byType.filter((l) => l.source === s).length})
            </FilterChip>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-8 rounded-md border border-destructive bg-destructive/10 p-4 text-sm">
          {error}. You may not have admin/staff access yet — an admin must grant your account a role.
        </div>
      )}

      {leads === null && !error && (
        <p className="mt-10 text-muted-foreground">Loading leads…</p>
      )}

      {leads !== null && visible.length === 0 && !error && (
        <p className="mt-10 text-muted-foreground">No leads yet.</p>
      )}

      <div className="mt-8 space-y-4">
        {visible.map((lead) => (
          <article key={lead.id} className="rounded-lg border border-border bg-card p-6">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg">{lead.name}</h2>
                <p className="text-sm text-muted-foreground">
                  <a href={`mailto:${lead.email}`} className="hover:text-primary">{lead.email}</a>
                  {lead.phone && (
                    <> · <a href={`tel:${lead.phone}`} className="hover:text-primary">{lead.phone}</a></>
                  )}
                </p>
              </div>
              <div className="text-right">
                <span className="inline-block rounded-full bg-primary/15 text-primary px-3 py-1 text-xs uppercase tracking-widest">
                  {lead.source}
                </span>
                {lead.lead_type && lead.lead_type !== "customer_lead" && (
                  <span className="ml-2 inline-block rounded-full bg-destructive/15 text-destructive px-3 py-1 text-xs uppercase tracking-widest">
                    {lead.lead_type.replace("_", " ")}
                  </span>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(lead.created_at).toLocaleString()}
                </p>
                {lead.spam_reason && (
                  <p className="mt-1 text-xs text-muted-foreground italic">{lead.spam_reason}</p>
                )}
              </div>
            </header>
            {lead.interest && (
              <p className="mt-3 text-sm"><span className="text-muted-foreground">Interested in:</span> {lead.interest}</p>
            )}
            {lead.message && (
              <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{lead.message}</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "h-9 rounded-full border px-4 text-xs uppercase tracking-widest transition " +
        (active
          ? "border-primary bg-primary/15 text-primary"
          : "border-border text-muted-foreground hover:bg-secondary")
      }
    >
      {children}
    </button>
  );
}
