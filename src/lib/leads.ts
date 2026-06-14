import { supabase } from "@/integrations/supabase/client";
import { notifyNewLead } from "./notify-lead.functions";

export type LeadInput = {
  source: string;
  name: string;
  email: string;
  phone?: string | null;
  interest?: string | null;
  message?: string | null;
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

  const { error } = await supabase.from("leads").insert(payload);
  if (error) throw error;

  // Fire-and-forget email notification. Don't block the user if it fails.
  try {
    await notifyNewLead({
      data: { ...payload, submitted_at: new Date().toISOString() },
    });
  } catch (e) {
    console.error("Lead notification failed:", e);
  }
}

