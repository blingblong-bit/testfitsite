import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  type AnalyticsLead,
  type AnalyticsReferral,
  type MonthMetrics,
  classifySource,
  computeFunnel,
  computeMonth,
  avgHoursBetween,
  avgDaysBetween,
  listMonths,
  monthEnd,
  monthKey,
  monthLabel,
  monthStart,
  pctChange,
  topReferrers,
  isOverdue,
} from "@/lib/analytics";

const NOT_TRACKED = "Not Yet Tracked";

type Props = {
  leads: AnalyticsLead[] | null;
  referrals: AnalyticsReferral[] | null;
  isAdmin: boolean;
};

export function AnalyticsView({ leads, referrals, isAdmin }: Props) {
  const [rebuilding, setRebuilding] = useState(false);

  const data = useMemo(() => {
    if (!leads || !referrals) return null;
    const now = new Date();
    const thisStart = monthStart(now);
    const thisEnd = monthEnd(now);
    const lastStart = new Date(thisStart.getFullYear(), thisStart.getMonth() - 1, 1);
    const lastEnd = thisStart;

    const current = computeMonth(leads, referrals, thisStart, thisEnd);
    const previous = computeMonth(leads, referrals, lastStart, lastEnd);
    const funnel = computeFunnel(leads, thisStart, thisEnd);

    const earliest = leads.length || referrals.length
      ? new Date(Math.min(
          ...leads.map((l) => new Date(l.created_at).getTime()),
          ...referrals.map((r) => new Date(r.created_at).getTime()),
          now.getTime(),
        ))
      : now;
    const months = listMonths(earliest, now).slice(-12);
    const history = months.map((m) => {
      const me = new Date(m.getFullYear(), m.getMonth() + 1, 1);
      return { month: m, metrics: computeMonth(leads, referrals, m, me) };
    });

    // First-contact / tour / membership timing across all customer leads
    const customer = leads.filter((l) => l.lead_type === "customer_lead");
    const avgFirstContactHrs = avgHoursBetween(customer, "created_at", "last_contacted_at");
    const avgResponseHrs = avgHoursBetween(customer, "last_contacted_at", "last_response_at");
    const avgDaysToTour = avgDaysBetween(
      customer.filter((l) => l.tour_date),
      "created_at",
      "tour_date",
    );
    const avgDaysToMember = (() => {
      const samples: number[] = [];
      for (const l of customer) {
        if (l.became_member && l.membership_start_date) {
          const diff = new Date(l.membership_start_date + "T00:00:00").getTime() - new Date(l.created_at).getTime();
          if (diff > 0) samples.push(diff / 86_400_000);
        }
      }
      return samples.length === 0 ? null : samples.reduce((a, b) => a + b, 0) / samples.length;
    })();

    // Business health
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86_400_000);
    const activeLeads = customer.filter((l) => l.crm_status !== "Joined" && l.crm_status !== "Lost Lead").length;
    const highPriority = customer.filter((l) => {
      if (l.crm_status === "Joined" || l.crm_status === "Lost Lead") return false;
      if (!l.last_contacted_at) {
        const days = (Date.now() - new Date(l.created_at).getTime()) / 86_400_000;
        return days > 5;
      }
      const days = (Date.now() - new Date(l.last_contacted_at).getTime()) / 86_400_000;
      return days >= 5;
    }).length;
    const followUpsDue = customer.filter(
      (l) => l.crm_status !== "Joined" && l.crm_status !== "Lost Lead" && isOverdue(l.next_follow_up_date, today),
    ).length;
    const toursToday = customer.filter(
      (l) => l.tour_date && new Date(l.tour_date).getTime() >= today.getTime() && new Date(l.tour_date).getTime() < tomorrow.getTime(),
    ).length;
    const weekStart = new Date(today.getTime() - 6 * 86_400_000);
    const leadsThisWeek = customer.filter(
      (l) => classifySource(l.source) === "Website" && new Date(l.created_at).getTime() >= weekStart.getTime(),
    ).length;
    const allMembers = customer.filter((l) => l.became_member).length;
    const allLeadsCount = customer.length;
    const overallConversion = allLeadsCount === 0 ? 0 : Math.round((allMembers / allLeadsCount) * 100);

    return {
      current, previous, funnel, history,
      avgFirstContactHrs, avgResponseHrs, avgDaysToTour, avgDaysToMember,
      health: {
        activeLeads, highPriority, followUpsDue, toursToday,
        leadsThisWeek, leadsThisMonth: current.websiteLeads, membersThisMonth: current.membersJoined,
        avgFirstContactHrs, avgResponseHrs, overallConversion,
      },
      topRefs: topReferrers(referrals).slice(0, 5),
    };
  }, [leads, referrals]);

  async function rebuildSnapshots() {
    if (!leads || !referrals) return;
    setRebuilding(true);
    try {
      const now = new Date();
      const thisMonth = monthStart(now);
      const earliest = leads.length || referrals.length
        ? new Date(Math.min(
            ...leads.map((l) => new Date(l.created_at).getTime()),
            ...referrals.map((r) => new Date(r.created_at).getTime()),
          ))
        : now;
      const months = listMonths(earliest, now).filter((m) => m.getTime() < thisMonth.getTime());
      const rows = months.map((m) => {
        const me = new Date(m.getFullYear(), m.getMonth() + 1, 1);
        const metrics = computeMonth(leads, referrals, m, me);
        return { month: monthKey(m), metrics };
      });
      if (rows.length === 0) {
        toast.info("No completed months to snapshot yet.");
        return;
      }
      const { error } = await supabase.from("monthly_snapshots").upsert(rows, { onConflict: "month" });
      if (error) throw error;
      toast.success(`Rebuilt ${rows.length} monthly snapshot${rows.length === 1 ? "" : "s"}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to rebuild snapshots");
    } finally {
      setRebuilding(false);
    }
  }

  if (!data) {
    return <div className="mt-8 text-sm text-muted-foreground">Loading analytics…</div>;
  }

  const { current, previous, funnel, history, health, topRefs } = data;

  return (
    <div className="mt-8 space-y-10">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Business Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Lead generation, conversion, and follow-up performance — for{" "}
            <span className="text-foreground font-medium">{monthLabel(new Date())}</span>.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={rebuildSnapshots}
            disabled={rebuilding}
            className="inline-flex items-center gap-2 h-10 rounded-md border border-border px-4 text-sm hover:bg-secondary disabled:opacity-50"
          >
            <RefreshCw className={"h-4 w-4 " + (rebuilding ? "animate-spin" : "")} />
            {rebuilding ? "Rebuilding…" : "Rebuild Snapshots"}
          </button>
        )}
      </header>

      {/* Monthly Scoreboard */}
      <Section title="Monthly Scoreboard" subtitle="This month's totals at a glance">
        <Grid>
          <Score label="Website Leads" value={current.websiteLeads} change={pctChange(current.websiteLeads, previous.websiteLeads)} />
          <Score label="Walk-In Leads" value={current.walkInLeads} change={pctChange(current.walkInLeads, previous.walkInLeads)} />
          <Score label="Phone Call Leads" value={current.phoneLeads} change={pctChange(current.phoneLeads, previous.phoneLeads)} />
          <Score label="Google Business Leads" notTracked />
          <Score label="Social Media Leads" notTracked />
          <Score label="Referral Leads" value={current.referralLeads} change={pctChange(current.referralLeads, previous.referralLeads)} />
          <Score label="Day Passes Sold" value={current.dayPassesSold} change={pctChange(current.dayPassesSold, previous.dayPassesSold)} />
          <Score label="Tours Scheduled" value={current.toursScheduled} change={pctChange(current.toursScheduled, previous.toursScheduled)} />
          <Score label="Tours Completed" value={current.toursCompleted} change={pctChange(current.toursCompleted, previous.toursCompleted)} />
          <Score label="New Members Joined" value={current.membersJoined} change={pctChange(current.membersJoined, previous.membersJoined)} />
          <Score label="Membership Conversion" value={`${current.conversionRate}%`} change={pctChange(current.conversionRate, previous.conversionRate)} />
          <Score label="PT Referrals → Gym" notTracked />
          <Score label="Gym Referrals → PT" notTracked />
          <Score label="Google Reviews Received" notTracked />
        </Grid>
      </Section>

      {/* Conversion Funnel */}
      <Section title="Conversion Funnel" subtitle="How this month's leads progress through the pipeline">
        <FunnelView funnel={funnel} />
      </Section>

      {/* MoM Changes */}
      <Section title="Month-over-Month Change" subtitle="This month vs. last month">
        <Grid cols={4}>
          <MoM label="Website Leads" curr={current.websiteLeads} prev={previous.websiteLeads} />
          <MoM label="Tours Completed" curr={current.toursCompleted} prev={previous.toursCompleted} />
          <MoM label="New Members" curr={current.membersJoined} prev={previous.membersJoined} />
          <MoM label="Referral Leads" curr={current.referralLeads} prev={previous.referralLeads} />
        </Grid>
      </Section>

      {/* Lead Source Breakdown */}
      <Section title="Lead Source Breakdown" subtitle="Where this month's leads came from">
        <SourceBreakdown metrics={current} />
      </Section>

      {/* First-Contact Metrics */}
      <Section title="First Contact Metrics" subtitle="How quickly leads move through the pipeline (all-time average)">
        <Grid cols={4}>
          <Card label="Avg Time to First Contact" value={data.avgFirstContactHrs === null ? "—" : `${data.avgFirstContactHrs.toFixed(1)} hrs`} />
          <Card label="Avg Response Time" value={data.avgResponseHrs === null ? "—" : `${data.avgResponseHrs.toFixed(1)} hrs`} />
          <Card label="Avg Days Until Tour" value={data.avgDaysToTour === null ? "—" : `${data.avgDaysToTour.toFixed(1)} days`} />
          <Card label="Avg Days Until Membership" value={data.avgDaysToMember === null ? "—" : `${data.avgDaysToMember.toFixed(1)} days`} />
        </Grid>
      </Section>

      {/* Day Pass Analytics */}
      <Section title="Day Pass Analytics" subtitle="Walk-in vs. referral day passes and conversion to members">
        <DayPassAnalytics leads={leads ?? []} />
      </Section>



      {/* Referral Analytics */}
      <Section title="Referral Analytics" subtitle="Performance of the referral program">
        <Grid cols={4}>
          <Card label="Codes Generated (this mo.)" value={current.referralCodesGenerated} />
          <Card label="Codes Redeemed (this mo.)" value={current.referralCodesRedeemed} />
          <Card label="Members from Referrals (this mo.)" value={current.membersFromReferrals} />
          <Card
            label="Referral Conversion Rate"
            value={current.referralCodesGenerated === 0 ? "—" : `${Math.round((current.referralCodesRedeemed / current.referralCodesGenerated) * 100)}%`}
          />
          <Card label="PT → Gym Referrals" value={NOT_TRACKED} dim />
          <Card label="Gym → PT Referrals" value={NOT_TRACKED} dim />
        </Grid>
        <div className="mt-6 rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Top Referrers (all-time)</p>
          {topRefs.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No referrals yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {topRefs.map((r) => (
                <li key={r.key} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-muted-foreground">
                    {r.redeemed} redeemed · {r.sent} sent
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      {/* Business Health */}
      <Section title="Business Health" subtitle="Right-now operational metrics">
        <Grid cols={4}>
          <Card label="Active Leads" value={health.activeLeads} />
          <Card label="High Priority" value={health.highPriority} accent={health.highPriority > 0 ? "destructive" : undefined} />
          <Card label="Follow-Ups Due Today" value={health.followUpsDue} accent={health.followUpsDue > 0 ? "primary" : undefined} />
          <Card label="Tours Today" value={health.toursToday} />
          <Card label="Website Leads This Week" value={health.leadsThisWeek} />
          <Card label="Website Leads This Month" value={health.leadsThisMonth} />
          <Card label="Members Joined This Month" value={health.membersThisMonth} />
          <Card label="Overall Conversion Rate" value={`${health.overallConversion}%`} />
        </Grid>
      </Section>

      {/* Owner Insights */}
      <Section title="Owner Insights" subtitle="Auto-generated summary">
        <OwnerInsights current={current} previous={previous} health={health} />
      </Section>

      {/* Monthly History */}
      <Section title="Monthly History" subtitle="Last 12 months of CRM performance">
        <HistoryTable history={history} />
      </Section>
    </div>
  );
}

/* -------- subcomponents -------- */

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Grid({ children, cols = 3 }: { children: React.ReactNode; cols?: 2 | 3 | 4 }) {
  const cls =
    cols === 4 ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
    : cols === 3 ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
    : "grid grid-cols-1 sm:grid-cols-2 gap-3";
  return <div className={cls}>{children}</div>;
}

function Score({ label, value, change, notTracked }: { label: string; value?: number | string; change?: number | null; notTracked?: boolean }) {
  if (notTracked) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/40 p-4">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm text-muted-foreground italic">{NOT_TRACKED}</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <p className="text-2xl font-bold">{value}</p>
        <ChangeBadge change={change} />
      </div>
    </div>
  );
}

function ChangeBadge({ change }: { change: number | null | undefined }) {
  if (change === undefined || change === null) return null;
  if (change === 0) return <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><Minus className="h-3 w-3" />0%</span>;
  const up = change > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  const cls = up ? "text-emerald-600 dark:text-emerald-400" : "text-destructive";
  const sign = up ? "+" : "";
  return <span className={"text-[11px] inline-flex items-center gap-1 " + cls}><Icon className="h-3 w-3" />{sign}{change}%</span>;
}

function Card({ label, value, accent, dim }: { label: string; value: number | string; accent?: "primary" | "destructive"; dim?: boolean }) {
  const color = accent === "destructive" ? "text-destructive" : accent === "primary" ? "text-primary" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={"mt-1 text-2xl font-bold " + (dim ? "text-muted-foreground italic text-sm" : color)}>{value}</p>
    </div>
  );
}

function MoM({ label, curr, prev }: { label: string; curr: number; prev: number }) {
  const change = pctChange(curr, prev);
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{curr} <span className="text-sm font-normal text-muted-foreground">vs {prev}</span></p>
      <div className="mt-1"><ChangeBadge change={change} /></div>
    </div>
  );
}

function FunnelView({ funnel }: { funnel: ReturnType<typeof computeFunnel> }) {
  const stages: Array<[string, number]> = [
    ["Website Leads", funnel.leads],
    ["Contacted", funnel.contacted],
    ["Responded", funnel.responded],
    ["Tour Scheduled", funnel.toursScheduled],
    ["Tour Completed", funnel.toursCompleted],
    ["Membership Joined", funnel.members],
  ];
  const max = Math.max(funnel.leads, 1);
  return (
    <div className="space-y-2">
      {stages.map(([name, count], i) => {
        const prev = i === 0 ? null : stages[i - 1][1];
        const stagePct = prev === null ? null : prev === 0 ? 0 : Math.round((count / prev) * 100);
        const width = Math.max(8, Math.round((count / max) * 100));
        return (
          <div key={name} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium">{name}</span>
              <span className="text-sm">
                <span className="font-semibold">{count}</span>
                {stagePct !== null && <span className="text-muted-foreground ml-2 text-xs">{stagePct}% from prev</span>}
              </span>
            </div>
            <div className="h-2 rounded bg-secondary overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SourceBreakdown({ metrics }: { metrics: MonthMetrics }) {
  const total = metrics.totalLeads || 1;
  const entries = Object.entries(metrics.sourceCounts) as Array<[string, number]>;
  return (
    <div className="space-y-2">
      {entries.map(([src, count]) => {
        const pct = Math.round((count / total) * 100);
        return (
          <div key={src} className="flex items-center gap-3">
            <span className="w-36 shrink-0 text-sm">{src}</span>
            <div className="flex-1 h-2 rounded bg-secondary overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${Math.max(2, pct)}%` }} />
            </div>
            <span className="w-20 text-right text-sm tabular-nums">{count} · {pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

function HistoryTable({ history }: { history: Array<{ month: Date; metrics: MonthMetrics }> }) {
  const rows = [...history].reverse();
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50 text-xs uppercase tracking-widest text-muted-foreground">
          <tr>
            <Th>Month</Th>
            <Th>Website</Th>
            <Th>Walk-In</Th>
            <Th>Tours</Th>
            <Th>Members</Th>
            <Th>Conv %</Th>
            <Th>Growth %</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const prev = rows[idx + 1]?.metrics;
            const growth = prev ? pctChange(row.metrics.totalLeads, prev.totalLeads) : null;
            return (
              <tr key={monthKey(row.month)} className="border-t border-border">
                <Td>{monthLabel(row.month)}</Td>
                <Td>{row.metrics.websiteLeads}</Td>
                <Td>{row.metrics.walkInLeads}</Td>
                <Td>{row.metrics.toursCompleted}</Td>
                <Td>{row.metrics.membersJoined}</Td>
                <Td>{row.metrics.conversionRate}%</Td>
                <Td><ChangeBadge change={growth} /></Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) { return <th className="px-3 py-2 text-left font-medium">{children}</th>; }
function Td({ children }: { children: React.ReactNode }) { return <td className="px-3 py-2 align-middle">{children}</td>; }

function OwnerInsights({
  current, previous, health,
}: { current: MonthMetrics; previous: MonthMetrics; health: { avgFirstContactHrs: number | null; avgResponseHrs: number | null; overallConversion: number } }) {
  const lines: string[] = [];
  const push = (label: string, curr: number, prev: number, unit = "") => {
    const ch = pctChange(curr, prev);
    if (ch === null) {
      if (curr > 0) lines.push(`${label}: ${curr}${unit} this month (no prior month to compare).`);
      return;
    }
    if (ch === 0) lines.push(`${label} are flat versus last month (${curr}${unit}).`);
    else if (ch > 0) lines.push(`${label} are up ${ch}% versus last month (${prev}${unit} → ${curr}${unit}).`);
    else lines.push(`${label} are down ${Math.abs(ch)}% versus last month (${prev}${unit} → ${curr}${unit}).`);
  };
  push("Website leads", current.websiteLeads, previous.websiteLeads);
  push("Tours completed", current.toursCompleted, previous.toursCompleted);
  push("New members", current.membersJoined, previous.membersJoined);
  push("Referral redemptions", current.referralCodesRedeemed, previous.referralCodesRedeemed);

  if (current.membersFromReferrals > 0) {
    lines.push(`Referral program produced ${current.membersFromReferrals} new member${current.membersFromReferrals === 1 ? "" : "s"} this month.`);
  }
  if (health.avgFirstContactHrs !== null) {
    const h = health.avgFirstContactHrs;
    if (h < 4) lines.push(`Average first-contact time is fast (${h.toFixed(1)} hrs).`);
    else if (h > 24) lines.push(`Average first-contact time is slow (${h.toFixed(1)} hrs) — aim for under 24.`);
  }
  if (health.overallConversion > 0) lines.push(`Overall lead-to-member conversion is ${health.overallConversion}%.`);

  if (lines.length === 0) lines.push("Not enough data yet to summarize.");

  return (
    <ul className="space-y-2 rounded-lg border border-border bg-card p-4">
      {lines.map((l, i) => (
        <li key={i} className="text-sm flex gap-2">
          <span className="text-primary">•</span>
          <span>{l}</span>
        </li>
      ))}
    </ul>
  );
}

/* -------- Day Pass Analytics -------- */

function isDayPass(source: string | null | undefined): "walkin" | "referral" | null {
  const s = (source ?? "").toLowerCase();
  if (s === "day_pass_walkin") return "walkin";
  if (s === "referral_day_pass") return "referral";
  return null;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function countInRange(
  leads: AnalyticsLead[],
  start: Date,
  end: Date,
): { total: number; walkin: number; referral: number } {
  let walkin = 0;
  let referral = 0;
  const s = start.getTime();
  const e = end.getTime();
  for (const l of leads) {
    const kind = isDayPass(l.source);
    if (!kind) continue;
    const t = new Date(l.created_at).getTime();
    if (t < s || t >= e) continue;
    if (kind === "walkin") walkin++;
    else referral++;
  }
  return { total: walkin + referral, walkin, referral };
}

function DayPassAnalytics({ leads }: { leads: AnalyticsLead[] }) {
  const [range, setRange] = useState<{ from?: Date; to?: Date }>({});

  const buckets = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const tomorrow = new Date(today.getTime() + 86_400_000);
    const dow = today.getDay(); // 0=Sun
    const weekStart = new Date(today.getTime() - dow * 86_400_000);
    const monthStartD = new Date(today.getFullYear(), today.getMonth(), 1);
    const yearStartD = new Date(today.getFullYear(), 0, 1);
    const allStart = new Date(0);
    const farFuture = new Date(now.getTime() + 365 * 86_400_000);

    return {
      today: countInRange(leads, today, tomorrow),
      week: countInRange(leads, weekStart, farFuture),
      month: countInRange(leads, monthStartD, farFuture),
      year: countInRange(leads, yearStartD, farFuture),
      all: countInRange(leads, allStart, farFuture),
    };
  }, [leads]);

  const conversion = useMemo(() => {
    const now = Date.now();
    const cutoff90 = now - 90 * 86_400_000;
    let allDP = 0;
    let allJoined = 0;
    let rec = 0;
    let recJoined = 0;
    for (const l of leads) {
      if (!isDayPass(l.source)) continue;
      allDP++;
      if (l.became_member) allJoined++;
      const t = new Date(l.created_at).getTime();
      if (t >= cutoff90) {
        rec++;
        if (l.became_member) recJoined++;
      }
    }
    const pct = (num: number, den: number) => (den === 0 ? 0 : Math.round((num / den) * 100));
    return {
      allTime: { pct: pct(allJoined, allDP), joined: allJoined, total: allDP },
      last90: { pct: pct(recJoined, rec), joined: recJoined, total: rec },
    };
  }, [leads]);

  const custom = useMemo(() => {
    if (!range.from) return null;
    const start = startOfDay(range.from);
    const endBase = range.to ?? range.from;
    const end = new Date(startOfDay(endBase).getTime() + 86_400_000);
    return { ...countInRange(leads, start, end), start, end };
  }, [leads, range]);

  const periods: Array<{ label: string; key: keyof typeof buckets }> = [
    { label: "Today", key: "today" },
    { label: "This Week", key: "week" },
    { label: "This Month", key: "month" },
    { label: "This Year", key: "year" },
    { label: "All Time", key: "all" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {periods.map((p) => {
          const b = buckets[p.key];
          return (
            <div key={p.key} className="rounded-lg border border-border bg-card p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{p.label}</p>
              <p className="mt-1 text-2xl font-bold">{b.total}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Walk-in <span className="text-foreground font-medium">{b.walkin}</span></span>
                <span>Referral <span className="text-foreground font-medium">{b.referral}</span></span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Day Pass → Member (All Time)</p>
          <p className="mt-1 text-2xl font-bold">{conversion.allTime.pct}%</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {conversion.allTime.joined} joined out of {conversion.allTime.total} day pass users
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Day Pass → Member (Last 90 Days)</p>
          <p className="mt-1 text-2xl font-bold">{conversion.last90.pct}%</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {conversion.last90.joined} joined out of {conversion.last90.total} day pass users
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-semibold mb-3">Custom Date Range</p>
        <div className="flex flex-wrap items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-[260px] justify-start text-left font-normal", !range.from && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {range.from ? (
                  range.to ? (
                    <>{format(range.from, "LLL d, y")} – {format(range.to, "LLL d, y")}</>
                  ) : (
                    format(range.from, "LLL d, y")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={range.from ? { from: range.from, to: range.to } : undefined}
                onSelect={(r) => setRange(r ?? {})}
                numberOfMonths={2}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          {range.from && (
            <Button variant="ghost" size="sm" onClick={() => setRange({})}>Clear</Button>
          )}
        </div>

        {custom && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total Day Passes</p>
              <p className="mt-1 text-xl font-bold">{custom.total}</p>
            </div>
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Walk-In</p>
              <p className="mt-1 text-xl font-bold">{custom.walkin}</p>
            </div>
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Referral</p>
              <p className="mt-1 text-xl font-bold">{custom.referral}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
