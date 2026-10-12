import { pickTourOpportunity, TOUR_STAGE } from "./tour-stage";

/**
 * Moves the contact's open sales attempt into "Tour or Assessment Booked" after a
 * confirmed tour. Caller must already be verified as staff. Never creates,
 * reopens, or moves won/lost/later-stage opportunities. Sends no texts.
 */
export async function advanceOpportunityForTour(leadId: string, appointmentId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: lead }, { data: opps }] = await Promise.all([
    supabaseAdmin.from("leads").select("interest").eq("id", leadId).maybeSingle(),
    supabaseAdmin.from("opportunities").select("id, stage, status, interest, created_at, appointment_id").eq("contact_id", leadId),
  ]);
  const now = new Date().toISOString();
  // Reschedule: card already in the tour stage — just refresh the link.
  const inTour = (opps ?? []).find((o) => o.status === "open" && o.stage === TOUR_STAGE);
  if (inTour) {
    if (inTour.appointment_id !== appointmentId)
      await supabaseAdmin.from("opportunities").update({ appointment_id: appointmentId }).eq("id", inTour.id);
    return;
  }
  const opp = pickTourOpportunity(opps ?? [], lead?.interest ?? null);
  if (!opp) return;
  const { error } = await supabaseAdmin
    .from("opportunities")
    .update({ stage: TOUR_STAGE, status: "open", appointment_id: appointmentId, last_activity_at: now })
    .eq("id", opp.id)
    .eq("status", "open");
  if (error) return console.error("[advanceOpportunityForTour]", error.message);
  await supabaseAdmin.from("contact_activity").insert({
    contact_id: leadId,
    opportunity_id: opp.id,
    kind: "stage_change",
    summary: `Moved to ${TOUR_STAGE} — tour booked`,
    idempotency_key: `tour_stage:${appointmentId}`,
    metadata: { from: opp.stage, to: TOUR_STAGE, appointment_id: appointmentId },
  });
}
