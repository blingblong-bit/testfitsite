import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BoardOpportunity = {
  id: string;
  contact_id: string;
  stage: string;
  status: string;
  interest: string;
  source: string | null;
  owner_id: string | null;
  last_activity_at: string | null;
  no_action_required: boolean;
  created_at: string;
  contact: { name: string; phone: string | null; email: string; review_flag: boolean; contact_type: string | null; last_response_at: string | null; last_contacted_at: string | null } | null;
  nextTask: { title: string; due_at: string | null } | null;
  appointmentAt: string | null;
};

export const currentUserQuery = queryOptions({
  queryKey: ["crm", "me"],
  queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  staleTime: Infinity,
});

export const boardQuery = queryOptions({
  queryKey: ["crm", "board"],
  queryFn: async (): Promise<BoardOpportunity[]> => {
    const { data: opps, error } = await supabase
      .from("opportunities")
      .select(
        "id, contact_id, stage, status, interest, source, owner_id, last_activity_at, no_action_required, created_at, contact:leads!opportunities_contact_id_fkey(name, phone, email, review_flag, contact_type, last_response_at, last_contacted_at)",
      )
      .order("last_activity_at", { ascending: false, nullsFirst: false })
      .limit(1000);
    if (error) throw error;
    const ids = Array.from(new Set((opps ?? []).map((o) => o.contact_id)));
    const [tasks, appts] = await Promise.all([
      ids.length
        ? supabase
            .from("crm_tasks")
            .select("contact_id, opportunity_id, title, due_at")
            .is("completed_at", null)
            .in("contact_id", ids)
            .order("due_at", { ascending: true, nullsFirst: false })
        : Promise.resolve({ data: [] as { contact_id: string; opportunity_id: string | null; title: string; due_at: string | null }[] }),
      ids.length
        ? supabase
            .from("appointments")
            .select("lead_id, requested_time, confirmed_time, status")
            .in("lead_id", ids)
            .in("status", ["pending", "confirmed", "alternative_suggested"])
            .gte("requested_time", new Date(Date.now() - 86400000).toISOString())
        : Promise.resolve({ data: [] as { lead_id: string | null; requested_time: string; confirmed_time: string | null; status: string }[] }),
    ]);
    return (opps ?? []).map((o) => {
      const t =
        (tasks.data ?? []).find((x) => x.opportunity_id === o.id) ??
        (tasks.data ?? []).find((x) => x.contact_id === o.contact_id && !x.opportunity_id) ??
        null;
      const a = (appts.data ?? []).find((x) => x.lead_id === o.contact_id);
      return {
        ...(o as Omit<BoardOpportunity, "nextTask" | "appointmentAt">),
        nextTask: t ? { title: t.title, due_at: t.due_at } : null,
        appointmentAt: a ? (a.confirmed_time ?? a.requested_time) : null,
      };
    });
  },
});

export function contactQuery(id: string) {
  return queryOptions({
    queryKey: ["crm", "contact", id],
    queryFn: async () => {
      const [lead, opps, sms, appts, tasks, activity] = await Promise.all([
        supabase.from("leads").select("*").eq("id", id).maybeSingle(),
        supabase.from("opportunities").select("*").eq("contact_id", id).order("created_at", { ascending: false }),
        supabase
          .from("sms_conversation_log")
          .select("id, direction, body, status, delivery_status, from_ai, created_at, metadata")
          .eq("lead_id", id)
          .order("created_at", { ascending: true })
          .limit(500),
        supabase.from("appointments").select("*").eq("lead_id", id).order("requested_time", { ascending: false }),
        supabase.from("crm_tasks").select("*").eq("contact_id", id).order("due_at", { ascending: true, nullsFirst: false }),
        supabase.from("contact_activity").select("*").eq("contact_id", id).order("created_at", { ascending: false }).limit(200),
      ]);
      const error = [lead, opps, sms, appts, tasks, activity].find((result) => result.error)?.error;
      if (error) throw error;
      return {
        lead: lead.data,
        opportunities: opps.data ?? [],
        sms: sms.data ?? [],
        appointments: appts.data ?? [],
        tasks: tasks.data ?? [],
        activity: activity.data ?? [],
      };
    },
  });
}

export const contactLookupQuery = queryOptions({
  queryKey: ["crm", "contact-lookup"],
  queryFn: async () => {
    // Page across the entire directory, including held, spam and test contacts.
    const page = async (offset: number) => {
      const { data, error, count } = await supabase.from("leads")
        .select("id, name, phone, email, contact_type, review_flag, review_reason, lead_type, status, tags, interest, original_source, latest_source, source, created_at, last_response_at, last_sms_at, last_contacted_at", { count: "exact" })
        .order("id").range(offset, offset + 499);
      if (error) throw error;
      return { rows: data ?? [], total: count ?? 0 };
    };
    const first = await page(0);
    const rows = [...first.rows];
    for (let offset = 500; offset < first.total; offset += 500) {
      rows.push(...(await page(offset)).rows);
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

export function fmtChicago(iso: string | null, withTime = true): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

/** True when the contact's latest reply is newer than our latest contact with them. */
export function hasUnansweredReply(o: BoardOpportunity): boolean {
  const r = o.contact?.last_response_at;
  if (!r || o.status !== "open") return false;
  const c = o.contact?.last_contacted_at;
  return !c || new Date(r).getTime() > new Date(c).getTime();
}

/** Unanswered replies first (newest reply on top), then the original order. */
export function sortByReplies(items: BoardOpportunity[]): BoardOpportunity[] {
  return items
    .map((o, i) => ({ o, i, r: hasUnansweredReply(o) ? new Date(o.contact!.last_response_at!).getTime() : -1 }))
    .sort((a, b) => (b.r - a.r) || (a.i - b.i))
    .map((x) => x.o);
}
