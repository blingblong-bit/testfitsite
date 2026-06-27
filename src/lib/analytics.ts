// Pure analytics helpers — derive business-health metrics from CRM data only.
// No financial data is tracked here; revenue/membership $$ live in Anteris.

export type AnalyticsLead = {
  id: string;
  source: string;
  created_at: string;
  lead_type: string;
  crm_status: string | null;
  last_contacted_at: string | null;
  last_response_at: string | null;
  tour_scheduled: boolean;
  tour_completed: boolean;
  tour_date: string | null;
  became_member: boolean;
  membership_start_date: string | null;
  next_follow_up_date: string | null;
};

export type AnalyticsReferral = {
  id: string;
  referral_code: string;
  normalized_referrer_email: string | null;
  referrer_name: string;
  status: string;
  redeemed_at: string | null;
  created_at: string;
};

export type SourceKey =
  | "Website"
  | "Walk-In"
  | "Phone Call"
  | "Google Business"
  | "Social Media"
  | "Referral"
  | "Day Pass"
  | "Other";

export const SOURCE_KEYS: SourceKey[] = [
  "Website",
  "Walk-In",
  "Phone Call",
  "Google Business",
  "Social Media",
  "Referral",
  "Day Pass",
  "Other",
];

export function classifySource(raw: string | null | undefined): SourceKey {
  const s = (raw ?? "").toLowerCase();
  if (!s) return "Website";
  if (s.includes("walk")) return "Walk-In";
  if (s.includes("phone")) return "Phone Call";
  if (s.includes("google")) return "Google Business";
  if (s.includes("social") || s.includes("facebook") || s.includes("instagram") || s.includes("tiktok")) return "Social Media";
  if (s.includes("referral")) return "Referral";
  if (s.includes("day pass") || s.includes("day_pass") || s.includes("paid_day_pass")) return "Day Pass";
  if (
    s === "website" ||
    s.startsWith("/") ||
    s.includes("contact") ||
    s.includes("membership") ||
    s.includes("personal-training") ||
    s.includes("classes") ||
    s.includes("frontdesk") ||
    s.includes("home")
  ) return "Website";
  return "Other";
}

export function monthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
export function monthEnd(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
export function monthLabel(d: Date): string {
  return d.toLocaleString(undefined, { month: "short", year: "numeric" });
}

function inRange(iso: string | null, start: Date, end: Date): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t < end.getTime();
}

export type MonthMetrics = {
  websiteLeads: number;
  walkInLeads: number;
  phoneLeads: number;
  referralLeads: number;
  dayPassesSold: number;
  toursScheduled: number;
  toursCompleted: number;
  membersJoined: number;
  conversionRate: number; // % of leads in month who became members
  totalLeads: number;
  sourceCounts: Record<SourceKey, number>;
  // Referrals
  referralCodesGenerated: number;
  referralCodesRedeemed: number;
  membersFromReferrals: number;
};

