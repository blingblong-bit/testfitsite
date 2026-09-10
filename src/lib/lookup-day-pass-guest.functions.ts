import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const Schema = z.object({
  phone: z.string().trim().min(7).max(40),
});

// A phone-only lookup on a public page could be probed to fish for names, so
// we return only a first name plus a yes/no, never the email or full record,
// and we cap how many lookups a single caller can run.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 500) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
  }
  return recent.length > MAX_PER_WINDOW;
}

export type DayPassGuestLookup = {
  found: boolean;
  first_name: string | null;
  lead_id: string | null;
  visit_count: number;
};

const NOT_FOUND: DayPassGuestLookup = {
  found: false,
  first_name: null,
  lead_id: null,
  visit_count: 0,
};

export const lookupDayPassGuest = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Schema.parse(data))
  .handler(async ({ data }): Promise<DayPassGuestLookup> => {
    const digits = data.phone.replace(/\D/g, "").slice(-10);
    if (digits.length !== 10) return NOT_FOUND;

    const caller =
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-forwarded-for") ??
      "unknown";
    if (rateLimited(caller)) return NOT_FOUND;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const last4 = digits.slice(-4);
    const { data: candidates, error } = await supabaseAdmin
      .from("leads")
      .select("id, name, phone, created_at")
      .ilike("phone", `%${last4}%`)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[lookupDayPassGuest] lookup failed", error.message);
      return NOT_FOUND;
    }

    const match = (candidates ?? []).find(
      (r) => (r.phone ?? "").replace(/\D/g, "").slice(-10) === digits,
    );
    if (!match) return NOT_FOUND;

    const { count } = await supabaseAdmin
      .from("day_pass_purchases")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", match.id);

    const firstName = (match.name ?? "").trim().split(/\s+/)[0] ?? null;
    return {
      found: true,
      first_name: firstName || null,
      lead_id: match.id as string,
      visit_count: count ?? 0,
    };
  });
