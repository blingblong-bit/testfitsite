import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { OperationsData } from "./operations";

// Each source is paged to avoid silently truncating operational totals.
async function allPages<T>(read: (offset: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await read(offset);
    if (error) throw new Error(error.message);
    result.push(...(data ?? []));
    if (!data || data.length < 500) return result;
  }
}
export const operationsQuery = queryOptions({
  queryKey: ["crm", "operations"],
  staleTime: 15000,
  refetchInterval: 60000,
  queryFn: async (): Promise<OperationsData> => {
    const [contacts, opportunities, tasks, appointments, referrals, messages, activity] = await Promise.all([
      allPages((offset) => supabase.from("leads").select("*").order("id").range(offset, offset + 499)),
      allPages((offset) => supabase.from("opportunities").select("*").order("id").range(offset, offset + 499)),
      allPages((offset) => supabase.from("crm_tasks").select("*").order("id").range(offset, offset + 499)),
      allPages((offset) => supabase.from("appointments").select("*").in("status", ["pending", "confirmed", "alternative_suggested"]).order("id").range(offset, offset + 499)),
      allPages((offset) => supabase.from("referrals").select("*").eq("promo_type", "free_week").eq("status", "redeemed").order("id").range(offset, offset + 499)),
      allPages((offset) => supabase.from("sms_conversation_log").select("lead_id, direction, from_ai, metadata, status, delivery_status, created_at").order("id").range(offset, offset + 499)),
      allPages((offset) => supabase.from("contact_activity").select("contact_id, kind, actor_id, metadata, created_at").neq("kind", "migration").order("id").range(offset, offset + 499)),
    ]);
    return { contacts, opportunities, tasks, appointments, referrals, messages, activity };
  },
});