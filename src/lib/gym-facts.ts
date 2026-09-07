// ============================================================================
// CANONICAL SOURCE OF TRUTH for approved gym facts + pricing.
//
// ⚠️  WARNING — MIRRORED DATA ⚠️
// supabase/functions/twilio-inbound-sms/index.ts runs in Deno and cannot
// import from src/, so it mirrors APPROVED_CONTEXT inline. If you change
// anything in this file you MUST make the identical change in the
// "APPROVED CONTEXT (mirror of src/lib/gym-facts.ts)" block of that file and
// redeploy it, or the texting assistant and the Staff Portal page will drift.
//
// Everything the SMS assistant is allowed to state as fact lives here.
// Anything NOT in this file must be escalated to staff, never guessed.
// ============================================================================

export const APPROVED_FACTS = {
  name: "FIT Beyond Plus",
  address: "449 W Lincoln St, Tullahoma, TN 37388",
  phone: "(931) 222-4449",
  email: "info@fitbeyondplus.com",
  website: "https://fitbeyondplus.com",
  staffedHours: [
    "Monday–Friday: 9:00am – 8:00pm (staffed)",
    "Saturday: 9:00am – 6:00pm (staffed)",
    "Sunday: 10:00am – 5:00pm (staffed)",
  ],
  access: "Members get 24/7 keycard access, every day of the year.",
  amenities: [
    "Locker rooms and showers",
    "Sauna",
    "Tanning beds (included with every gym membership)",
    "Full strength and free-weight floor",
    "Cardio equipment",
    "Functional / turf training area",
    "13,500 sq ft facility",
  ],
  programs: [
    "All group fitness classes included with membership (schedule: fitbeyondplus.com/classes)",
    "Kickboxing — adults and kids",
    "Brazilian Jiu-Jitsu — adults and kids",
    "Personal training and athlete performance training",
  ],
  perks: ["Free orientation session with every membership"],
} as const;

export const APPROVED_PRICING = {
  monthly: [
    { name: "Single", price: "$39/month" },
    { name: "Duo (2 adults)", price: "$59/month" },
    { name: "Duo +1 (3 adults)", price: "$69/month" },
    { name: "Family (up to 5 in the same household)", price: "$82/month" },
    { name: "Tanning only (no gym membership required)", price: "$25/month" },
  ],
  paidInFull: [
    { name: "Single — 1 week pass", price: "$35" },
    { name: "Single — 1 month", price: "$55" },
    { name: "Single — 3 months", price: "$123" },
    { name: "Single — 6 months", price: "$234" },
    { name: "Single — 1 year", price: "$449" },
    { name: "Duo — 1 year", price: "$660" },
    { name: "Duo +1 — 1 year", price: "$753" },
    { name: "Family — 1 year", price: "$914" },
  ],
  dayPass: { name: "Single-day pass", price: "$10" },
  discounts: [
    "Active military and first responders: 15% off. No other discounts exist.",
  ],
} as const;

/**
 * Annual fee policy — fully specified so the assistant never has to infer it.
 * Anything about the fee that is NOT stated here must be escalated.
 */
export const ANNUAL_FEE_POLICY = [
  "Amount: $49.99.",
  "Applies to: monthly memberships only (Single, Duo, Duo +1, Family monthly).",
  "When charged: billed once a year on July 1st.",
  "Exempt: all paid-in-full memberships (1 week, 1 month, 3 months, 6 months, 1 year, duo/family annual) — no annual fee.",
  "Exempt: short-term passes and the single-day pass — no annual fee.",
  "Exempt: tanning-only plan — no annual fee.",
  "Monthly memberships have no contract.",
  "Anything else about the annual fee (proration, refunds, waivers, timing exceptions, first-year handling) is NOT defined here — escalate instead of explaining it.",
] as const;

/** Renders the approved facts + pricing block that Claude receives verbatim. */
export function buildApprovedContext(): string {
  const p = APPROVED_PRICING;
  return `APPROVED GYM INFORMATION (the only facts you may state):
- Name: ${APPROVED_FACTS.name}
- Address: ${APPROVED_FACTS.address}
- Phone: ${APPROVED_FACTS.phone}
- Email: ${APPROVED_FACTS.email}
- Website: ${APPROVED_FACTS.website}
- Staffed hours:
${APPROVED_FACTS.staffedHours.map((h) => `  • ${h}`).join("\n")}
- Access: ${APPROVED_FACTS.access}
- Amenities:
${APPROVED_FACTS.amenities.map((a) => `  • ${a}`).join("\n")}
- Programs:
${APPROVED_FACTS.programs.map((a) => `  • ${a}`).join("\n")}
- Perks:
${APPROVED_FACTS.perks.map((a) => `  • ${a}`).join("\n")}

APPROVED PRICING TABLE (the only prices you may quote):
Monthly memberships:
${p.monthly.map((m) => `  • ${m.name}: ${m.price}`).join("\n")}
Paid-in-full options:
${p.paidInFull.map((m) => `  • ${m.name}: ${m.price}`).join("\n")}
Day pass:
  • ${p.dayPass.name}: ${p.dayPass.price}
Discounts:
${p.discounts.map((d) => `  • ${d}`).join("\n")}

ANNUAL FEE POLICY (explicit — never infer beyond this):
${ANNUAL_FEE_POLICY.map((l) => `  • ${l}`).join("\n")}

Anything not listed above — other discounts, promotions, payment plans, cancellation terms, contract exceptions, freezes, refunds — is NOT approved information. Never invent it. Say a staff member will confirm, and escalate.`;
}
