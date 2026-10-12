/** Stages a booked tour may advance from. Later stages and won/lost are never touched. */
export const TOUR_ADVANCE_FROM = ["New Lead", "Attempting Contact", "Engaged", "Long-Term Nurture"] as const;
export const TOUR_STAGE = "Tour or Assessment Booked";

type Opp = { id: string; stage: string; status: string; interest: string; created_at: string };

/** Picks the open opportunity a booked tour should move, or null if none qualifies. */
export function pickTourOpportunity(opps: Opp[], leadInterest: string | null): Opp | null {
  const open = opps.filter((o) => o.status === "open").sort((a, b) => b.created_at.localeCompare(a.created_at));
  const chosen = open.find((o) => leadInterest && o.interest === leadInterest) ?? open[0] ?? null;
  if (!chosen || !(TOUR_ADVANCE_FROM as readonly string[]).includes(chosen.stage)) return null;
  return chosen;
}
