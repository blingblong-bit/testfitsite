import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PIPELINE_STAGES = [
  "New Lead",
  "Attempting Contact",
  "Engaged",
  "Tour or Assessment Booked",
  "Trial or Day Pass Active",
  "Decision and Follow-Up",
  "Long-Term Nurture",
  "Joined — Won",
  "Closed — Lost",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

async function requireStaff(context: {
  supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" | "staff" }) => PromiseLike<{ data: boolean | null }> };
  userId: string;
}) {
  const [a, s] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "staff" }),
  ]);
  if (!a.data && !s.data) throw new Error("Forbidden");
}

const MoveSchema = z.object({
  opportunity_id: z.string().uuid(),
  stage: z.enum(PIPELINE_STAGES),
  reason: z.string().trim().max(500).optional(),
  confirmed: z.boolean().optional(),
});

/**
 * Move an opportunity to a new stage. Status is derived from the stage and
 * the database trigger rejects any mismatch. Won/Lost require explicit
 * confirmation; Joined fires the member updates and the welcome text at
 * most once per contact.
 */
export const moveOpportunityStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => MoveSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireStaff(context);
    const won = data.stage === "Joined — Won";
    const lost = data.stage === "Closed — Lost";
    if ((won || lost) && !data.confirmed) return { ok: false as const, error: "confirmation_required" };
    if (lost && !data.reason) return { ok: false as const, error: "reason_required" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: opp } = await supabaseAdmin
      .from("opportunities")
      .select("id, contact_id, stage, status, interest")
      .eq("id", data.opportunity_id)
      .maybeSingle();
    if (!opp) return { ok: false as const, error: "not_found" };
    if (opp.stage === data.stage) return { ok: true as const, unchanged: true };
    if (opp.status !== "open") {
      // Never reopen or overwrite a closed sales attempt.
      return { ok: false as const, error: "closed_opportunity" };
    }

    const now = new Date().toISOString();
    const { error: upErr } = await supabaseAdmin
      .from("opportunities")
      .update({
        stage: data.stage,
        status: won ? "won" : lost ? "lost" : "open",
        won_lost_reason: lost ? data.reason : won ? "Joined" : null,
        last_activity_at: now,
        no_action_required: won || lost ? true : undefined,
      })
      .eq("id", opp.id)
      .eq("status", "open");
    if (upErr) return { ok: false as const, error: upErr.message };

    await supabaseAdmin.from("contact_activity").insert({
      contact_id: opp.contact_id,
      opportunity_id: opp.id,
      kind: "stage_change",
      summary: `${opp.interest}: ${opp.stage} → ${data.stage}${lost ? ` (${data.reason})` : ""}`,
      actor_id: context.userId,
    });

    let welcome: "sent" | "skipped" | "failed" | null = null;
    if (won) {
      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("became_member, membership_start_date")
        .eq("id", opp.contact_id)
        .maybeSingle();
      if (!lead?.became_member) {
        await supabaseAdmin
          .from("leads")
          .update({
            became_member: true,
            crm_status: "Joined",
            converted_at: now,
            sequence_status: "completed",
            membership_start_date: lead?.membership_start_date ?? now.slice(0, 10),
          })
          .eq("id", opp.contact_id);
      }
      const { sendMemberWelcomeOnce } = await import("./crm.server");
      welcome = await sendMemberWelcomeOnce(opp.contact_id);
    }
    return { ok: true as const, welcome };
  });

export const assignOpportunityOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ opportunity_id: z.string().uuid(), to_me: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context);
    const owner = data.to_me ? context.userId : null;
    const { error } = await context.supabase
      .from("opportunities")
      .update({ owner_id: owner })
      .eq("id", data.opportunity_id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
