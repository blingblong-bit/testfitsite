export type LeadType = "customer_lead" | "vendor_solicitation" | "spam";

export type Classification = {
  lead_type: LeadType;
  lead_score: number;
  should_notify: boolean;
  spam_reason: string | null;
};

const CUSTOMER_KEYWORDS = [
  "membership",
  "member",
  "join",
  "joining",
  "tour",
  "personal training",
  "pt ",
  "class",
  "classes",
  "kickbox",
  "jiu-jitsu",
  "jiu jitsu",
  "jiujitsu",
  "bjj",
  "pric",
  "cost",
  "rate",
  "hour",
  "open",
  "location",
  "address",
  "try a class",
  "drop in",
  "drop-in",
  "train",
  "training",
  "coach",
  "coaching",
  "facility",
  "access",
  "gym",
  "workout",
  "fitness",
  "tan",
  "sauna",
  "barre",
  "yoga",
  "hiit",
  "trx",
];

const VENDOR_KEYWORDS = [
  "seo",
  "search engine optimization",
  "web design",
  "website design",
  "website redesign",
  "redesign your",
  "app development",
  "mobile app",
  "marketing service",
  "digital marketing",
  "lead generation",
  "backlink",
  "back link",
  "google ranking",
  "rank on google",
  "rank higher",
  "first page of google",
  "page 1 of google",
  "social media management",
  "social media marketing",
  "smm",
  "advertising service",
  "ad campaign",
  "ppc",
  "google ads expert",
  "business loan",
  "merchant cash",
  "funding for your business",
  "crypto",
  "bitcoin",
  "forex",
  "investment opportunity",
  "guest post",
  "link building",
  "outreach",
  "increase your traffic",
  "increase traffic",
  "i can help your business",
  "grow your business online",
  "boost your sales",
  "boost your website",
  "white label",
  "outsourc",
  "offshore developer",
  "hire developer",
  "saas tool",
  "free audit",
  "website audit",
  "noticed your website",
  "visited your website",
  "checked your site",
  "your competitors are ranking",
];

const SPAM_PATTERNS = [
  /https?:\/\/\S+/gi, // urls
  /\b[a-z0-9.-]+\.(ru|cn|top|xyz|click|loan|tk)\b/gi,
  /(.)\1{6,}/i, // aaaaaaa
  /[^\s]{40,}/, // 40+ char no-space gibberish
];

function lower(s: string | null | undefined) {
  return (s ?? "").toLowerCase();
}

function countMatches(haystack: string, needles: string[]) {
  let n = 0;
  for (const w of needles) if (haystack.includes(w)) n++;
  return n;
}

// Exact domains from confirmed solicitations, not a blanket rule for business email.
const CONFIRMED_VENDOR_DOMAINS = new Set([
  "trustedvirtualteam.com", "getnorthernlightstudios.com", "vettedvas.com",
  "businesscoachvas.com", "vasdirect.com",
]);

// Look for the direction of the offer in the message itself. Form dropdowns
// are weak evidence: sellers routinely select "Book a tour" or "Membership".
const VENDOR_OFFERS = [
  /\b(?:we|i)\s+(?:can\s+|will\s+)?(?:build|create|redesign|automate)\b[\s\S]{0,100}\b(?:your|you|website|site|lead system|system)\b/i,
  /\b(?:we|i)\s+(?:offer|provide|give you|sell)\b[\s\S]{0,100}\b(?:virtual assistant|trained va|va services|marketing|seo|software|ai system|lead generation)\b/i,
  /\b(?:virtual assistant|trained va|va services|crm automation|lead system|website redesign|marketing services)\b[\s\S]{0,250}\b(?:for you|your business|your gym|reply yes|free trial|days (?:are )?free)\b/i,
  /\b(?:help|grow|boost|improve)\s+your\s+(?:business|website|traffic|sales|rankings)\b/i,
];

export function classifyLead(input: {
  name: string;
  email: string;
  phone?: string | null;
  message?: string | null;
  interest?: string | null;
}): Classification {
  const message = lower(input.message);
  const interest = lower(input.interest);
  const name = lower(input.name);
  const email = lower(input.email);
  const combined = `${interest} ${message}`;

  const domain = email.trim().split("@")[1] ?? "";
  const offer = VENDOR_OFFERS.some((pattern) => pattern.test(message));
  const messageVendorHits = countMatches(message, VENDOR_KEYWORDS);
  const messageCustomerHits = countMatches(message, CUSTOMER_KEYWORDS);
  if (CONFIRMED_VENDOR_DOMAINS.has(domain) || offer ||
      (messageVendorHits >= 1 && messageVendorHits > messageCustomerHits)) {
    return {
      lead_type: "vendor_solicitation",
      lead_score: -10 * Math.max(1, messageVendorHits),
      should_notify: false,
      spam_reason: CONFIRMED_VENDOR_DOMAINS.has(domain)
        ? "confirmed solicitation domain" : "business service sales pitch",
    };
  }

  // --- Spam checks ---
  const reasons: string[] = [];

  // Email is optional on the forms now — only suspicious when there's no
  // way to reach the person at all.
  if (!input.name?.trim() || (!input.email?.trim() && !input.phone?.trim())) {
    reasons.push("empty required fields");
  }

  const urlMatches = message.match(/https?:\/\/\S+/gi) ?? [];
  if (urlMatches.length >= 2) reasons.push("multiple suspicious links");

  for (const re of SPAM_PATTERNS.slice(1)) {
    if (re.test(message)) {
      reasons.push("suspicious text pattern");
      break;
    }
  }

  // Obvious fake name: digits, all consonants, or repeated chars
  if (/\d{3,}/.test(name) || /(.)\1{4,}/.test(name)) {
    reasons.push("fake-looking name");
  }

  // Disposable / suspicious email domains
  if (/@(mailinator|tempmail|guerrillamail|10minutemail|yopmail|trashmail)\./.test(email)) {
    reasons.push("disposable email");
  }

  const vendorHits = countMatches(combined, VENDOR_KEYWORDS);
  const customerHits = countMatches(combined, CUSTOMER_KEYWORDS);

  // --- Vendor solicitation ---
  if (vendorHits >= 1 && vendorHits > customerHits) {
    return {
      lead_type: "vendor_solicitation",
      lead_score: -10 * vendorHits,
      should_notify: false,
      spam_reason: `vendor keywords: ${vendorHits}`,
    };
  }

  // --- Spam ---
  if (
    reasons.length >= 2 ||
    (reasons.length >= 1 && customerHits === 0 && message.length > 0 && interest.length === 0)
  ) {
    return {
      lead_type: "spam",
      lead_score: -5,
      should_notify: false,
      spam_reason: reasons.join("; "),
    };
  }

  // --- Default: customer lead ---
  // Be permissive — if uncertain, treat as customer.
  return {
    lead_type: "customer_lead",
    lead_score: 10 + customerHits * 2,
    should_notify: true,
    spam_reason: null,
  };
}
