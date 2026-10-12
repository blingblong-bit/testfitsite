import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { deriveOperations, hasHumanContact, isHumanMessage, taskView, type OperationsData, type CrmTask } from "./operations";

const now = new Date("2026-10-12T15:25:00Z");
const contact = { id: "one", name: "Person", email: "", phone: null, contact_type: "Prospect", lead_type: "customer_lead", status: null, review_flag: false, tags: [], created_at: "2026-10-01T15:00:00Z", became_member: false, last_contact_method: null, next_follow_up_date: null } as unknown as OperationsData["contacts"][number];
const opportunity = { id: "opp", contact_id: "one", status: "open", stage: "New Lead", no_action_required: false, last_activity_at: "2026-10-01T15:00:00Z" } as OperationsData["opportunities"][number];
const message = { lead_id: "one", direction: "outbound", from_ai: false, metadata: { kind: "initial_lead_sms" }, created_at: "2026-10-12T15:00:00Z", status: "sent", delivery_status: "delivered" };
const base = (): OperationsData => ({ contacts: [contact], opportunities: [opportunity], tasks: [], appointments: [], referrals: [], messages: [], activity: [] });
const task = (props: Partial<CrmTask>): CrmTask => ({ id: "task", contact_id: "one", opportunity_id: "opp", title: "Follow up", due_at: null, completed_at: null, ...props }) as CrmTask;
describe("daily CRM operations", () => {
  it("keeps automated outreach distinct from human contact", () => {
    const data = base(); data.messages = [message];
    assert.equal(hasHumanContact(contact, data), false);
    assert.equal(deriveOperations(data, now).groups.new.length, 1);
    assert.equal(isHumanMessage({ ...message, metadata: { kind: "manual", sent_by: "staff" } }), true);
    assert.equal(isHumanMessage({ ...message, from_ai: true, metadata: { sent_by: "staff" } }), false);
    assert.equal(isHumanMessage({ ...message, metadata: { kind: "manual", test_mode: true } }), false);
    assert.equal(isHumanMessage({ ...message, delivery_status: "undelivered", metadata: { kind: "manual" } }), false);
    data.messages = [{ ...message, metadata: { kind: "manual" } }];
    assert.equal(deriveOperations(data, now).groups.new.length, 0);
    assert.equal(hasHumanContact({ ...contact, last_contact_method: "Text Message" }, base()), false);
    assert.equal(hasHumanContact({ ...contact, last_contact_method: "Phone Call" }, base()), true);
  });
  it("uses Chicago calendar days and keeps undated tasks upcoming", () => {
    assert.equal(taskView(task({ due_at: "2026-10-12T04:59:00Z" }), now), "Overdue");
    assert.equal(taskView(task({ due_at: "2026-10-12T05:00:00Z" }), now), "Due Today");
    assert.equal(taskView(task({ due_at: "2026-10-13T04:59:00Z" }), now), "Due Today");
    assert.equal(taskView(task({ due_at: "2026-10-13T05:00:00Z" }), now), "Upcoming");
    assert.equal(taskView(task({}), now), "Upcoming");
    assert.equal(taskView(task({ completed_at: now.toISOString() }), now), "Completed");
  });
  it("shows each contact once using overdue as the most urgent reason", () => {
    const data = base();
    data.tasks = [task({ due_at: "2026-10-10T15:00:00Z" }), task({ id: "two", due_at: "2026-10-12T16:00:00Z" })];
    const result = deriveOperations(data, now);
    assert.equal(result.groups.overdue.length, 1);
    assert.equal(result.groups.followups.length, 1);
    assert.equal(result.groups.stalled.length, 1);
    assert.equal(result.attention.length, 1);
    assert.equal(result.attention[0]?.reason, "overdue");
  });
  it("never creates tasks and excludes nurture, closed, held and spam from stalled", () => {
    for (const stage of ["Long-Term Nurture", "Joined — Won", "Closed — Lost"]) {
      const data = base(); data.opportunities = [{ ...opportunity, stage, status: stage === "Long-Term Nurture" ? "open" : stage.includes("Won") ? "won" : "lost" }];
      assert.equal(deriveOperations(data, now).groups.stalled.length, 0);
      assert.equal(data.tasks.length, 0);
    }
    for (const props of [{ review_flag: true }, { contact_type: "Spam" }, { name: "TEST Person" }, { lead_type: "spam" }]) {
      const data = base(); data.contacts = [{ ...contact, ...props }]; data.tasks = [task({ due_at: "2026-10-10T15:00:00Z" })];
      const result = deriveOperations(data, now);
      assert.equal(result.attention.length, 0); assert.equal(result.tasks.length, 0);
    }
  });
  it("only flags active trials with an explicit expiry within 48 hours", () => {
    const data = base();
    data.referrals = [{ lead_id: "one", promo_type: "free_week", status: "redeemed", access_ends_at: "2026-10-14T15:25:00Z", access_starts_at: "2026-10-08T15:00:00Z" } as OperationsData["referrals"][number]];
    assert.equal(deriveOperations(data, now).groups.trials.length, 1);
    data.referrals = [{ ...data.referrals[0], access_ends_at: "2026-10-14T15:25:01Z" } as OperationsData["referrals"][number]];
    assert.equal(deriveOperations(data, now).groups.trials.length, 0);
  });
  it("uses confirmed appointment time, not the obsolete requested time", () => {
    const data = base();
    data.appointments = [{ lead_id: "one", status: "confirmed", type: "Tour", requested_time: "2026-10-11T16:00:00Z", confirmed_time: "2026-10-12T19:00:00Z" } as OperationsData["appointments"][number]];
    assert.equal(deriveOperations(data, now).groups.appointments.length, 1);
    data.appointments[0].status = "canceled";
    assert.equal(deriveOperations(data, now).groups.appointments.length, 0);
  });
});