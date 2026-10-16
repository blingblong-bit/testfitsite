import { describe, it as test } from "node:test";
import { strict as assert } from "node:assert";
import { inSmartList, isTestOrSpam, isVendor, matchesContactSearch, type DirectoryContact } from "./contact-directory";

const contact: DirectoryContact = { name: "Haleigh Woodcox", email: "", phone: "(931) 555-1234", contact_type: null, review_flag: true, lead_type: "customer_lead", status: null, tags: [] };
const expect = (actual: unknown) => ({ toBe: (expected: unknown) => assert.equal(actual, expected) });
describe("read-only contact directory", () => {
  test("vendors remain searchable in their directory list, not sales results", () => {
    const vendor = { ...contact, name: "Anna Lussier", contact_type: "Vendor/Non-Sales", lead_type: "vendor_solicitation" };
    assert.equal(isVendor(vendor), true);
    assert.equal(isVendor({ ...vendor, contact_type: "Prospect" }), true);
    assert.equal(isVendor(contact), false);
    assert.equal(inSmartList(vendor, "vendors"), true);
    assert.equal(inSmartList(vendor, "prospects"), false);
    assert.equal(matchesContactSearch(vendor, "Anna"), true);
  });
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