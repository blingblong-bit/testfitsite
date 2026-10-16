import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { classifyLead } from "./lead-classifier";

const classify = (message: string, interest = "Book a tour", email = "person@example.com") =>
  classifyLead({ name: "Local Person", email, phone: "9315551234", interest, message });

describe("vendor solicitation filtering", () => {
  it("blocks Anna's VA/AI offer despite tour interest", () => {
    const result = classify("We give you a trained VA who operates our custom AI system for you. You hand off the admin, CRM, follow-ups, and processes. Your first 30 days are free! Reply YES.");
    assert.equal(result.lead_type, "vendor_solicitation");
    assert.equal(result.should_notify, false);
  });
  it("blocks Paige's lead-system pitch despite customer keywords", () => {
    const result = classify("We build a full lead system, not just a website. We build you a new site where leads book an appointment or a call. Happy members get an automatic Google review ask. One monthly price covers all of it.", "Membership question");
    assert.equal(result.lead_type, "vendor_solicitation");
    assert.equal(result.should_notify, false);
  });
  it("blocks confirmed vendor domains even for phone-only messages", () => {
    for (const domain of ["trustedvirtualteam.com", "getnorthernlightstudios.com", "vettedvas.com", "businesscoachvas.com", "vasdirect.com"]) {
      assert.equal(classify("2245995483", "Book a tour", `seller@${domain}`).lead_type, "vendor_solicitation");
    }
  });
  it("does not block real prospects for mentioning their work", () => {
    for (const message of ["I work in marketing and want to join your gym.", "I'm a virtual assistant looking for membership pricing.", "I'm a software developer. Can I book a tour?", "One pass member and questions about classes and how to access the gym", "Do you offer personal training? I want to build strength."]) {
      assert.equal(classify(message).lead_type, "customer_lead");
      assert.equal(classify(message).should_notify, true);
    }
  });
  it("allows an unfamiliar business domain without pitch evidence", () => {
    assert.equal(classify("I'd like to try BJJ", "Classes", "person@localbusiness.com").lead_type, "customer_lead");
    assert.equal(classify("9315551234").lead_type, "customer_lead");
  });
  it("recognizes direct website/SEO sales offers without a known domain", () => {
    assert.equal(classify("We can redesign your website and improve your rankings.", "Membership question").lead_type, "vendor_solicitation");
  });
});