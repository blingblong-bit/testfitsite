// Antaris member sync — polls recent leads and marks conversions when a
// matching Active member is found in Antaris. READ-ONLY toward Antaris.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkMemberMatch } from "./antaris-client.ts";

const TEST_EMAIL = "smstest@fitbeyondplus.com";

type LeadRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  last_sms_at: string | null;
};

function firstName(name: string | null): string {
  if (!name) return "there";
  return name.trim().split(/\s+/)[0] || "there";
}

function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return "+" + trimmed.slice(1).replace(/\D/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

async function sendWelcomeIfNeeded(
  supabase: ReturnType<typeof createClient>,
  lead: LeadRow,
): Promise<void> {
  if (lead.last_sms_at) return;
  if (!lead.phone) return;

  const to = normalizePhone(lead.phone);
  const body = `Welcome to the FIT Beyond Plus family, ${firstName(lead.name)}! 💪 We're pumped to have you. If you ever have questions, need to update your schedule, or just want to know what's going on at the gym — just text here. See you soon!`;
  const now = new Date().toISOString();
  const isTest = (lead.email ?? "").trim().toLowerCase() === TEST_EMAIL;

  if (isTest) {
    await supabase.from("leads").update({ last_sms_at: now }).eq("id", lead.id);
    await supabase.from("sms_conversation_log").insert({
      lead_id: lead.id,
      phone: to,
      direction: "outbound",
      body: `TEST MODE - SMS not sent | ${body}`,
      from_ai: false,
      provider_message_id: null,
      status: "test_mode",
      metadata: { kind: "welcome", test_mode: true, sent_by: "antaris_sync" },
    });
    return;
  }

  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_FROM_NUMBER");
  if (!sid || !token || !from) {
    console.error("[antaris-sync] missing Twilio env");
    return;
  }
  const auth = btoa(`${sid}:${token}`);
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    },
  );
  if (!res.ok) {
    console.error("[antaris-sync] twilio error", res.status, await res.text());
    return;
  }
  const j = (await res.json()) as { sid?: string };
  await supabase.from("leads").update({ last_sms_at: now }).eq("id", lead.id);
  await supabase.from("sms_conversation_log").insert({
    lead_id: lead.id,
    phone: to,
    direction: "outbound",
    body,
    from_ai: false,
    provider_message_id: j.sid ?? null,
    status: "sent",
    metadata: { kind: "welcome", sent_by: "antaris_sync" },
  });
}

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, name, email, phone, notes, last_sms_at")
    .eq("became_member", false)
    .eq("lead_type", "customer_lead")
    .not("crm_status", "in", "(Joined,Lost Lead)")
    .gte("created_at", since);

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  let checked = 0;
  let converted = 0;
  let errors = 0;

  for (const lead of (leads ?? []) as LeadRow[]) {
    checked += 1;
    try {
      const name = lead.name ?? "";
      const email = lead.email ?? "";
      const phone = lead.phone ?? "";
      if (!name && !email) continue;

      const match = await checkMemberMatch(name, email, phone);
      if (!match.isMember) continue;

      const ts = new Date().toISOString();
      const noteLine =
        match.confidence >= 100
          ? `[${ts}] Verified Antaris match (name+phone+email)`
          : `[${ts}] High confidence Antaris match (name+phone)`;
      const nextNotes = lead.notes ? `${lead.notes}\n${noteLine}` : noteLine;

      const { error: updErr } = await supabase
        .from("leads")
        .update({
          became_member: true,
          crm_status: "Joined",
          sequence_status: "completed",
          converted_at: ts,
          notes: nextNotes,
        })
        .eq("id", lead.id);
      if (updErr) throw updErr;

      converted += 1;
      await sendWelcomeIfNeeded(supabase, lead);
    } catch (e) {
      errors += 1;
      console.error("[antaris-sync] lead error", lead.id, e);
    }
  }

  return new Response(
    JSON.stringify({ checked, converted, errors }),
    { headers: { "Content-Type": "application/json" } },
  );
});
