// One-tap "Call from FIT" bridge. Server-only.
// Twilio rings the staff phone (LEAD_ALERT_PHONE) from the FIT number, then on
// answer <Dial>s the contact with the FIT number as caller ID. No recording,
// no voicemail, no texts, no stage/contact changes.
import { createHmac, timingSafeEqual } from "crypto";

export const CALL_PUBLIC_BASE = "https://fitbeyondplus.com";
export const CALL_WEBHOOK_PATH = "/api/public/webhooks/crm-call";
export const ACTIVE_STATUSES = ["initiating", "queued", "ringing", "in-progress"] as const;
const STALE_MS = 3 * 60_000;

export function toE164US(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  const d = t.replace(/\D/g, "");
  if (d.length === 10 && /^[2-9]\d{2}[2-9]\d{6}$/.test(d)) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1") && /^[2-9]\d{2}[2-9]\d{6}$/.test(d.slice(1))) return `+${d}`;
  return null;
}

export function firstName(name: string | null | undefined) {
  return (name ?? "").trim().split(/\s+/)[0] || "the contact";
}

export function xmlEscape(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

export function connectTwiml(contactE164: string, fromE164: string, statusUrl: string) {
  const u = xmlEscape(statusUrl);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Dial callerId="${xmlEscape(fromE164)}" timeout="25" answerOnBridge="true" record="do-not-record"><Number statusCallback="${u}" statusCallbackEvent="initiated ringing answered completed" statusCallbackMethod="POST">${xmlEscape(contactE164)}</Number></Dial><Hangup/></Response>`;
}

export function verifyTwilioSignature(url: string, params: Record<string, string>, signature: string | null, token: string) {
  if (!signature) return false;
  let data = url;
  for (const k of Object.keys(params).sort()) data += k + params[k];
  const expected = createHmac("sha1", token).update(data, "utf8").digest("base64");
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

const RANK: Record<string, number> = { initiating: 0, queued: 1, initiated: 1, ringing: 2, "in-progress": 3, answered: 3 };
const FINAL = new Set(["completed", "busy", "failed", "canceled", "no-answer"]);
export function nextStatus(current: string, incoming: string): string | null {
  if (FINAL.has(current)) return null; // idempotent: finished calls never change
  const inc = incoming === "answered" ? "in-progress" : incoming === "initiated" ? "queued" : incoming;
  if (FINAL.has(inc)) return inc;
  if (!(inc in RANK)) return null;
  return RANK[inc] > (RANK[current] ?? 0) ? inc : null;
}

export function callSummary(status: string, duration: number | null, connected: boolean) {
  if (connected && duration) {
    const m = Math.floor(duration / 60), s = duration % 60;
    return `Call from FIT — connected ${m ? `${m}m ` : ""}${s}s`;
  }
  const label: Record<string, string> = { busy: "contact busy", "no-answer": "no answer", failed: "call failed", canceled: "canceled", completed: "not connected" };
  return `Call from FIT — ${label[status] ?? status}`;
}

export type StartCallDeps = {
  db: any; // service-role client
  fetch: typeof fetch;
  env: { sid?: string; token?: string; from?: string; staff?: string };
  now?: () => Date;
};
export type StartCallResult = { ok: true; firstName: string } | { ok: false; error: string; message: string };

const fail = (error: string, message: string): StartCallResult => ({ ok: false, error, message });

export async function startCallCore(deps: StartCallDeps, input: { contactId: string; opportunityId?: string | null; userId: string }): Promise<StartCallResult> {
  const { db, env } = deps;
  const now = deps.now?.() ?? new Date();
  if (!env.sid || !env.token || !env.from || !env.staff) return fail("not_configured", "Calling isn't set up yet.");
  const staff = toE164US(env.staff), from = toE164US(env.from);
  if (!staff || !from) return fail("not_configured", "Calling isn't set up yet.");

  const { data: c } = await db.from("leads").select("id, name, phone, contact_type, lead_type, status").eq("id", input.contactId).maybeSingle();
  if (!c) return fail("not_found", "Contact not found.");
  const type = (c.contact_type ?? "").toLowerCase();
  if (type === "spam" || c.lead_type === "spam" || (c.status ?? "").toLowerCase() === "spam" || type.startsWith("vendor"))
    return fail("blocked_type", "Calls are disabled for spam and vendor contacts.");
  const to = toE164US(c.phone);
  if (!to) return fail("invalid_phone", "This contact has no valid phone number.");
  if (to === staff || to === from) return fail("invalid_phone", "This contact has no valid phone number.");
  // Block only numbers the carrier reported as explicitly invalid (21211).
  // Landlines (21614/30006) and undelivered texts are still valid voice destinations.
  const { data: bad } = await db.from("sms_conversation_log").select("id").eq("lead_id", c.id).eq("error_code", "21211").limit(1);
  if (bad?.length) return fail("undeliverable", "This number was reported as invalid by the carrier.");

  if (input.opportunityId) {
    const { data: o } = await db.from("opportunities").select("id").eq("id", input.opportunityId).eq("contact_id", c.id).maybeSingle();
    if (!o) return fail("bad_opportunity", "Opportunity doesn't belong to this contact.");
  }

  // Expire abandoned active rows so a lost callback can't block calls forever.
  await db.from("crm_call_log").update({ status: "failed", error_message: "expired_no_callback", completed_at: now.toISOString() })
    .eq("contact_id", c.id).in("status", ACTIVE_STATUSES as unknown as string[]).lt("initiated_at", new Date(now.getTime() - STALE_MS).toISOString());

  // Claim: partial unique index allows one active call per contact (blocks double clicks / races).
  const { data: row, error: claimErr } = await db.from("crm_call_log")
    .insert({ contact_id: c.id, opportunity_id: input.opportunityId ?? null, initiated_by: input.userId, status: "initiating" })
    .select("id").single();
  if (claimErr || !row) return fail("already_calling", "A call to this contact is already in progress.");

  const base = `${CALL_PUBLIC_BASE}${CALL_WEBHOOK_PATH}`;
  const res = await deps.fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.sid}/Calls.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${env.sid}:${env.token}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: (() => {
      const p = new URLSearchParams({
        To: staff, From: from, Url: `${base}?step=connect&log=${row.id}`, Method: "POST",
        StatusCallback: `${base}?step=status&leg=staff&log=${row.id}`, StatusCallbackMethod: "POST",
        Record: "false", Timeout: "25",
      });
      for (const e of ["initiated", "ringing", "answered", "completed"]) p.append("StatusCallbackEvent", e);
      return p;
    })(),
  });
  if (!res.ok) {
    const text = await res.text();
    let code = String(res.status), msg = text.slice(0, 300);
    try { const j = JSON.parse(text); code = String(j.code ?? code); msg = j.message ?? msg; } catch { /* keep raw */ }
    await db.from("crm_call_log").update({ status: "failed", error_code: code, error_message: msg, completed_at: now.toISOString() }).eq("id", row.id);
    console.error(`[crm-call] Twilio rejected call [${res.status}]: ${text}`);
    const voice = ["21210", "21215", "13227", "21216"].includes(code);
    return fail("twilio_error", voice ? "The FIT number can't place this call (voice not enabled for this destination)." : "Twilio couldn't start the call. Try again or call personally.");
  }
  const j = (await res.json()) as { sid?: string };
  await db.from("crm_call_log").update({ twilio_call_sid: j.sid ?? null, status: "queued", updated_at: now.toISOString() }).eq("id", row.id);
  return { ok: true, firstName: firstName(c.name) };
}

/** Apply one Twilio status callback. Idempotent: regressions/finished rows ignored; one timeline entry per call. */
export async function applyStatusCallback(db: any, logId: string, leg: string, p: Record<string, string>, now = new Date()) {
  const { data: log } = await db.from("crm_call_log").select("*").eq("id", logId).maybeSingle();
  if (!log) return "unknown_log";
  const incoming = p.CallStatus ?? p.DialCallStatus ?? "";
  const patch: Record<string, unknown> = { updated_at: now.toISOString() };
  if (leg === "contact") {
    if (p.CallSid) patch.dial_call_sid = p.CallSid;
    if ((incoming === "in-progress" || incoming === "answered") && !log.answered_at) patch.answered_at = now.toISOString();
    if (incoming === "completed" && p.CallDuration) patch.duration_seconds = Number(p.CallDuration) || 0;
    if (["busy", "no-answer", "failed", "canceled"].includes(incoming) && !log.answered_at) patch.error_message = `contact_${incoming}`;
    if (Object.keys(patch).length > 1) await db.from("crm_call_log").update(patch).eq("id", logId);
    return "ok";
  }
  // Staff (parent) leg drives the overall status.
  const ns = nextStatus(log.status, incoming);
  if (!ns) return "ignored";
  patch.status = ns;
  if (p.ErrorCode) patch.error_code = p.ErrorCode;
  const final = ["completed", "busy", "failed", "canceled", "no-answer"].includes(ns);
  if (final) patch.completed_at = now.toISOString();
  // Overall result reflects the contact leg when the staff leg merely completed.
  if (ns === "completed" && !log.answered_at && log.error_message?.startsWith("contact_")) patch.status = log.error_message.slice(8);
  if (ns === "no-answer" || ns === "busy") patch.error_message = `staff_${ns}`;
  const { data: updated } = await db.from("crm_call_log").update(patch).eq("id", logId).eq("status", log.status).select("id");
  if (!updated?.length) return "ignored"; // concurrent callback already advanced it
  if (final) {
    const connected = !!log.answered_at;
    const status = patch.status as string;
    await db.from("contact_activity").insert({
      contact_id: log.contact_id, opportunity_id: log.opportunity_id,
      kind: connected ? "call" : "call_attempt", actor_id: log.initiated_by,
      summary: callSummary(status, log.duration_seconds, connected),
      idempotency_key: `crm_call:${logId}`,
      metadata: { call_log_id: logId, status, duration_seconds: log.duration_seconds, via: "twilio_bridge" },
    }); // unique idempotency_key rejects duplicates silently
  }
  return "ok";
}
