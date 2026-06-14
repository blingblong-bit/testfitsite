import { supabase } from "@/integrations/supabase/client";

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
}
