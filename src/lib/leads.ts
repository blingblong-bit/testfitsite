import { supabase } from "@/integrations/supabase/client";
import { notifyNewLead } from "./notify-lead.functions";
import { classifyLead } from "./lead-classifier";

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

  const classification = classifyLead(payload);

  const { error } = await supabase.from("leads").insert({
    ...payload,
    status: input.status ?? null,
    payment_status: input.payment_status ?? null,
    payment_method: input.payment_method ?? null,
    day_pass_price: input.day_pass_price ?? null,
    lead_type: classification.lead_type,
    lead_score: classification.lead_score,
    should_notify: classification.should_notify,
    spam_reason: classification.spam_reason,
  });
  if (error) throw error;

  // Only notify admin for real customer leads.
  if (classification.should_notify) {
    try {
      await notifyNewLead({
        data: { ...payload, submitted_at: new Date().toISOString() },
      });
    } catch (e) {
      console.error("Lead notification failed:", e);
    }
  }
}
