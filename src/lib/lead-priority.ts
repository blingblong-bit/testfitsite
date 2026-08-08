// Shared Lead Tracker priority logic. Pure + client/server safe.
// This is the single source of truth for the HIGH / MEDIUM / LOW PRIORITY
// badge in the Lead Tracker and for re-engagement eligibility.

export type Priority = "high" | "medium" | "low";

export type PriorityLead = {
  crm_status?: string | null;
  last_contacted_at?: string | null;
  next_follow_up_date?: string | null;
};

/** Whole days between the given timestamp and today (local calendar days). */
export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  const a = new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime();
  const now = new Date();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.max(0, Math.round((b - a) / 86400000));
}

/** Whole days the follow-up is past due (today counts as 0, not overdue). */
export function followUpOverdueDays(lead: PriorityLead): number | null {
  if (!lead.next_follow_up_date) return null;
  if (lead.crm_status === "Joined" || lead.crm_status === "Lost Lead") return null;
  const due = new Date(lead.next_follow_up_date + "T00:00:00").getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - due) / 86400000);
  return diff > 0 ? diff : null;
}

export function computePriority(lead: PriorityLead): Priority {
  if (lead.crm_status === "Joined" || lead.crm_status === "Lost Lead") return "low";
  const since = daysSince(lead.last_contacted_at ?? null);
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
