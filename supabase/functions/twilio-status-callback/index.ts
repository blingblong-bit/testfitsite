// Twilio delivery status webhook. Twilio POSTs form-encoded status updates
// (queued -> sent -> delivered / undelivered / failed) for every outbound
// message that included a StatusCallback URL.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

    if (status === "undelivered" || status === "failed") {
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

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("[twilio-status-callback] exception", err);
    return new Response("ok", { status: 200 });
  }
});
