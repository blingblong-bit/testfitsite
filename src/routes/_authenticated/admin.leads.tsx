import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bell, BellOff, Home, ChevronDown, ChevronUp, Phone, Mail, Calendar, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type CrmStatus =
  | "New Lead"
  | "Contacted"
  | "Waiting on Response"
  | "Tour Scheduled"
  | "Tour Completed"
  | "Joined"
  | "Lost Lead";

const CRM_STATUSES: CrmStatus[] = [
  "New Lead",
  "Contacted",
  "Waiting on Response",
  "Tour Scheduled",
  "Tour Completed",
  "Joined",
  "Lost Lead",
];

const LEAD_SOURCE_OPTIONS = [
  "Website",
  "Walk-In",
  "Day Pass",
  "Referral",
  "Phone Call",
  "Google Business",
  "Social Media",
  "Other",
];

type ContactMethod = "Email" | "Phone Call" | "Text Message" | "In Person";
const CONTACT_METHODS: ContactMethod[] = ["Email", "Phone Call", "Text Message", "In Person"];

const PRIMARY_GOALS = [
  "Lose Weight",
  "Build Muscle",
  "General Fitness",
  "Athlete Performance",
  "Injury Recovery",
  "Improve Health",
  "Other",
];

type NextAction =
  | "Waiting for Response"
  | "Email Follow-Up"
  | "Phone Follow-Up"
  | "Text Follow-Up"
  | "Schedule Tour"
  | "Waiting for Tour"
  | "Ready to Join"
  | "No Further Follow-Up";

const NEXT_ACTIONS: NextAction[] = [
  "Waiting for Response",
  "Email Follow-Up",
  "Phone Follow-Up",
  "Text Follow-Up",
  "Schedule Tour",
  "Waiting for Tour",
  "Ready to Join",
  "No Further Follow-Up",
];

