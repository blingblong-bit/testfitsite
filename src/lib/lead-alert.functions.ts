import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Staff-only test: creates a clearly labeled TEST lead (no customer texts,
 * closed, test lead_type) and sends the alert twice to prove the second
 * attempt is blocked as a duplicate.
 */
export const sendTestLeadAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = context.userId;
    const [a, s] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: uid, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: uid, _role: "staff" }),
    ]);
    if (!a.data && !s.data) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendNewLeadAlert } = await import("./lead-alert.server");

    const { data: lead, error } = await supabaseAdmin
      .from("leads")
      .insert({
        source: "test_lead_alert",
        name: "TEST — Lead Alert Check",
        email: "",
        phone: "+19315550100",
        interest: "Membership",
        message: "TEST lead created to verify the internal new-lead text alert. Safe to ignore.",
        lead_type: "spam", // keeps the TEST lead out of working lists, stats and automation
        spam_reason: "TEST lead alert check",
        should_notify: false,
        crm_status: "Lost Lead",
        sequence_status: "completed",
        notes: "TEST lead — internal alert verification",
      })
      .select("id")
      .single();
    if (error || !lead) return { ok: false as const, error: error?.message ?? "insert_failed" };

    const first = await sendNewLeadAlert(lead.id as string, { isTest: true });
    const second = await sendNewLeadAlert(lead.id as string, { isTest: true });
    return { ok: true as const, leadId: lead.id as string, first, second };
  });
