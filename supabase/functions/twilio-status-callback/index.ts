// Twilio delivery status webhook. Twilio POSTs form-encoded status updates
// (queued -> sent -> delivered / undelivered / failed) for every outbound
// message that included a StatusCallback URL.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

function normalizePhone(raw: string): string {
  const trimmed = (raw ?? "").trim();
  if (trimmed.startsWith("+")) return "+" + trimmed.slice(1).replace(/\D/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function parsePhoneList(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(/[,;\s]+/)
        .map((v) => v.trim())
        .filter(Boolean)
        .map(normalizePhone)
        .filter((v) => v.replace(/\D/g, "").length >= 10),
    ),
  );
}

async function sendStaffAlert(message: string): Promise<void> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_FROM_NUMBER");
  const ops = parsePhoneList(Deno.env.get("STAFF_NOTIFICATION_PHONES"));
  const recipients = ops.length ? ops : parsePhoneList(Deno.env.get("STAFF_ALERT_PHONE"));
  if (!sid || !token || !from || recipients.length === 0) {
    console.error("[twilio-status-callback] staff alert not sent:", message);
    return;
  }
  const auth = btoa(`${sid}:${token}`);
  await Promise.all(
    recipients.map(async (to) => {
      try {
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${auth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ To: to, From: from, Body: message }),
          },
        );
        if (!res.ok) {
          console.error("[twilio-status-callback] alert send failed", res.status, await res.text());
        }
      } catch (err) {
        console.error("[twilio-status-callback] alert send threw", err);
      }
    }),
  );
}

function chicagoDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

Deno.serve(async (req) => {
  try {
    const form = await req.formData();
    const messageSid = String(form.get("MessageSid") ?? "");
    const status = String(form.get("MessageStatus") ?? "");
    const errorCode = form.get("ErrorCode") ? String(form.get("ErrorCode")) : null;
    const errorMessage = form.get("ErrorMessage") ? String(form.get("ErrorMessage")) : null;

    if (!messageSid) {
      return new Response("missing MessageSid", { status: 200 });
    }

    const isFailure = status === "undelivered" || status === "failed";

    if (isFailure) {
      console.error(
        `[twilio-status-callback] ${status.toUpperCase()} sid=${messageSid} error_code=${errorCode ?? "n/a"} error_message=${errorMessage ?? "n/a"}`,
      );
    } else {
      console.log(`[twilio-status-callback] ${status} sid=${messageSid}`);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Read the log row first so we know which lead this message belongs to and
    // whether we already reacted to a failure for this SID (Twilio can retry).
    const { data: logRow } = await supabase
      .from("sms_conversation_log")
      .select("id, lead_id, phone, delivery_status")
      .eq("provider_message_id", messageSid)
      .maybeSingle();

    const alreadyHandled =
      logRow?.delivery_status === "undelivered" || logRow?.delivery_status === "failed";

    const { error } = await supabase
      .from("sms_conversation_log")
      .update({
        delivery_status: status,
        error_code: errorCode,
      })
      .eq("provider_message_id", messageSid);

    if (error) {
      console.error("[twilio-status-callback] db update failed", error.message);
    }

    // A text the carrier could not deliver means the number can't receive our
    // messages: stop the automated sequence, note it on the lead, tell staff.
    if (isFailure && logRow?.lead_id && !alreadyHandled) {
      const { data: lead } = await supabase
        .from("leads")
        .select("id, name, phone, notes, sequence_status")
        .eq("id", logRow.lead_id)
        .maybeSingle();

      if (lead) {
        const nowIso = new Date().toISOString();
        const reason = `carrier error ${errorCode ?? "unknown"}${errorMessage ? ` — ${errorMessage}` : ""}`;
        const note = `[${chicagoDate(nowIso)}] Text undelivered — ${reason}. Automated texting stopped; try calling.`;
        const notes = lead.notes ? `${lead.notes}\n${note}` : note;

        const { error: leadErr } = await supabase
          .from("leads")
          .update({ sequence_status: "undeliverable", notes })
          .eq("id", lead.id);
        if (leadErr) {
          console.error("[twilio-status-callback] lead update failed", leadErr.message);
        }

        await sendStaffAlert(
          `FIT Beyond Plus: text to ${lead.name ?? "a lead"} (${lead.phone ?? logRow.phone}) could not be delivered — ${reason}. Automated texting stopped. Try calling.`,
        );
      }
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("[twilio-status-callback] exception", err);
    return new Response("ok", { status: 200 });
  }
});
