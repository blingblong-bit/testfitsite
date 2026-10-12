// @ts-nocheck -- bun:test types are not installed; run with `bun test`.
import { describe, it, expect, mock } from "bun:test";
import { createHmac } from "crypto";
import { startCallCore, applyStatusCallback, toE164US, verifyTwilioSignature, nextStatus, connectTwiml } from "./calls.server";

// Minimal in-memory Supabase-like mock.
function mockDb(tables: Record<string, any[]>) {
  const q = (name: string) => {
    let rows = () => tables[name] ?? (tables[name] = []);
    const filters: ((r: any) => boolean)[] = [];
    let op: "select" | "update" | "insert" = "select", payload: any, returnRows = false, lim = Infinity;
    const run = () => {
      if (op === "insert") {
        const r = { id: crypto.randomUUID(), initiated_at: new Date().toISOString(), ...payload };
        if (name === "crm_call_log" && rows().some((x) => x.contact_id === r.contact_id && ["initiating","queued","ringing","in-progress"].includes(x.status)))
          return { data: null, error: { code: "23505" } };
        if (name === "contact_activity" && rows().some((x) => x.idempotency_key === r.idempotency_key)) return { data: null, error: { code: "23505" } };
        rows().push(r); return { data: r, error: null };
      }
      const hit = rows().filter((r) => filters.every((f) => f(r))).slice(0, lim);
      if (op === "update") { hit.forEach((r) => Object.assign(r, payload)); return { data: returnRows ? hit : null, error: null }; }
      return { data: hit, error: null };
    };
    const b: any = {
      select: () => { if (op === "select") op = "select"; else returnRows = true; return b; },
      update: (p: any) => { op = "update"; payload = p; return b; },
      insert: (p: any) => { op = "insert"; payload = p; return b; },
      eq: (k: string, v: any) => { filters.push((r) => r[k] === v); return b; },
      in: (k: string, v: any[]) => { filters.push((r) => v.includes(r[k])); return b; },
      lt: (k: string, v: any) => { filters.push((r) => r[k] < v); return b; },
      limit: (n: number) => { lim = n; return b; },
      maybeSingle: async () => { const r = run(); return { data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: r.error }; },
      single: async () => { const r = run(); return { data: Array.isArray(r.data) ? r.data[0] : r.data, error: r.error }; },
      then: (res: any, rej: any) => Promise.resolve(run()).then(res, rej),
    };
    return b;
  };
  return { from: q, tables };
}
const env = { sid: "AC1", token: "tok", from: "+19315550100", staff: "9314342243" };
const okFetch = () => mock(async () => new Response(JSON.stringify({ sid: "CA1" }), { status: 201 }));
const lead = (o: any = {}) => ({ id: "c1", name: "Jane Doe", phone: "(931) 555-0199", contact_type: "Prospect", ...o });

