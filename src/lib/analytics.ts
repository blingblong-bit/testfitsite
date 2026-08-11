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
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  landing_page?: string | null;
  initial_referrer?: string | null;
  attribution_channel?: string | null;
  first_touch_at?: string | null;
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
  // Attribution-derived channel counts (each lead counted once)
  socialLeads: number;
  googleBusinessLeads: number;
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

  // Channel counts from the shared attribution logic; one bucket per lead.
  const monthChannels = monthLeads.map((l) => channelForLead(l));
  const socialLeads = monthChannels.filter(
    (c) => c === "Paid Social" || c === "Organic Social" || c === "Social Media",
  ).length;
  const googleBusinessLeads = monthChannels.filter((c) => c === "Google Business").length;

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
    socialLeads,
    googleBusinessLeads,
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

// ---------------------------------------------------------------------------
// Marketing attribution (UTM-based) — single source of truth for channel rules.
// Used by both the CRM lead cards and Business Analytics so the two can never
// drift apart.
// ---------------------------------------------------------------------------

export type ChannelKey =
  | "Website"
  | "Google Business"
  | "Paid Social"
  | "Organic Social"
  | "Social Media"
  | "Referral"
  | "Walk-In"
  | "Phone Call"
  | "Day Pass"
  | "Other";

export const CHANNEL_KEYS: ChannelKey[] = [
  "Website",
  "Google Business",
  "Paid Social",
  "Organic Social",
  "Social Media",
  "Referral",
  "Walk-In",
  "Phone Call",
  "Day Pass",
  "Other",
];

export type AttributionFields = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  landing_page?: string | null;
  initial_referrer?: string | null;
  attribution_channel?: string | null;
};

export function hasUtms(a: AttributionFields | null | undefined): boolean {
  if (!a) return false;
  return Boolean(
    a.utm_source || a.utm_medium || a.utm_campaign || a.utm_content || a.utm_term,
  );
}

const PAID_MEDIUMS = ["paid_social", "paidsocial", "cpc", "ppc", "paid"];
const ORGANIC_SOCIAL_MEDIUMS = ["organic_social", "organicsocial", "social"];

const PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook",
  fb: "Facebook",
  meta: "Meta",
  instagram: "Instagram",
  ig: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X",
  twitter: "X",
  linkedin: "LinkedIn",
  snapchat: "Snapchat",
  google: "Google",
  google_business: "Google Business",
  gbp: "Google Business",
};

export function platformLabel(utmSource: string | null | undefined): string | null {
  const s = (utmSource ?? "").trim().toLowerCase();
  if (!s) return null;
  return PLATFORM_LABELS[s] ?? titleizeToken(s);
}

/** Turns `free_week_aug2026` / `still-image-v1` into readable labels. */
export function titleizeToken(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  return s
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .map((w) => (w.length <= 1 ? w.toUpperCase() : w[0]!.toUpperCase() + w.slice(1)))
    .join(" ");
}

/**
 * Derives a channel from UTM evidence ONLY. Returns null when there is no
 * positive evidence — callers then fall back to the lead's own source string
 * via `channelForLead`. A no-UTM visit is never labeled "organic".
 */
export function deriveChannelName(
  a: AttributionFields | null | undefined,
  _source?: string | null,
): ChannelKey | null {
  if (!hasUtms(a)) return null;
  const src = (a?.utm_source ?? "").trim().toLowerCase();
  const med = (a?.utm_medium ?? "").trim().toLowerCase();

  // Source is checked before medium so `google_business` + `organic` resolves
  // to Google Business rather than Organic Social.
  if (src.includes("google_business") || src.includes("google business") || src === "gbp") {
    return "Google Business";
  }

  const isSocialPlatform =
    src.includes("facebook") ||
    src === "fb" ||
    src.includes("meta") ||
    src.includes("instagram") ||
    src === "ig" ||
    src.includes("tiktok") ||
    src.includes("snapchat") ||
    src.includes("youtube") ||
    src.includes("twitter") ||
    src === "x" ||
    src.includes("linkedin");

  if (PAID_MEDIUMS.some((m) => med.includes(m))) {
    return isSocialPlatform ? "Paid Social" : "Website";
  }
  if (ORGANIC_SOCIAL_MEDIUMS.some((m) => med.includes(m))) {
    return "Organic Social";
  }
  if (isSocialPlatform) return "Organic Social";

  if (med.includes("referral")) return "Referral";

  // Tagged but not a channel we model — still a website visit with a campaign.
  return "Website";
}

