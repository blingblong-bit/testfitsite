import type { Database } from "@/integrations/supabase/types";
import { chicagoDateOf } from "@/lib/chicago-time";
import { isTestOrSpam } from "./contact-directory";

type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type CrmTask = Row<"crm_tasks">;
export type OperationsData = {
  contacts: Row<"leads">[];
  opportunities: Row<"opportunities">[];
  tasks: CrmTask[];
  appointments: Row<"appointments">[];
  referrals: Row<"referrals">[];
  messages: Pick<Row<"sms_conversation_log">, "lead_id" | "direction" | "from_ai" | "metadata" | "status" | "delivery_status" | "created_at">[];
  activity: Pick<Row<"contact_activity">, "contact_id" | "kind" | "actor_id" | "metadata" | "created_at">[];
};
export const TASK_VIEWS = ["Overdue", "Due Today", "Upcoming", "Completed"] as const;
export type TaskView = typeof TASK_VIEWS[number];
export const ATTENTION_REASONS = [
  { id: "overdue", label: "Overdue tasks", instruction: "Complete overdue task", tab: "tasks" },
  { id: "appointments", label: "Appointments today", instruction: "Review today's appointment", tab: "appointments" },
  { id: "trials", label: "Trials ending within 48 hours", instruction: "Follow up before trial ends", tab: "opportunities" },
  { id: "new", label: "New leads not human-contacted", instruction: "Make first staff contact", tab: "conversation" },
  { id: "followups", label: "Follow-ups due today", instruction: "Complete today's follow-up", tab: "tasks" },
  { id: "stalled", label: "Active leads stalled 5+ days", instruction: "Review stalled sales attempt", tab: "opportunities" },
] as const;
export type AttentionReason = typeof ATTENTION_REASONS[number]["id"];
export type AttentionItem = { contact: Row<"leads">; reason: AttentionReason; at: string; detail: string; opportunityId?: string };

export function taskView(task: CrmTask, now: Date): TaskView {
  if (task.completed_at) return "Completed";
  if (!task.due_at) return "Upcoming";
  const day = chicagoDateOf(task.due_at);
  const today = chicagoDateOf(now);
  // Due-today tasks stay in today's queue until Chicago midnight.
  return day < today ? "Overdue" : day === today ? "Due Today" : "Upcoming";
}
function metadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function isHumanMessage(message: OperationsData["messages"][number]) {
  const m = metadata(message.metadata);
  return message.direction === "outbound" && !message.from_ai &&
    (m.kind === "manual" || m.sent_by === "staff") && m.test_mode !== true &&
    !["failed", "undelivered", "draft"].includes(message.delivery_status ?? message.status ?? "");
}
export function hasHumanContact(contact: OperationsData["contacts"][number], data: OperationsData) {
  if (data.messages.some((m) => m.lead_id === contact.id && isHumanMessage(m))) return true;
  if (data.activity.some((a) => a.contact_id === contact.id && a.actor_id && ["call", "phone_call", "manual_contact", "staff_contact", "manual_sms", "manual_email"].includes(a.kind))) return true;
  // Legacy non-text methods were entered by staff. SMS timestamps can be automated.
  return !!contact.last_contact_method && ["phone call", "email", "in person", "in-person"].includes(contact.last_contact_method.toLowerCase());
}