describe("Call from FIT", () => {
  it("validates phones", () => {
    expect(toE164US("(931) 555-0199")).toBe("+19315550199");
    expect(toE164US("123")).toBeNull();
    expect(toE164US("0315550199")).toBeNull();
  });
  it("starts a call, staff phone first, never exposing secrets in result", async () => {
    const db = mockDb({ leads: [lead()] }); const f = okFetch();
    const r = await startCallCore({ db, fetch: f as any, env }, { contactId: "c1", userId: "u1" });
    expect(r).toEqual({ ok: true, firstName: "Jane" });
    const body = (f.mock.calls[0] as any)[1].body as URLSearchParams;
    expect(body.get("To")).toBe("+19314342243"); expect(body.get("From")).toBe("+19315550100");
    expect(body.get("Record")).toBe("false");
    expect(JSON.stringify(r)).not.toContain("4342243");
    expect(db.tables.crm_call_log[0]).toMatchObject({ status: "queued", twilio_call_sid: "CA1" });
  });
  it("blocks duplicate clicks while a call is active", async () => {
    const db = mockDb({ leads: [lead()] }); const f = okFetch();
    await startCallCore({ db, fetch: f as any, env }, { contactId: "c1", userId: "u1" });
    const r2 = await startCallCore({ db, fetch: f as any, env }, { contactId: "c1", userId: "u1" });
    expect(r2.ok).toBe(false); expect(f).toHaveBeenCalledTimes(1);
  });
  it("rejects spam, vendor, malformed and carrier-invalid numbers", async () => {
    for (const [l, sms] of [[lead({ contact_type: "Spam" }), []], [lead({ contact_type: "Vendor/Non-Sales" }), []], [lead({ phone: "555" }), []], [lead(), [{ lead_id: "c1", error_code: "21211" }]]] as any) {
      const f = okFetch();
      const r = await startCallCore({ db: mockDb({ leads: [l], sms_conversation_log: sms }), fetch: f as any, env }, { contactId: "c1", userId: "u1" });
      expect(r.ok).toBe(false); expect(f).not.toHaveBeenCalled();
    }
  });
  it("allows landlines and numbers with undelivered texts", async () => {
    for (const code of ["21614", "30006", "30003"]) {
      const db = mockDb({ leads: [lead()], sms_conversation_log: [{ lead_id: "c1", error_code: code }] });
      const f = okFetch();
      const r = await startCallCore({ db, fetch: f as any, env }, { contactId: "c1", userId: "u1" });
      expect(r.ok).toBe(true); expect(f).toHaveBeenCalledTimes(1);
    }
  });
  it("records Twilio failures gracefully", async () => {
    const db = mockDb({ leads: [lead()] });
    const f = mock(async () => new Response(JSON.stringify({ code: 21215, message: "not permitted" }), { status: 400 }));
    const r = await startCallCore({ db, fetch: f as any, env }, { contactId: "c1", userId: "u1" });
    expect(r.ok).toBe(false); expect(db.tables.crm_call_log[0]).toMatchObject({ status: "failed", error_code: "21215" });
  });
  it("callbacks are idempotent and log one timeline entry", async () => {
    const db = mockDb({ crm_call_log: [{ id: "L1", contact_id: "c1", opportunity_id: null, initiated_by: "u1", status: "queued", answered_at: null, duration_seconds: null, error_message: null }] });
    await applyStatusCallback(db, "L1", "staff", { CallStatus: "in-progress" });
    await applyStatusCallback(db, "L1", "contact", { CallStatus: "in-progress", CallSid: "CA2" });
    await applyStatusCallback(db, "L1", "contact", { CallStatus: "completed", CallDuration: "75" });
    await applyStatusCallback(db, "L1", "staff", { CallStatus: "ringing" }); // regression ignored
    await applyStatusCallback(db, "L1", "staff", { CallStatus: "completed" });
    await applyStatusCallback(db, "L1", "staff", { CallStatus: "completed" }); // retry
    expect(db.tables.crm_call_log[0].status).toBe("completed");
    expect(db.tables.contact_activity).toHaveLength(1);
    expect(db.tables.contact_activity[0]).toMatchObject({ kind: "call", summary: "Call from FIT — connected 1m 15s" });
  });
  it("unanswered contact is recorded as no-answer attempt", async () => {
    const db = mockDb({ crm_call_log: [{ id: "L1", contact_id: "c1", status: "in-progress", answered_at: null, duration_seconds: null, error_message: null }] });
    await applyStatusCallback(db, "L1", "contact", { CallStatus: "no-answer" });
    await applyStatusCallback(db, "L1", "staff", { CallStatus: "completed" });
    expect(db.tables.crm_call_log[0].status).toBe("no-answer");
    expect(db.tables.contact_activity[0].kind).toBe("call_attempt");
  });
  it("verifies Twilio signatures and builds safe TwiML", () => {
    const url = "https://fitbeyondplus.com/api/public/webhooks/crm-call?step=status&log=x";
    const p = { CallStatus: "completed", CallSid: "CA1" };
    const sig = createHmac("sha1", "tok").update(url + "CallSidCA1CallStatuscompleted").digest("base64");
    expect(verifyTwilioSignature(url, p, sig, "tok")).toBe(true);
    expect(verifyTwilioSignature(url, p, sig, "bad")).toBe(false);
    expect(nextStatus("completed", "ringing")).toBeNull();
    const x = connectTwiml("+19315550199", "+19315550100", "https://x/?a=1&b=2");
    expect(x).toContain('callerId="+19315550100"'); expect(x).toContain("&amp;"); expect(x).not.toMatch(/<Record|<Gather/);
  });
});
