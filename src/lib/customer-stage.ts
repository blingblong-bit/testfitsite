// Single source of truth for "what kind of person is this record?".
//
// A paid day-pass customer is NOT a prospect: money already changed hands and
// they have already used the gym. Prospect metrics and day-pass metrics are
// two separate funnels and must never be mixed.
//
// Nothing here changes a record. Stage is DERIVED from data staff already
// control (membership flag, CRM status, lead type) plus one piece of hard
// purchase evidence: leads.day_pass_purchased_at.

export type CustomerStage = "prospect" | "day_pass_customer" | "member" | "lost";

export type StageLead = {
  lead_type?: string | null;
  crm_status?: string | null;
  became_member?: boolean | null;
  day_pass_purchased_at?: string | null;
  created_at?: string | null;
  // Legacy purchase evidence, kept as a fallback for records written before
  // day_pass_purchased_at existed.
  source?: string | null;
  payment_status?: string | null;
  day_pass_price?: number | null;
};

const PAID_METHODS = ["venmo", "paid_at_desk"];

/**
 * True only with clear evidence of a completed day-pass purchase. Someone who
 * merely asked "how much is a day pass?" never lands here.
 */
export function isDayPassCustomer(lead: StageLead): boolean {
  if (lead.day_pass_purchased_at) return true;
  const paid = PAID_METHODS.includes((lead.payment_status ?? "").toLowerCase());
  const walkIn = (lead.source ?? "").toLowerCase() === "day_pass_walkin";
  return walkIn && paid && lead.day_pass_price != null;
}

/** When the day pass was paid for, as far as we can tell. */
export function dayPassPurchasedAt(lead: StageLead): string | null {
  if (lead.day_pass_purchased_at) return lead.day_pass_purchased_at;
  if (isDayPassCustomer(lead)) return lead.created_at ?? null;
  return null;
}

function isMemberRecord(lead: StageLead): boolean {
  return Boolean(lead.became_member) || lead.crm_status === "Joined";
}

function isClosedRecord(lead: StageLead): boolean {
  const type = lead.lead_type ?? "customer_lead";
  return lead.crm_status === "Lost Lead" || type === "spam" || type === "vendor_solicitation";
}

/**
 * Member and Lost win over day pass — a day-pass customer who joined is a
 * Member, and one written off is Lost. Otherwise purchase evidence decides.
 */
export function customerStage(lead: StageLead): CustomerStage {
  if (isMemberRecord(lead) || (lead.lead_type ?? "") === "existing_member") return "member";
  if (isClosedRecord(lead)) return "lost";
  if (isDayPassCustomer(lead)) return "day_pass_customer";
  return "prospect";
}

export const STAGE_LABELS: Record<CustomerStage, string> = {
  prospect: "Prospect",
  day_pass_customer: "Day Pass Customer",
  member: "Member",
  lost: "Lost / Archived",
};

/**
 * Was this person a real prospect BEFORE they bought a day pass? True when the
 * record existed well ahead of the purchase (they inquired, then later paid).
 * Walk-ins created at the moment of purchase are not prospects.
 */
const PRIOR_PROSPECT_GAP_MS = 2 * 60 * 60 * 1000;
export function wasProspectBeforeDayPass(lead: StageLead): boolean {
  const purchased = dayPassPurchasedAt(lead);
  if (!purchased || !lead.created_at) return false;
  const gap = new Date(purchased).getTime() - new Date(lead.created_at).getTime();
  return Number.isFinite(gap) && gap > PRIOR_PROSPECT_GAP_MS;
}

/** Records that belong in the prospect funnel (denominator + conversions). */
export function isProspectFunnel(lead: StageLead): boolean {
  const type = lead.lead_type ?? "customer_lead";
  if (type !== "customer_lead") return false;
  if (!isDayPassCustomer(lead)) return true;
  return wasProspectBeforeDayPass(lead);
}

/** Records that belong in the day-pass funnel. */
export function isDayPassFunnel(lead: StageLead): boolean {
  const type = lead.lead_type ?? "customer_lead";
  if (type === "spam" || type === "vendor_solicitation") return false;
  return isDayPassCustomer(lead);
}

/** A day-pass customer who went on to buy a membership. */
export function isDayPassConversion(lead: StageLead): boolean {
  return isDayPassFunnel(lead) && isMemberRecord(lead);
}
