// @ts-nocheck
import { describe, expect, test } from "bun:test";
import { pickTourOpportunity } from "./tour-stage";
const o = (stage: string, status = "open", interest = "Membership", created_at = "2026-10-01") => ({ id: stage, stage, status, interest, created_at });
describe("pickTourOpportunity", () => {
  test("advances early stages", () => expect(pickTourOpportunity([o("Attempting Contact")], "Membership")?.id).toBe("Attempting Contact"));
  test("never moves later stages", () => expect(pickTourOpportunity([o("Decision and Follow-Up")], null)).toBeNull());
  test("never touches won/lost", () => expect(pickTourOpportunity([o("Joined — Won", "won")], null)).toBeNull());
  test("prefers matching interest", () => expect(pickTourOpportunity([o("Engaged", "open", "Classes", "2026-10-05"), o("New Lead")], "Membership")?.id).toBe("New Lead"));
});
