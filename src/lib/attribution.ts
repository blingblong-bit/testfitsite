// First-touch marketing attribution — captured in the browser, stored once,
// never overwritten. Deliberately minimal: no PII, no cookies, no full URLs
// with query strings, no third-party scripts.

import { deriveChannelName } from "./analytics";

const STORAGE_KEY = "fbp_first_touch";

export type FirstTouch = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  landing_page: string | null;
  initial_referrer: string | null;
  first_touch_at: string;
};

function clean(v: string | null, max: number): string | null {
  if (!v) return null;
  const t = v.trim().slice(0, max);
  return t.length > 0 ? t : null;
}

function referrerHost(): string | null {
  try {
    const ref = document.referrer;
    if (!ref) return null;
    const url = new URL(ref);
    // Same-origin navigation isn't an acquisition signal.
    if (url.host === window.location.host) return null;
    return clean(url.host, 300);
  } catch {
    return null;
  }
}

/**
 * Reads the stored first touch, if any. Safe to call during SSR (returns null).
 */
export function getFirstTouch(): FirstTouch | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FirstTouch>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      utm_source: parsed.utm_source ?? null,
      utm_medium: parsed.utm_medium ?? null,
      utm_campaign: parsed.utm_campaign ?? null,
      utm_content: parsed.utm_content ?? null,
      utm_term: parsed.utm_term ?? null,
      landing_page: parsed.landing_page ?? null,
      initial_referrer: parsed.initial_referrer ?? null,
      first_touch_at: parsed.first_touch_at ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Captures first touch on page load. Once a record exists it is NEVER
 * overwritten — a later tagged visit, a referral link, or a tour booking all
 * leave the original acquisition intact.
 *
 * When no UTMs are present we still record landing page + referrer host, but
 * we do NOT infer a channel from that: channel derivation falls back to the
 * lead's own source string unless there is positive UTM evidence.
 */
export function captureFirstTouch(): FirstTouch | null {
  if (typeof window === "undefined") return null;

  const existing = getFirstTouch();
  if (existing) return existing;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(window.location.search);
  } catch {
    params = new URLSearchParams();
  }

  const record: FirstTouch = {
    utm_source: clean(params.get("utm_source"), 120),
    utm_medium: clean(params.get("utm_medium"), 120),
    utm_campaign: clean(params.get("utm_campaign"), 200),
    utm_content: clean(params.get("utm_content"), 200),
    utm_term: clean(params.get("utm_term"), 200),
    landing_page: clean(window.location.pathname, 300),
    initial_referrer: referrerHost(),
    first_touch_at: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Private mode / storage disabled — attribution is best-effort.
  }

  return record;
}

/**
 * The shape passed along with a lead submission. Identical to FirstTouch plus
 * the derived channel, computed once at insert time so reporting stays stable
 * even if derivation rules evolve later.
 */
export type LeadAttribution = FirstTouch & { attribution_channel: string | null };

export function attributionForSubmission(
  source: string,
): LeadAttribution | null {
  const ft = getFirstTouch();
  if (!ft) return null;
  // deriveChannelName returns null without positive UTM evidence, so a
  // plain visit never fabricates a channel.
  return { ...ft, attribution_channel: deriveChannelName(ft, source) };
}

// ---------------------------------------------------------------------------
// Server-side plumbing: a shared zod shape for passing attribution into server
// functions, and the column mapper used on INSERT paths.
// ---------------------------------------------------------------------------

import { z } from "zod";
import { hasUtms } from "./analytics";

export const AttributionSchema = z
  .object({
    utm_source: z.string().max(120).nullable().optional(),
    utm_medium: z.string().max(120).nullable().optional(),
    utm_campaign: z.string().max(200).nullable().optional(),
    utm_content: z.string().max(200).nullable().optional(),
    utm_term: z.string().max(200).nullable().optional(),
    landing_page: z.string().max(300).nullable().optional(),
    initial_referrer: z.string().max(300).nullable().optional(),
    attribution_channel: z.string().max(60).nullable().optional(),
    first_touch_at: z.string().max(40).nullable().optional(),
  })
  .nullable()
  .optional();

export type AttributionInput = z.infer<typeof AttributionSchema>;

/**
 * Columns to write on a NEW lead. Returns {} unless there is positive UTM
 * evidence — a plain no-UTM visit contributes nothing beyond what the lead's
 * own source already says, so we never assert a channel we can't prove.
 *
 * Only ever spread into an INSERT. Update paths must leave these alone so
 * first touch can never be overwritten by a later action.
 */
export function attributionColumns(a: AttributionInput) {
  if (!a || !hasUtms(a)) return {};
  return {
    utm_source: a.utm_source ?? null,
    utm_medium: a.utm_medium ?? null,
    utm_campaign: a.utm_campaign ?? null,
    utm_content: a.utm_content ?? null,
    utm_term: a.utm_term ?? null,
    landing_page: a.landing_page ?? null,
    initial_referrer: a.initial_referrer ?? null,
    attribution_channel: a.attribution_channel ?? null,
    first_touch_at: a.first_touch_at ?? new Date().toISOString(),
  };
}
