// Shared copy for the automated lead follow-up (drip) and post-visit texts.
//
// Fixed templates — no AI generation — but selected by what the lead actually
// asked about, so a kickboxing lead hears about kickboxing and a BJJ parent
// hears about the kids program. Raw form text is NEVER spliced into a
// sentence; anything we don't recognize falls back to the general copy.
//
// supabase/functions/process-lead-followups/index.ts mirrors this file inline
// (separate Deno runtime, cannot import from src/). Keep the two in sync.

export type LeadCategory =
  | "kickboxing"
  | "bjj_kids"
  | "bjj"
  | "personal_training"
  | "classes"
  | "weight_loss"
  | "day_pass"
  | "referral"
  | "general";

export function firstName(name: string | null | undefined): string {
  if (!name) return "there";
  return name.trim().split(/\s+/)[0] || "there";
}

/** Map a lead's free-text interest + source onto a known copy category. */
export function categorizeLead(
  interest: string | null | undefined,
  source: string | null | undefined,
): LeadCategory {
  const t = `${interest ?? ""}`.toLowerCase();
  const s = `${source ?? ""}`.toLowerCase();

  const has = (...words: string[]) => words.some((w) => t.includes(w));

  if (has("kickbox", "muay thai", "striking")) return "kickboxing";
  if (has("bjj", "jiu", "jujitsu", "jiu-jitsu", "grappl", "wrestl")) {
    return has("kid", "child", "son", "daughter", "youth", "teen") ? "bjj_kids" : "bjj";
  }
  if (has("kid", "child", "youth", "teen")) return "bjj_kids";
  if (has("personal train", "pt", "one on one", "1 on 1", "trainer", "coach")) {
    return "personal_training";
  }
  if (has("class", "group", "yoga", "barre", "hiit", "cardio class")) return "classes";
  if (has("weight", "lose", "loss", "tone", "shape", "fat", "get fit", "get in shape")) {
    return "weight_loss";
  }
  if (has("day pass", "drop in", "drop-in", "visit", "tour")) return "day_pass";

  if (s === "day_pass_walkin") return "day_pass";
  if (s === "referral_day_pass" || s.includes("referral")) return "referral";

  return "general";
}

// What we highlight for each category. Kept short — these land mid-text.
const HOOK: Record<LeadCategory, string> = {
  kickboxing: "our kickboxing classes are honestly the most fun way to get in shape here",
  bjj_kids: "our kids Brazilian Jiu-Jitsu classes are a great fit for building confidence",
  bjj: "our adult Brazilian Jiu-Jitsu classes run several nights a week, beginners welcome",
  personal_training: "our trainers build you a real plan instead of guessing",
  classes: "our group classes make it easy to show up and just follow along",
  weight_loss: "most people see the biggest change once they have a real plan to follow",
  day_pass: "you're welcome to come use the gym anytime and see how it feels",
  referral: "your friend already knows how good it is in here",
  general: "we'll help you figure out the right starting point",
};

// What we invite them to for each category.
const INVITE: Record<LeadCategory, string> = {
  kickboxing: "come try a kickboxing class on us",
  bjj_kids: "bring them by to watch or try a kids class",
  bjj: "come try a BJJ class on us",
  personal_training: "come in for a free walkthrough with one of our trainers",
  classes: "come try a class on us",
  weight_loss: "come in for a quick walkthrough and we'll map out a plan",
  day_pass: "come by for a free visit",
  referral: "come by for your free visit",
  general: "come by for a free visit",
};

export type CopyLead = {
  name?: string | null;
  interest?: string | null;
  source?: string | null;
  message?: string | null;
};

// ---------------------------------------------------------------------------
// Purchase intent. A lead who already said they want to join or asked about
// membership pricing is NOT sent backward with a free-visit offer. Buying
// intent always wins over secondary topics: "a membership for BJJ" or "I want
// to join, do you have showers?" is still a buying lead.
// ---------------------------------------------------------------------------

export type LeadIntent = "buying" | "exploratory";
export type MembershipPlan =
  | "single"
  | "duo"
  | "duo_plus_one"
  | "family"
  | "annual"
  | null;

