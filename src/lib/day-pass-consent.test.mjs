import { describe, expect, test } from "bun:test";
import { DayPassConsentSchema, dayPassTextPreferences } from "./day-pass-consent";

describe("day pass waiver and text choice", () => {
  test("accepts a waived day pass when texts are declined", () => {
    expect(DayPassConsentSchema.parse({ waiver_accepted: true, sms_consent: false }).sms_consent).toBe(false);
  });
  test("requires waiver acceptance", () => {
    expect(DayPassConsentSchema.safeParse({ waiver_accepted: false, sms_consent: true }).success).toBe(false);
  });
  test("requires an explicit text choice", () => {
    expect(DayPassConsentSchema.safeParse({ waiver_accepted: true }).success).toBe(false);
  });
  test("declining texts stops customer texting", () => {
    expect(dayPassTextPreferences(false)).toEqual({ sms_opted_out: true, sequence_status: "opted_out" });
  });
  test("a public day pass never clears an existing opt-out", () => {
    expect(dayPassTextPreferences(true, true)).toEqual({ sms_opted_out: true, sequence_status: "opted_out" });
  });
  test("accepting texts does not change existing sequence state", () => {
    expect(dayPassTextPreferences(true)).toEqual({ sms_opted_out: false });
  });
});