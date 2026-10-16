import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Same lead/referral data the legacy tracker loads, paged so nothing is truncated.
async function all(table: "leads" | "referrals") {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from(table).select("*").order("created_at", { ascending: false }).range(offset, offset + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as Record<string, unknown>[]));
    if (!data || data.length < 1000) return rows;
  }
}

export function useTrackerData() {
  return useQuery({
    queryKey: ["crm", "tracker-data"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data: roles } = u.user ? await supabase.from("user_roles").select("role").eq("user_id", u.user.id) : { data: [] };
      const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
      const [leads, referrals] = await Promise.all([all("leads"), all("referrals")]);
      return { leads, referrals, isAdmin };
    },
  });
}