// Unambiguous "I want to buy" language.
const STRONG_BUYING = [
  "want a membership",
  "want to get a membership",
  "get a membership",
  "buy a membership",
  "start a membership",
  "need a membership",
  "looking for a membership",
  "interested in a membership",
  "interested in a single",
  "interested in membership",
  "membership for",
  "want to join",
  "ready to join",
  "like to join",
  "interested in joining",
  "how do i join",
  "want to sign up",
  "how do i sign up",
  "how to sign up",
  "ready to sign up",
  "sign me up",
  "sign up",
  "become a member",
  "ready to start",
];

// Membership/pricing language that means buying unless they also said they
// just want to look around first.
const WEAK_BUYING = [
  "membership",
  "memberships",
  "how much",
  "pricing",
  "price",
  "prices",
  "cost",
  "monthly rate",
  "rates",
];

// Explicitly exploratory: wants to see the place before deciding.
const EXPLORATORY = [
  "just looking",
  "just curious",
  "just wondering",
  "not sure",
  "browsing",
  "checking out",
  "check it out",
  "check the gym out",
  "see the gym",
  "look around",
  "tour",
  "day pass",
  "drop in",
  "drop-in",
  "try a",
  "try out",
  "try the gym",
  "free visit",
  "comparing",
  "shopping around",
];

/** Buying vs exploratory, from the lead's own words. */
export function detectIntent(
  interest: string | null | undefined,
  message?: string | null,
): LeadIntent {
  const t = `${interest ?? ""} ${message ?? ""}`.toLowerCase();
  const has = (words: string[]) => words.some((w) => t.includes(w));

  if (has(STRONG_BUYING)) return "buying";
  if (has(EXPLORATORY)) return "exploratory";
  if (has(WEAK_BUYING)) return "buying";
  return "exploratory";
}

/** Which plan they named, if any. */
export function detectPlan(
  interest: string | null | undefined,
  message?: string | null,
): MembershipPlan {
  const t = `${interest ?? ""} ${message ?? ""}`.toLowerCase();
  const has = (...w: string[]) => w.some((x) => t.includes(x));

  if (has("paid in full", "paid-in-full", "annual", "for a year", "1 year", "one year", "yearly")) {
    return "annual";
  }
  if (has("family")) return "family";
  if (has("duo +1", "duo+1", "duo plus", "three adult", "3 adult")) return "duo_plus_one";
  if (has("duo", "couple", "two adult", "2 adult", "my wife", "my husband", "my spouse")) {
    return "duo";
  }
  if (has("single", "just me", "myself only", "individual")) return "single";
  return null;
}

// Approved pricing only — mirrors APPROVED_PRICING in src/lib/gym-facts.ts.
export function membershipPriceSentence(plan: MembershipPlan): string {
  switch (plan) {
    case "single":
      return "Single memberships are $39/month.";
    case "duo":
      return "Duo memberships (2 adults) are $59/month.";
    case "duo_plus_one":
      return "Duo +1 (3 adults) is $69/month.";
    case "family":
      return "Family memberships are $82/month for up to 5 in the same household.";
    case "annual":
      return "A paid-in-full year is $449 for a single membership.";
    default:
      return "Monthly memberships start at $39.";
  }
}

/** Drip step (1-4). Returns the exact SMS body to send. */
export function buildFollowupMessage(step: number, lead: CopyLead): string {
  const fn = firstName(lead.name);
  const cat = categorizeLead(lead.interest, lead.source);
  const hook = HOOK[cat];
  const invite = INVITE[cat];

  if (detectIntent(lead.interest, lead.message) === "buying") {
    const price = membershipPriceSentence(detectPlan(lead.interest, lead.message));
    switch (step) {
      case 1:
        return `Hey ${fn}, following up on getting you set up at FIT Beyond Plus. ${price} Want me to have everything ready when you come in?`;
      case 2:
        return `${fn}, whenever you're ready we can get your membership going — it only takes a few minutes at the front desk. What day works for you to come in?`;
      case 3:
        return `${fn}, still glad to get you signed up at FIT Beyond Plus. Just tell me a day and time and we'll have it ready for you.`;
      default:
        return `${fn}, last check-in from me — if you still want to get started at FIT Beyond Plus, just reply here. ${price}`;
    }
  }

  switch (step) {
    case 1:
      return `Hey ${fn}, just making sure you saw my message! We'd love to have you check out FIT Beyond Plus — ${invite} whenever it works for you. Still interested? 💪`;
    case 2:
      return `${fn}, no pressure at all — but if you want to see the place for yourself, say the word and I'll ${invite === "come by for a free visit" ? "get you set up with a free visit" : `set you up to ${invite}`}. Takes about 15 minutes, zero obligation.`;
    case 3:
      return `${fn}, ${hook}. That's kind of our thing at FIT Beyond Plus. Whenever you're ready, we've got you.`;
    default:
      return `${fn}, let's make this easy — ${invite} and see how it feels for yourself. No pressure either way. Just reply and I'll get you set up.`;
  }
}