type Lead = {
  id: string;
  source: string;
  name: string;
  email: string;
  phone: string | null;
  interest: string | null;
  message: string | null;
  notes: string | null;
  created_at: string;
  lead_type: string;
  lead_score: number;
  should_notify: boolean;
  spam_reason: string | null;
  crm_status: CrmStatus | null;
  last_contacted_at: string | null;
  last_response_at: string | null;
  last_contact_method: ContactMethod | null;
  primary_goal: string | null;
  next_action: NextAction | null;
  next_follow_up_date: string | null;
  tour_scheduled: boolean;
  tour_completed: boolean;
  tour_date: string | null;
  became_member: boolean;
  membership_start_date: string | null;
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
type SortKey = "priority" | "newest" | "oldest" | "tour_date" | "last_contact" | "source";
type QuickFilter = "none" | "new" | "high_priority" | "due_today" | "tours_scheduled" | "tours_completed" | "joined_this_month";

type Priority = "high" | "medium" | "low";

function notificationForLead(lead: Lead): { title: string; body: string } {
  const src = (lead.source ?? "").toLowerCase();
  let kind = "New Website Lead";
  if (src.includes("referral")) kind = "New Referral Redemption";
  else if (src.includes("day pass") || src.includes("day_pass") || src.includes("paid_day_pass")) kind = "New Day Pass Submission";
  else if (src.includes("walk")) kind = "New Walk-In Lead";
  const interest = lead.interest ? `\nInterested in:\n${lead.interest}` : "";
  return { title: `${kind}\n${lead.name}`, body: interest.trim() || (lead.message ?? lead.email ?? "") };
}

export const Route = createFileRoute("/_authenticated/admin/leads")({
  head: () => ({
    meta: [
      { title: "Lead Tracker — FIT Beyond Plus Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLeads,
});

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function addDaysISODate(n: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// Returns the YYYY-MM-DD date to set; null = clear; "keep" = do not change.
function suggestNextFollowUp(lead: Lead): string | null | "keep" {
  const tourDate = lead.tour_date ? new Date(lead.tour_date).toISOString().slice(0, 10) : null;
  switch (lead.next_action) {
    case "Waiting for Response": return addDaysISODate(3);
    case "Email Follow-Up": return addDaysISODate(3);
    case "Phone Follow-Up": return addDaysISODate(1);
    case "Text Follow-Up": return addDaysISODate(1);
    case "Schedule Tour": return tourDate ?? addDaysISODate(1);
    case "Waiting for Tour": return tourDate ?? "keep";
    case "Ready to Join": return addDaysISODate(2);
    case "No Further Follow-Up": return null;
  }
  if ((lead.crm_status ?? "New Lead") === "New Lead") return addDaysISODate(2);
  return "keep";
}

// Whole days the follow-up is past due (today counts as 0, not overdue).
function followUpOverdueDays(lead: Lead): number | null {
  if (!lead.next_follow_up_date) return null;
  if (lead.crm_status === "Joined" || lead.crm_status === "Lost Lead") return null;
  const due = new Date(lead.next_follow_up_date + "T00:00:00").getTime();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - due) / 86400000);
  return diff > 0 ? diff : null;
}

function isFollowUpDueToday(lead: Lead): boolean {
  if (!lead.next_follow_up_date) return false;
  if (lead.crm_status === "Joined" || lead.crm_status === "Lost Lead") return false;
  const due = new Date(lead.next_follow_up_date + "T00:00:00").getTime();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return due <= today.getTime();
}

function computePriority(lead: Lead): Priority {
  if (lead.crm_status === "Joined" || lead.crm_status === "Lost Lead") return "low";
  const since = daysSince(lead.last_contacted_at);
  let base: Priority = "low";
  if (lead.crm_status === "New Lead" && since === null) base = "high";
  else if (since !== null && since > 5) base = "high";
  else if (since !== null && since >= 3) base = "medium";
  else if (since === null) base = "high";

  // Overdue follow-up bumps priority (works with, not against, the base logic).
  const overdue = followUpOverdueDays(lead);
  if (overdue !== null) {
    if (overdue >= 3) return "high";
    if (overdue >= 1 && base === "low") return "medium";
  }
  return base;
}

function priorityRank(p: Priority): number {
  return p === "high" ? 0 : p === "medium" ? 1 : 2;
}

function AdminLeads() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("leads");
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [referrals, setReferrals] = useState<Referral[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("customer_lead");
  const [statusFilter, setStatusFilter] = useState<CrmStatus | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("priority");
  const [query, setQuery] = useState("");
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

  // Re-render every minute so "days since" stays current without a page reload.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const [browserNotify, setBrowserNotify] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"
  );

  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-leads-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leads" },
        (payload) => {
          const lead = payload.new as Lead;
          setLeads((prev) => (prev ? [lead, ...prev] : [lead]));
          const { title, body } = notificationForLead(lead);
          toast.success(title.replace("\n", " — "), { description: body, duration: 8000 });
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try {
              const n = new Notification(title, { body, tag: lead.id, requireInteraction: true });
              n.onclick = () => {
                window.focus();
                if (window.location.pathname !== "/admin/leads") {
                  window.location.href = "/admin/leads";
                }
                n.close();
              };
            } catch { /* noop */ }
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin]);

  async function enableBrowserNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("Browser notifications are not supported here.");
      return;
    }
    const perm = await Notification.requestPermission();
    setBrowserNotify(perm);
    if (perm === "granted") toast.success("Browser notifications enabled");
    else if (perm === "denied") toast.error("Notifications blocked. Enable in browser settings.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/admin/login" });
  }

  async function updateLead(id: string, patch: Partial<Lead>) {
    // Optimistic UI
    setLeads((prev) => prev ? prev.map((l) => l.id === id ? { ...l, ...patch } as Lead : l) : prev);
    const { error } = await supabase.from("leads").update(patch).eq("id", id);
    if (error) {
      toast.error("Save failed: " + error.message);
      load();
    }
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
          <p className="mt-2 text-sm text-muted-foreground">Submissions, follow-ups, and referrals.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => navigate({ to: "/staff-home" })}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm hover:bg-secondary"
          >
            <Home className="h-4 w-4" /> Admin Homescreen
          </button>
          <button onClick={load} className="h-10 rounded-md border border-border px-4 text-sm hover:bg-secondary">Refresh</button>
          {browserNotify !== "granted" && browserNotify !== "unsupported" && (
            <button
              onClick={enableBrowserNotifications}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm hover:bg-secondary"
            >
              <Bell className="h-4 w-4" /> Enable alerts
            </button>
          )}
          {browserNotify === "granted" && (
            <span className="inline-flex h-10 items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-4 text-xs uppercase tracking-widest text-primary">
              <Bell className="h-4 w-4" /> Alerts on
            </span>
          )}
          {browserNotify === "unsupported" && (
            <span className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-xs uppercase tracking-widest text-muted-foreground">
              <BellOff className="h-4 w-4" /> No alerts
            </span>
          )}
          <button onClick={signOut} className="h-10 rounded-md border border-border px-4 text-sm hover:bg-secondary">Sign out</button>
        </div>
      </div>

      <div className="mt-6 flex gap-2 border-b border-border">
        <TabBtn active={tab === "leads"} onClick={() => setTab("leads")}>Leads</TabBtn>
        <TabBtn active={tab === "referrals"} onClick={() => setTab("referrals")}>Referrals</TabBtn>
      </div>

      {error && (
        <div className="mt-8 rounded-md border border-destructive bg-destructive/10 p-4 text-sm">
          {error}
        </div>
      )}

      {tab === "leads" && (
        <LeadsView
          leads={leads}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          sourceFilter={sourceFilter}
          setSourceFilter={setSourceFilter}
          sortBy={sortBy}
          setSortBy={setSortBy}
          query={query}
          setQuery={setQuery}
          updateLead={updateLead}
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
  leads, typeFilter, setTypeFilter, statusFilter, setStatusFilter,
  sourceFilter, setSourceFilter, sortBy, setSortBy, query, setQuery, updateLead,
}: {
  leads: Lead[] | null;
  typeFilter: TypeFilter; setTypeFilter: (t: TypeFilter) => void;
  statusFilter: CrmStatus | "all"; setStatusFilter: (s: CrmStatus | "all") => void;
  sourceFilter: string; setSourceFilter: (s: string) => void;
  sortBy: SortKey; setSortBy: (s: SortKey) => void;
  query: string; setQuery: (q: string) => void;
  updateLead: (id: string, patch: Partial<Lead>) => Promise<void>;
}) {
  const byType = useMemo(
    () => leads?.filter((l) => typeFilter === "all" || (l.lead_type ?? "customer_lead") === typeFilter) ?? [],
    [leads, typeFilter]
  );

  const sources = useMemo(() => Array.from(new Set(byType.map((l) => l.source))), [byType]);

  // Search + filters
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return byType.filter((l) => {
      if (statusFilter !== "all" && (l.crm_status ?? "New Lead") !== statusFilter) return false;
      if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
      if (q) {
        const hay = `${l.name} ${l.email} ${l.phone ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [byType, statusFilter, sourceFilter, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      switch (sortBy) {
        case "priority": {
          const pa = priorityRank(computePriority(a));
          const pb = priorityRank(computePriority(b));
          if (pa !== pb) return pa - pb;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        case "newest": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "oldest": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "tour_date": {
          const ta = a.tour_date ? new Date(a.tour_date).getTime() : Infinity;
          const tb = b.tour_date ? new Date(b.tour_date).getTime() : Infinity;
          return ta - tb;
        }
        case "last_contact": {
          const ta = a.last_contacted_at ? new Date(a.last_contacted_at).getTime() : 0;
          const tb = b.last_contacted_at ? new Date(b.last_contacted_at).getTime() : 0;
          return tb - ta;
        }
        case "source": return a.source.localeCompare(b.source);
      }
    });
    return arr;
  }, [filtered, sortBy]);

  // Dashboard stats (over byType — customer leads view)
  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const newLeads = byType.filter((l) => (l.crm_status ?? "New Lead") === "New Lead").length;
    const highPriority = byType.filter((l) => computePriority(l) === "high" && l.crm_status !== "Joined" && l.crm_status !== "Lost Lead").length;
    const followUpsDueToday = byType.filter((l) => isFollowUpDueToday(l)).length;
    const toursScheduled = byType.filter((l) => l.tour_scheduled && !l.tour_completed).length;
    const toursCompleted = byType.filter((l) => l.tour_completed).length;
    const joinedThisMonth = byType.filter((l) => l.became_member && l.membership_start_date && new Date(l.membership_start_date) >= monthStart).length;
    const totalForConversion = byType.length;
    const totalJoined = byType.filter((l) => l.became_member).length;
    const conversionRate = totalForConversion === 0 ? 0 : Math.round((totalJoined / totalForConversion) * 100);
    return { newLeads, highPriority, followUpsDueToday, toursScheduled, toursCompleted, joinedThisMonth, conversionRate };
  }, [byType]);

  const count = (t: TypeFilter) =>
    t === "all" ? (leads?.length ?? 0) : (leads?.filter((l) => (l.lead_type ?? "customer_lead") === t).length ?? 0);

  return (
    <>
      {/* Dashboard stats */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        <Stat label="New Leads" value={stats.newLeads} />
        <Stat label="Follow-Ups Due Today" value={stats.followUpsDueToday} accent={stats.followUpsDueToday > 0 ? "destructive" : undefined} />
        <Stat label="High Priority" value={stats.highPriority} accent="destructive" />
        <Stat label="Tours Scheduled" value={stats.toursScheduled} />
        <Stat label="Tours Completed" value={stats.toursCompleted} />
        <Stat label="Joined This Month" value={stats.joinedThisMonth} accent="primary" />
        <Stat label="Conversion Rate" value={`${stats.conversionRate}%`} accent="primary" />
      </div>

      {/* Type filter */}
      <div className="mt-6 flex flex-wrap gap-2">
        <FilterChip active={typeFilter === "customer_lead"} onClick={() => setTypeFilter("customer_lead")}>Customer Leads ({count("customer_lead")})</FilterChip>
        <FilterChip active={typeFilter === "vendor_solicitation"} onClick={() => setTypeFilter("vendor_solicitation")}>Vendor Solicitations ({count("vendor_solicitation")})</FilterChip>
        <FilterChip active={typeFilter === "spam"} onClick={() => setTypeFilter("spam")}>Spam ({count("spam")})</FilterChip>
        <FilterChip active={typeFilter === "all"} onClick={() => setTypeFilter("all")}>All ({count("all")})</FilterChip>
      </div>

      {/* Search + sort + filters */}
      <div className="mt-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone, or email…"
            className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="priority">Sort: Highest Priority</option>
          <option value="newest">Sort: Newest</option>
          <option value="oldest">Sort: Oldest</option>
          <option value="tour_date">Sort: Tour Date</option>
          <option value="last_contact">Sort: Last Contact</option>
          <option value="source">Sort: Lead Source</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CrmStatus | "all")}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="all">All Statuses</option>
          {CRM_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="all">All Sources</option>
          {sources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {leads === null && <p className="mt-10 text-muted-foreground">Loading leads…</p>}
      {leads !== null && sorted.length === 0 && <p className="mt-10 text-muted-foreground">No leads match your filters.</p>}

      <div className="mt-6 space-y-3">
        {sorted.map((lead) => (
          <LeadCard key={lead.id} lead={lead} updateLead={updateLead} />
        ))}
      </div>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: "primary" | "destructive" }) {
  const color =
    accent === "destructive" ? "text-destructive" : accent === "primary" ? "text-primary" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={"mt-1 text-2xl font-bold " + color}>{value}</p>
    </div>
  );
}

function PriorityBadge({ p }: { p: Priority }) {
  const map: Record<Priority, { label: string; cls: string }> = {
    high: { label: "🔴 High Priority", cls: "bg-destructive/15 text-destructive border-destructive/40" },
    medium: { label: "🟡 Medium Priority", cls: "bg-yellow-500/15 text-yellow-600 border-yellow-500/40" },
    low: { label: "🟢 Up To Date", cls: "bg-primary/15 text-primary border-primary/40" },
  };
  const { label, cls } = map[p];
  return <span className={"inline-block rounded-full border px-3 py-1 text-xs uppercase tracking-widest " + cls}>{label}</span>;
}

function relativeDays(iso: string | null): string {
  const d = daysSince(iso);
  if (d === null) return "Never";
  if (d === 0) return "Today";
  if (d === 1) return "1 day ago";
  return `${d} days ago`;
}

function LeadCard({ lead, updateLead }: { lead: Lead; updateLead: (id: string, patch: Partial<Lead>) => Promise<void> }) {
  const [expanded, setExpanded] = useState(false);
  const [notesDraft, setNotesDraft] = useState(lead.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const priority = computePriority(lead);
  const sinceContact = daysSince(lead.last_contacted_at);

  async function markContactedToday() {
    const iso = new Date().toISOString();
    const patch: Partial<Lead> = { last_contacted_at: iso };
    if ((lead.crm_status ?? "New Lead") === "New Lead") patch.crm_status = "Contacted";
    const suggested = suggestNextFollowUp(lead);
    if (suggested === null) patch.next_follow_up_date = null;
    else if (suggested !== "keep") patch.next_follow_up_date = suggested;
    await updateLead(lead.id, patch);
    toast.success("Marked as contacted today");
  }

  async function markResponded() {
    await updateLead(lead.id, { last_response_at: new Date().toISOString() });
    toast.success("Response logged");
  }

  async function saveNotes() {
    setSavingNotes(true);
    await updateLead(lead.id, { notes: notesDraft });
    setSavingNotes(false);
    toast.success("Notes saved");
  }

  async function toggleTourScheduled(v: boolean) {
    const patch: Partial<Lead> = { tour_scheduled: v };
    if (v && (lead.crm_status === "New Lead" || lead.crm_status === "Contacted" || lead.crm_status === "Waiting on Response")) {
      patch.crm_status = "Tour Scheduled";
    }
    await updateLead(lead.id, patch);
  }

  async function toggleTourCompleted(v: boolean) {
    const patch: Partial<Lead> = { tour_completed: v };
    if (v) patch.crm_status = "Tour Completed";
    await updateLead(lead.id, patch);
  }

  async function toggleMember(v: boolean) {
    const patch: Partial<Lead> = { became_member: v };
    if (v) {
      patch.crm_status = "Joined";
      if (!lead.membership_start_date) patch.membership_start_date = new Date().toISOString().slice(0, 10);
    } else {
      patch.membership_start_date = null;
    }
    await updateLead(lead.id, patch);
  }

  return (
    <article className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header (always visible) */}
      <header className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-semibold">{lead.name}</h2>
            <PriorityBadge p={priority} />
            <span className="inline-block rounded-full bg-secondary text-foreground px-3 py-1 text-xs uppercase tracking-widest">
              {lead.crm_status ?? "New Lead"}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
            <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 hover:text-primary">
              <Mail className="h-3.5 w-3.5" /> {lead.email}
            </a>
            {lead.phone && (
              <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1.5 hover:text-primary">
                <Phone className="h-3.5 w-3.5" /> {lead.phone}
              </a>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> {new Date(lead.created_at).toLocaleDateString()}
            </span>
            <span className="text-xs uppercase tracking-widest text-primary">{lead.source}</span>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Last contact: <span className="text-foreground">{relativeDays(lead.last_contacted_at)}</span>
            {sinceContact !== null && <> · <span className="text-foreground">{sinceContact} {sinceContact === 1 ? "day" : "days"} since contact</span></>}
            {lead.last_contact_method && <> · Method: <span className="text-foreground">{lead.last_contact_method}</span></>}
            {lead.last_response_at && <> · Last response: <span className="text-foreground">{relativeDays(lead.last_response_at)}</span></>}
            {lead.next_follow_up_date && <> · Follow up: <span className="text-foreground">{new Date(lead.next_follow_up_date + "T00:00:00").toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</span></>}
            {lead.next_action && <> · Next: <span className="text-foreground">{lead.next_action}</span></>}
          </p>

        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <button
              onClick={markContactedToday}
              className="h-9 rounded-md bg-primary px-3 text-xs font-semibold uppercase tracking-widest text-primary-foreground hover:opacity-90"
            >
              Contacted Today
            </button>
            <button
              onClick={markResponded}
              className="h-9 rounded-md border border-primary/40 bg-primary/10 px-3 text-xs font-semibold uppercase tracking-widest text-primary hover:bg-primary/20"
            >
              Lead Responded
            </button>
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            {expanded ? <>Collapse <ChevronUp className="h-3.5 w-3.5" /></> : <>Details <ChevronDown className="h-3.5 w-3.5" /></>}
          </button>
        </div>
      </header>

      {expanded && (
        <div className="border-t border-border p-5 space-y-5 bg-background/40">
          {/* Editable fields grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Status">
              <select
                value={lead.crm_status ?? "New Lead"}
                onChange={(e) => updateLead(lead.id, { crm_status: e.target.value as CrmStatus })}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              >
                {CRM_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Lead Source">
              <select
                value={LEAD_SOURCE_OPTIONS.includes(lead.source) ? lead.source : "Other"}
                onChange={(e) => updateLead(lead.id, { source: e.target.value })}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              >
                {LEAD_SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                {!LEAD_SOURCE_OPTIONS.includes(lead.source) && <option value={lead.source}>{lead.source}</option>}
              </select>
            </Field>
            <Field label="Phone">
              <input
                defaultValue={lead.phone ?? ""}
                onBlur={(e) => { if (e.target.value !== (lead.phone ?? "")) updateLead(lead.id, { phone: e.target.value || null }); }}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              />
            </Field>
            <Field label="Email">
              <input
                defaultValue={lead.email}
                onBlur={(e) => { if (e.target.value !== lead.email && e.target.value) updateLead(lead.id, { email: e.target.value }); }}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              />
            </Field>
            <Field label="Name">
              <input
                defaultValue={lead.name}
                onBlur={(e) => { if (e.target.value !== lead.name && e.target.value) updateLead(lead.id, { name: e.target.value }); }}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              />
            </Field>
            <Field label="Date Submitted">
              <div className="h-10 flex items-center text-sm text-muted-foreground">{new Date(lead.created_at).toLocaleString()}</div>
            </Field>
            <Field label="Last Contact Method">
              <select
                value={lead.last_contact_method ?? ""}
                onChange={(e) => updateLead(lead.id, { last_contact_method: (e.target.value || null) as ContactMethod | null })}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">— Not set —</option>
                {CONTACT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Primary Goal">
              <select
                value={lead.primary_goal ?? ""}
                onChange={(e) => updateLead(lead.id, { primary_goal: e.target.value || null })}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">— Not set —</option>
                {PRIMARY_GOALS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="Next Action">
              <select
                value={lead.next_action ?? ""}
                onChange={(e) => updateLead(lead.id, { next_action: (e.target.value || null) as NextAction | null })}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">— Not set —</option>
                {NEXT_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Next Follow-Up Date">
              <input
                key={lead.next_follow_up_date ?? "empty"}
                type="date"
                defaultValue={lead.next_follow_up_date ?? ""}
                onBlur={(e) => { const v = e.target.value || null; if (v !== (lead.next_follow_up_date ?? null)) updateLead(lead.id, { next_follow_up_date: v }); }}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              />
            </Field>
          </div>


          {/* Tour + Membership */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-md border border-border p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Tour</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={lead.tour_scheduled} onChange={(e) => toggleTourScheduled(e.target.checked)} />
                  Tour Scheduled
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={lead.tour_completed} onChange={(e) => toggleTourCompleted(e.target.checked)} />
                  Tour Completed
                </label>
                <Field label="Tour Date (optional)">
                  <input
                    type="datetime-local"
                    defaultValue={lead.tour_date ? new Date(lead.tour_date).toISOString().slice(0, 16) : ""}
                    onBlur={(e) => updateLead(lead.id, { tour_date: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  />
                </Field>
              </div>
            </div>

            <div className="rounded-md border border-border p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Membership</p>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={lead.became_member} onChange={(e) => toggleMember(e.target.checked)} />
                Became Member
              </label>
              {lead.became_member && (
                <Field label="Membership Start Date">
                  <input
                    type="date"
                    defaultValue={lead.membership_start_date ?? ""}
                    onBlur={(e) => updateLead(lead.id, { membership_start_date: e.target.value || null })}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  />
                </Field>
              )}
            </div>
          </div>

          {/* Original submission */}
          {(lead.interest || lead.message) && (
            <div className="rounded-md border border-border p-4 space-y-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Original Submission</p>
              {lead.interest && <p className="text-sm"><span className="text-muted-foreground">Interested in:</span> {lead.interest}</p>}
              {lead.message && <p className="text-sm whitespace-pre-wrap text-muted-foreground">{lead.message}</p>}
            </div>
          )}

          {/* Notes */}
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Staff Notes</p>
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-border bg-background p-3 text-sm"
              placeholder="Internal notes about this lead…"
            />
            <div className="mt-2 flex justify-end">
              <button
                onClick={saveNotes}
                disabled={savingNotes || notesDraft === (lead.notes ?? "")}
                className="h-9 rounded-md bg-primary px-4 text-xs font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-50"
              >
                {savingNotes ? "Saving…" : "Save Notes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}

function ReferralsView({ referrals }: { referrals: Referral[] | null }) {
  if (referrals === null) return <p className="mt-10 text-muted-foreground">Loading referrals…</p>;

  const total = referrals.length;
  const redeemed = referrals.filter((r) => r.status === "redeemed").length;
  const rate = total === 0 ? 0 : Math.round((redeemed / total) * 100);

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
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric label="Total Sent" value={String(total)} />
        <Metric label="Total Redeemed" value={String(redeemed)} />
        <Metric label="Redemption Rate" value={`${rate}%`} />
        <Metric label="Top Referrer" value={topReferrer} />
      </div>

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
                        (r.status === "redeemed" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground")
                      }>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <EmailStatusBadge status={r.email_status ?? "pending"} />
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

function EmailStatusBadge({ status }: { status: "pending" | "sent" | "failed" }) {
  const cls =
    status === "sent" ? "bg-primary/15 text-primary"
    : status === "failed" ? "bg-destructive/15 text-destructive"
    : "bg-secondary text-muted-foreground";
  return (
    <span className={"inline-block rounded-full px-3 py-1 text-xs uppercase tracking-widest " + cls}>
      {status}
    </span>
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