export function computeMonth(
  leads: AnalyticsLead[],
  referrals: AnalyticsReferral[],
  start: Date,
  end: Date,
): MonthMetrics {
  const monthLeads = leads.filter(
    (l) => l.lead_type === "customer_lead" && inRange(l.created_at, start, end),
  );

  const sourceCounts: Record<SourceKey, number> = {
    Website: 0, "Walk-In": 0, "Phone Call": 0, "Google Business": 0,
    "Social Media": 0, Referral: 0, "Day Pass": 0, Other: 0,
  };
  for (const l of monthLeads) sourceCounts[classifySource(l.source)] += 1;

  const toursScheduled = monthLeads.filter((l) => l.tour_scheduled).length;
  const toursCompleted = monthLeads.filter((l) => l.tour_completed).length;
  const membersJoined = leads.filter(
    (l) => l.became_member && l.membership_start_date && inRange(l.membership_start_date + "T00:00:00", start, end),
  ).length;
  const dayPassesSold = monthLeads.filter((l) => classifySource(l.source) === "Day Pass").length;

  const refsCreated = referrals.filter((r) => inRange(r.created_at, start, end)).length;
  const refsRedeemed = referrals.filter((r) => inRange(r.redeemed_at, start, end)).length;
  const membersFromReferrals = leads.filter(
    (l) =>
      l.became_member &&
      l.membership_start_date &&
      inRange(l.membership_start_date + "T00:00:00", start, end) &&
      classifySource(l.source) === "Referral",
  ).length;

  const totalLeads = monthLeads.length;
  const conversionRate = totalLeads === 0 ? 0 : Math.round((membersJoined / totalLeads) * 100);

  return {
    websiteLeads: sourceCounts.Website,
    walkInLeads: sourceCounts["Walk-In"],
    phoneLeads: sourceCounts["Phone Call"],
    referralLeads: sourceCounts.Referral,
    dayPassesSold,
    toursScheduled,
    toursCompleted,
    membersJoined,
    conversionRate,
    totalLeads,
    sourceCounts,
    referralCodesGenerated: refsCreated,
    referralCodesRedeemed: refsRedeemed,
    membersFromReferrals,
  };
}

export function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return Math.round(((curr - prev) / prev) * 100);
}

export type Funnel = {
  leads: number;
  contacted: number;
  responded: number;
  toursScheduled: number;
  toursCompleted: number;
  members: number;
};

export function computeFunnel(leads: AnalyticsLead[], start: Date, end: Date): Funnel {
  const m = leads.filter(
    (l) => l.lead_type === "customer_lead" && inRange(l.created_at, start, end),
  );
  return {
    leads: m.length,
    contacted: m.filter((l) => l.last_contacted_at !== null || (l.crm_status && l.crm_status !== "New Lead")).length,
    responded: m.filter((l) => l.last_response_at !== null).length,
    toursScheduled: m.filter((l) => l.tour_scheduled).length,
    toursCompleted: m.filter((l) => l.tour_completed).length,
    members: m.filter((l) => l.became_member).length,
  };
}

export function avgHoursBetween(leads: AnalyticsLead[], fromKey: keyof AnalyticsLead, toKey: keyof AnalyticsLead): number | null {
  const samples: number[] = [];
  for (const l of leads) {
    const a = l[fromKey] as string | null;
    const b = l[toKey] as string | null;
    if (!a || !b) continue;
    const diff = new Date(b).getTime() - new Date(a).getTime();
    if (diff > 0) samples.push(diff / 3_600_000);
  }
  if (samples.length === 0) return null;
  return samples.reduce((s, n) => s + n, 0) / samples.length;
}

export function avgDaysBetween(leads: AnalyticsLead[], fromKey: keyof AnalyticsLead, toKey: keyof AnalyticsLead): number | null {
  const h = avgHoursBetween(leads, fromKey, toKey);
  return h === null ? null : h / 24;
}

export function topReferrers(referrals: AnalyticsReferral[]): Array<{ key: string; name: string; sent: number; redeemed: number }> {
  const map = new Map<string, { key: string; name: string; sent: number; redeemed: number }>();
  for (const r of referrals) {
    const key = (r.normalized_referrer_email ?? r.referrer_name).toLowerCase();
    const entry = map.get(key) ?? { key, name: r.referrer_name, sent: 0, redeemed: 0 };
    entry.sent += 1;
    if (r.redeemed_at) entry.redeemed += 1;
    map.set(key, entry);
  }
  return Array.from(map.values()).sort((a, b) => b.redeemed - a.redeemed || b.sent - a.sent);
}

export function isOverdue(dateIso: string | null, today: Date): boolean {
  if (!dateIso) return false;
  const d = new Date(dateIso + "T00:00:00");
  return d.getTime() <= today.getTime();
}

export function listMonths(earliest: Date, latest: Date): Date[] {
  const out: Date[] = [];
  let cur = monthStart(earliest);
  const end = monthStart(latest);
  while (cur.getTime() <= end.getTime()) {
    out.push(new Date(cur));
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return out;
}