export function deriveOperations(data: OperationsData, now: Date) {
  const today = chicagoDateOf(now);
  const operational = data.contacts.filter((c) => !isTestOrSpam(c) && !c.review_flag);
  const byId = new Map(operational.map((c) => [c.id, c]));
  const groups: Record<AttentionReason, AttentionItem[]> = { overdue: [], appointments: [], trials: [], new: [], followups: [], stalled: [] };
  const add = (id: string, reason: AttentionReason, at: string, detail: string, opportunityId?: string) => {
    const contact = byId.get(id);
    if (contact) groups[reason].push({ contact, reason, at, detail, opportunityId });
  };
  const tasks = data.tasks.filter((t) => byId.has(t.contact_id));
  for (const t of tasks) {
    const view = taskView(t, now);
    if (view === "Overdue") add(t.contact_id, "overdue", t.due_at ?? t.created_at, t.title, t.opportunity_id ?? undefined);
    if (view === "Due Today") add(t.contact_id, "followups", t.due_at ?? t.created_at, t.title, t.opportunity_id ?? undefined);
  }
  for (const c of operational) {
    const open = data.opportunities.filter((o) => o.contact_id === c.id && o.status === "open");
    const active = open.filter((o) => o.stage !== "Long-Term Nurture");
    if (active.some((o) => ["New Lead", "Attempting Contact"].includes(o.stage)) && !hasHumanContact(c, data)) {
      add(c.id, "new", c.created_at, "No recorded staff call, email, or manual text", active[0]?.id);
    }
    if (c.next_follow_up_date === today && active.length) {
      add(c.id, "followups", `${today}T12:00:00Z`, "Scheduled follow-up", open[0]?.id);
    }
    if (c.contact_type === "Member" || c.became_member || c.contact_type === "Vendor/Non-Sales") continue;
    for (const o of active) {
      const activityDates = [o.last_activity_at, c.created_at, c.last_response_at, c.last_sms_at, c.last_contacted_at,
        ...data.messages.filter((m) => m.lead_id === c.id && !["failed", "draft", "undelivered"].includes(m.delivery_status ?? m.status ?? "")).map((m) => m.created_at),
        ...data.activity.filter((a) => a.contact_id === c.id && a.kind !== "migration").map((a) => a.created_at),
      ].filter((s): s is string => !!s).sort();
      const last = activityDates.at(-1) ?? c.created_at;
      const days = Math.floor((now.getTime() - new Date(last).getTime()) / 86400000);
      if (days >= 5) add(c.id, "stalled", last, `${days} days without activity · ${o.stage}`, o.id);
    }
  }
  for (const a of data.appointments) {
    if (!a.lead_id || !["pending", "confirmed", "alternative_suggested"].includes(a.status)) continue;
    const at = a.status === "confirmed" ? a.confirmed_time ?? a.requested_time : a.suggested_time ?? a.requested_time;
    if (chicagoDateOf(at) === today) add(a.lead_id, "appointments", at, `${a.type} · ${a.status}`);
  }
  // Only explicit, activated access periods qualify; never invent an expiry for a day pass.
  const trials = new Map<string, OperationsData["referrals"][number]>();
  for (const r of data.referrals) {
    if (!r.lead_id || r.promo_type !== "free_week" || r.status !== "redeemed" || !r.access_ends_at) continue;
    const prior = trials.get(r.lead_id);
    if (!prior?.access_ends_at || r.access_ends_at > prior.access_ends_at) trials.set(r.lead_id, r);
  }
  for (const [id, r] of trials) {
    const end = r.access_ends_at;
    const c = byId.get(id);
    if (!end || !c || c.became_member || c.contact_type === "Member") continue;
    if (r.access_starts_at && new Date(r.access_starts_at).getTime() > now.getTime()) continue;
    const remaining = new Date(end).getTime() - now.getTime();
    if (remaining >= 0 && remaining <= 48 * 3600000) add(id, "trials", end, "Trial access ends");
  }
  for (const r of ATTENTION_REASONS) {
    groups[r.id].sort((a, b) => a.at.localeCompare(b.at));
    groups[r.id] = groups[r.id].filter((item, i, rows) => rows.findIndex((x) => x.contact.id === item.contact.id) === i);
  }
  const seen = new Set<string>();
  const attention = ATTENTION_REASONS.flatMap((r) => groups[r.id]).filter((item) => {
    if (seen.has(item.contact.id)) return false;
    seen.add(item.contact.id); return true;
  });
  return { groups, attention, tasks };
}