/** The first text a brand-new lead gets. */
export function buildFirstMessage(lead: CopyLead): string {
  const fn = firstName(lead.name);
  const src = (lead.source ?? "").toLowerCase();
  const topic = `${lead.interest ?? ""} ${lead.message ?? ""}`.toLowerCase();

  if (src === "day_pass_walkin") {
    return `Hey ${fn}! Thanks for coming in to FIT Beyond Plus today 🎟️ Hope you're loving the gym so far. Let us know if you have any questions — we're happy to help you get set up with a membership whenever you're ready!`;
  }

  // Buying intent wins over every topic branch below.
  if (detectIntent(lead.interest, lead.message) === "buying") {
    const price = membershipPriceSentence(detectPlan(lead.interest, lead.message));
    return `Hey ${fn}! This is FIT Beyond Plus — thanks for reaching out about a membership. ${price} Would you like to come by and get set up?`;
  }

  if (src.includes("referral") || src.includes("day_pass") || src.includes("day pass")) {
    return `Hey ${fn}! FIT Beyond Plus here — heard you got referred to us, awesome! Want to swing by on a free day pass so we can show you around? 💪`;
  }
  if (topic.includes("personal") || topic.includes("training")) {
    return `Hey ${fn}! This is FIT Beyond Plus in Tullahoma — got your note about personal training. Want to swing by for a free day pass so we can show you around and talk goals? 💪`;
  }
  if (topic.includes("kick")) {
    return `Hey ${fn}! FIT Beyond Plus here — thanks for the interest in kickboxing! Happy to get you a free day pass so you can try a class. When works for you? 🥊`;
  }
  if (topic.includes("bjj") || topic.includes("jiu")) {
    return `Hey ${fn}! FIT Beyond Plus here — thanks for reaching out about BJJ. Happy to grab you a free day pass so you can come try a class. When works for you?`;
  }
  if (topic.includes("class")) {
    return `Hey ${fn}! FIT Beyond Plus here — thanks for reaching out about our classes. Happy to grab you a free day pass so you can try one out. When works for you? 💪`;
  }
  return `Hey ${fn}! This is FIT Beyond Plus in Tullahoma — thanks for reaching out! Want to come check us out on a free day pass? Just reply and we'll get you set up 💪`;
}

/** Post-visit step (1-2) for day-pass walk-ins and referral day passes. */
export function buildPostvisitMessage(step: number, lead: CopyLead): string {
  const fn = firstName(lead.name);
  const cat = categorizeLead(lead.interest, lead.source);
  const referral = (lead.source ?? "").toLowerCase().includes("referral");

  if (step <= 1) {
    return referral
      ? `Hey ${fn}, hope you loved your visit today at FIT Beyond Plus! 💪 Glad your friend sent you our way — any questions about membership or classes?`
      : `Hey ${fn}, hope you loved your visit today at FIT Beyond Plus! 💪 Any questions about membership, classes, or anything you want to know more about?`;
  }

  const nudge =
    cat === "kickboxing" || cat === "bjj" || cat === "bjj_kids" || cat === "classes"
      ? " We can also get you on the class schedule so you know exactly when to come in."
      : cat === "personal_training"
        ? " We can also pair you with a trainer so you've got a plan from day one."
        : "";
  return `Hey ${fn}! Still thinking about it? We'd love to have you as a member.${nudge} Just reply here 🙏`;
}

export const FOLLOWUP_MIN_DAYS = [1, 3, 5, 7];
export const POSTVISIT_MIN_HOURS = [3, 24];
