import { createFileRoute } from "@tanstack/react-router";
import {
  type AnalyticsLead,
  type AnalyticsReferral,
  computeMonth,
  monthKey,
  monthStart,
} from "@/lib/analytics";

// Snapshots the previous calendar month into public.monthly_snapshots.
// Called by pg_cron on the 1st of each month.
export const Route = createFileRoute("/api/public/hooks/snapshot-month")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apiKey || !expected || apiKey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const now = new Date();
        const thisMonth = monthStart(now);
        const prevMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - 1, 1);

        // Pull all leads + referrals (small dataset for a single gym; OK)
        const [{ data: leads, error: lerr }, { data: refs, error: rerr }] = await Promise.all([
          supabaseAdmin.from("leads").select(
            "id, source, created_at, lead_type, crm_status, last_contacted_at, last_response_at, tour_scheduled, tour_completed, tour_date, became_member, membership_start_date, next_follow_up_date",
          ),
          supabaseAdmin.from("referrals").select(
            "id, referral_code, normalized_referrer_email, referrer_name, status, redeemed_at, created_at",
          ),
        ]);
        if (lerr || rerr) {
          return new Response(JSON.stringify({ error: lerr?.message ?? rerr?.message }), { status: 500 });
        }

        const metrics = computeMonth(
          (leads ?? []) as AnalyticsLead[],
          (refs ?? []) as AnalyticsReferral[],
          prevMonth,
          thisMonth,
        );

        const { error: upErr } = await supabaseAdmin
          .from("monthly_snapshots")
          .upsert({ month: monthKey(prevMonth), metrics }, { onConflict: "month" });
        if (upErr) return new Response(JSON.stringify({ error: upErr.message }), { status: 500 });

        return new Response(JSON.stringify({ ok: true, month: monthKey(prevMonth) }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
