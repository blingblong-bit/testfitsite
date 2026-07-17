import { supabase } from "@/integrations/supabase/client";
import { notifyNewLead } from "./notify-lead.functions";
import { confirmLeadToCustomer } from "./confirm-lead.functions";
import { classifyLead } from "./lead-classifier";
import { checkExistingMemberSubmission } from "./check-existing-member.functions";

export type LeadInput = {
  source: string;
  name: string;
  email: string;
  phone?: string | null;
  interest?: string | null;
  message?: string | null;
  status?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  day_pass_price?: number | null;
  referral_code?: string | null;
  referred_by?: string | null;
  notes?: string | null;
};

export async function submitLead(input: LeadInput) {
  const payload = {
    source: input.source.trim(),
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone?.trim() || null,
    interest: input.interest?.trim() || null,
    message: input.message?.trim() || null,
  };

  if (!payload.name || !payload.email) {
    throw new Error("Name and email are required.");
  }

  // Check Antaris first — if this submitter is already an active member,
  // handle it server-side (insert + welcome SMS) and skip the normal flow.
  try {
    const result = await checkExistingMemberSubmission({
      data: {
        source: payload.source,
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        interest: payload.interest,
        message: payload.message,
      },
    });
    if (result?.handled) return;
  } catch (e) {
    console.error("Existing member check failed:", e);
  }

  const classification = classifyLead(payload);

  const { error } = await supabase.from("leads").insert({
    ...payload,
    status: input.status ?? null,
    payment_status: input.payment_status ?? null,
    payment_method: input.payment_method ?? null,
    day_pass_price: input.day_pass_price ?? null,
    referral_code: input.referral_code ?? null,
    referred_by: input.referred_by ?? null,
    notes: input.notes ?? null,
    lead_type: classification.lead_type,
    lead_score: classification.lead_score,
    should_notify: classification.should_notify,
    spam_reason: classification.spam_reason,
  });
  if (error) throw error;

  // Only notify admin + send customer confirmation for real customer leads.
  if (classification.should_notify) {
    const submitted_at = new Date().toISOString();
    try {
      await notifyNewLead({ data: { ...payload, submitted_at } });
    } catch (e) {
      console.error("Lead notification failed:", e);
    }
    try {
      await confirmLeadToCustomer({
        data: {
          name: payload.name,
          email: payload.email,
          interest: payload.interest,
          message: payload.message,
          submitted_at,
        },
      });
    } catch (e) {
      console.error("Lead confirmation email failed:", e);
    }
  }
}
