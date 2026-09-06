// Shared AI reply rules for inbound SMS.
//
// The edge function supabase/functions/twilio-inbound-sms/index.ts mirrors
// these constants inline (separate Deno runtime, cannot import from src/).
// Keep the two in sync.

export type InquiryType =
  | "pricing"
  | "schedule_classes"
  | "membership_options"
  | "day_pass_tour"
  | "complaint_frustrated"
  | "general_info"
  | "operational";

/** Lightweight keyword/regex classifier for inbound SMS inquiries. */
export function classifyInquiry(body: string): InquiryType {
  const lower = body.toLowerCase();

  // Operational / right-now gym conditions are escalated before the AI is called.
  if (
    /(out of order|not working|isn'?t working|doesn'?t work|broken|broke down|fixed yet|repaired|shut off|turned off|temporarily)/.test(
      lower,
    ) ||
    /(tanning|sauna|shower|locker|bathroom|restroom|towel|machine|treadmill|bike|rower|equipment|weights?|door|wifi|ac\b|air condition|heat(er)?\b|parking)/.test(
      lower,
    ) ||
    /(class(es)? (today|tonight|canceled|cancelled)|is (there|the) .*class|who'?s teaching|instructor (there|today))/.test(
      lower,
    ) ||
    /(are (you|y'?all|we) open|you open (today|now|right now)|closed (today|now)|what time do you (open|close)|open (today|right now))/.test(
      lower,
    ) ||
    /(lost|left) (my|a|an) /i.test(lower) ||
    /found my/i.test(lower) ||
    /(dirty|filthy|messy|smell|gross|nobody was|no one was)/i.test(lower)
  ) {
    return "operational";
  }

  if (
    /\b(price|pricing|cost|how much|rate|membership fee|monthly|annual|pay|payment|discount|deal|offer)\b/i.test(
      lower,
    )
  ) {
    return "pricing";
  }

  if (
    /\b(class|classes|schedule|when.*(class|kickbox|bjj|yoga|barre|hiit)|what time|today|tonight|tomorrow|instructor|teacher|coach.*class)\b/i.test(
      lower,
    )
  ) {
    return "schedule_classes";
  }

  if (
    /\b(membership|join|joining|sign up|contract|commit|silver and fit|family|duo|single|couple|plan)\b/i.test(
      lower,
    )
  ) {
    return "membership_options";
  }

  if (
    /\b(day pass|drop in|drop-in|tour|visit|come in|stop by|check out|try.*(gym|class|day)|free week|free pass)\b/i.test(
      lower,
    )
  ) {
    return "day_pass_tour";
  }

  if (
    /\b(angry|pissed|frustrat|disappoint|terrible|awful|horrible|unhappy|complaint|complain|cancel.*membership|quit|refund|bad experience|worst|ridiculous|unacceptable)\b/i.test(
      lower,
    )
  ) {
    return "complaint_frustrated";
  }

  return "general_info";
}

/** Placeholder used in the playbook; replaced with the actual lead UUID in the edge function. */
export const LEAD_ID_PLACEHOLDER = "{{lead_id}}";

/** Base response playbook rendered in the staff reference page and mirrored into the SMS prompt. */
export const RESPONSE_PLAYBOOK = `Response playbook — match the customer's inquiry type:

PRICING
- Never quote exact prices, fees, or percentages.
- Example: "I'd love to have someone walk you through the options and exact pricing — want me to set up a quick tour or call?"
- Always set needs_human: true.

SCHEDULE / CLASSES
- General schedule: point to fitbeyondplus.com/classes.
- Same-day "is X running?" / "who's teaching?": say you'll have someone confirm and get back to them.
- Example: "I'll have someone confirm today's schedule and get back to you."
- Always set needs_human: true for same-day or instructor questions.

MEMBERSHIP OPTIONS
- Mention we offer single, duo, family, 3-month paid-in-full, 12-month paid-in-full, and Silver and Fit.
- Example: "We have several membership options depending on what fits you best. Want me to have someone reach out with details?"
- Set needs_human: true if they ask for specific terms, cancellation policy, or account changes.

DAY PASS / TOUR / FREE VISIT
- Use the personalized scheduling link: fitbeyondplus.com/schedule-visit?lead=${LEAD_ID_PLACEHOLDER}
- Example: "You can grab a day pass or book a tour at fitbeyondplus.com/schedule-visit?lead=${LEAD_ID_PLACEHOLDER} — it's already pre-filled with your info."
- Do not try to book a specific time yourself.

COMPLAINT / FRUSTRATED
- Apologize briefly and sincerely. Do not defend, explain, or argue.
- Set needs_human: true and reply: null.

GENERAL INFO
- Keep it warm, short, and helpful. One to three sentences.
- If you don't know or would need real-time info, set needs_human: true instead of guessing.

OPERATIONAL
- You should not see this; operational questions are handled before you are called.
- If present, set needs_human: true and reply: null.`;

/** Replace the placeholder with a real lead UUID. */
export function playbookForLead(playbook: string, leadId: string): string {
  return playbook.replaceAll(LEAD_ID_PLACEHOLDER, leadId);
}