/** Maps a legacy source bucket onto the channel vocabulary. */
export function channelFromSourceKey(key: SourceKey): ChannelKey {
  return key === "Social Media" ? "Social Media" : (key as ChannelKey);
}

/**
 * The channel a lead should be reported under. UTM evidence wins; otherwise
 * we fall back to existing source classification, unchanged.
 */
export function channelForLead(
  lead: AttributionFields & { source: string | null | undefined },
): ChannelKey {
  const stored = (lead.attribution_channel ?? "").trim();
  if (stored && (CHANNEL_KEYS as string[]).includes(stored)) {
    return stored as ChannelKey;
  }
  const derived = deriveChannelName(lead, lead.source);
  if (derived) return derived;
  return channelFromSourceKey(classifySource(lead.source));
}

/** True when this lead's channel came from measured UTM data. */
export function hasMeasuredAttribution(
  lead: AttributionFields & { source?: string | null },
): boolean {
  return hasUtms(lead);
}


// ---------------------------------------------------------------------------
// Acquisition reporting: channel and campaign performance for a date range.
// Every row answers "did this bring in people who actually joined?"
// ---------------------------------------------------------------------------

export type AcquisitionRow = {
  key: string;
  label: string;
  sublabel?: string | null;
  leads: number;
  tours: number;
  members: number;
  dayPasses: number;
  conversionRate: number; // members / leads, 0-100
  measured: boolean; // true when backed by campaign tags
};

function createdInRange(l: AnalyticsLead, start: Date, end: Date): boolean {
  return inRange(l.created_at, start, end);
}

function rollup(
  key: string,
  label: string,
  rows: AnalyticsLead[],
  measured: boolean,
  sublabel?: string | null,
): AcquisitionRow {
  const leads = rows.length;
  const members = rows.filter((l) => l.became_member).length;
  return {
    key,
    label,
    sublabel: sublabel ?? null,
    leads,
    tours: rows.filter((l) => l.tour_completed || l.tour_scheduled).length,
    members,
    dayPasses: rows.filter((l) => classifySource(l.source) === "Day Pass").length,
    conversionRate: leads === 0 ? 0 : Math.round((members / leads) * 100),
    measured,
  };
}

/** Leads grouped by acquisition channel, highest volume first. */
export function computeChannelBreakdown(
  leads: AnalyticsLead[],
  start: Date,
  end: Date,
): AcquisitionRow[] {
  const scoped = leads.filter(
    (l) => l.lead_type === "customer_lead" && createdInRange(l, start, end),
  );
  const groups = new Map<ChannelKey, AnalyticsLead[]>();
  for (const l of scoped) {
    const ch = channelForLead(l);
    const bucket = groups.get(ch);
    if (bucket) bucket.push(l);
    else groups.set(ch, [l]);
  }
  return Array.from(groups.entries())
    .map(([ch, rows]) =>
      rollup(ch, ch, rows, rows.some((r) => hasMeasuredAttribution(r))),
    )
    .sort((a, b) => b.leads - a.leads || a.label.localeCompare(b.label));
}

/**
 * Leads grouped by campaign (utm_campaign), then platform. Only tagged leads
 * appear — an untagged lead has no campaign to credit.
 */
export function computeCampaignBreakdown(
  leads: AnalyticsLead[],
  start: Date,
  end: Date,
): AcquisitionRow[] {
  const scoped = leads.filter(
    (l) =>
      l.lead_type === "customer_lead" &&
      createdInRange(l, start, end) &&
      Boolean((l.utm_campaign ?? "").trim()),
  );
  const groups = new Map<string, AnalyticsLead[]>();
  for (const l of scoped) {
    const campaign = (l.utm_campaign ?? "").trim();
    const platform = platformLabel(l.utm_source) ?? "Unknown";
    const key = `${campaign}::${platform}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(l);
    else groups.set(key, [l]);
  }
  return Array.from(groups.entries())
    .map(([key, rows]) => {
      const [campaign, platform] = key.split("::");
      const creatives = Array.from(
        new Set(rows.map((r) => (r.utm_content ?? "").trim()).filter(Boolean)),
      );
      return rollup(
        key,
        titleizeToken(campaign) || campaign || "Untitled campaign",
        rows,
        true,
        creatives.length > 0
          ? `${platform} · ${creatives.map(titleizeToken).join(", ")}`
          : platform,
      );
    })
    .sort((a, b) => b.leads - a.leads || a.label.localeCompare(b.label));
}
