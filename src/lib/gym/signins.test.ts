import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { chicagoDaysSince, isInactiveMember } from "./signins";

const member = { contact_type: "Member", became_member: true, antaris_client_id: "5716" };
const now = new Date("2026-11-26T18:00:00Z");

describe("gym sign-in rules", () => {
  it("counts days on America/Chicago calendar, not UTC", () => {
    assert.equal(chicagoDaysSince("2026-11-26T05:30:00Z", new Date("2026-11-26T07:00:00Z")), 1);
  });
  it("flags an active member at 14 days without a scan", () => {
    assert.equal(isInactiveMember({ ...member, last_visit_at: "2026-11-12T18:00:00Z" }, now), true);
  });
  it("does not flag a member seen 13 days ago", () => {
    assert.equal(isInactiveMember({ ...member, last_visit_at: "2026-11-13T18:00:00Z" }, now), false);
  });
  it("does not flag prospects", () => {
    assert.equal(isInactiveMember({ ...member, contact_type: "Prospect", became_member: false, last_visit_at: null }, now), false);
  });
});
