import { describe, expect, test } from "bun:test";
import { inSmartList, isTestOrSpam, matchesContactSearch, type DirectoryContact } from "./contact-directory";

const contact: DirectoryContact = { name: "Haleigh Woodcox", email: "", phone: "(931) 555-1234", contact_type: null, review_flag: true, lead_type: "customer_lead", status: null, tags: [] };
describe("read-only contact directory", () => {
  test("held contacts remain globally searchable and in Migration Review", () => {
    expect(inSmartList(contact, "review")).toBe(true);
    expect(inSmartList(contact, "all")).toBe(true);
    expect(matchesContactSearch(contact, "woodcox")).toBe(true);
    expect(matchesContactSearch(contact, "931-555-1234")).toBe(true);
    expect(matchesContactSearch(contact, "1234")).toBe(true);
  });
  test("test and legacy spam stay searchable without entering sales lists", () => {
    for (const c of [{ ...contact, name: "CRM TEST — Board Check", contact_type: "Prospect" }, { ...contact, name: "Legacy spam", lead_type: "spam" }]) {
      expect(isTestOrSpam(c)).toBe(true);
      expect(inSmartList(c, "all")).toBe(true);
      expect(inSmartList(c, "excluded")).toBe(true);
      expect(inSmartList(c, "prospects")).toBe(false);
      expect(matchesContactSearch(c, c.name)).toBe(true);
    }
  });
  test("contact relationship, not trial interest, defines membership lists", () => {
    expect(inSmartList({ ...contact, contact_type: "Prospect" }, "prospects")).toBe(true);
    expect(inSmartList({ ...contact, contact_type: "Member" }, "members")).toBe(true);
    expect(inSmartList(contact, "members")).toBe(false);
  });
});