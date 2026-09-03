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
};

/** Drip step (1-4). Returns the exact SMS body to send. */
export function buildFollowupMessage(step: number, lead: CopyLead): string {
  const fn = firstName(lead.name);
  const cat = categorizeLead(lead.interest, lead.source);
  const hook = HOOK[cat];
  const invite = INVITE[cat];

  switch (step) {
    case 1:
      return `Hey ${fn}, just making sure you saw my message! We'd love to have you check out FIT Beyond Plus — ${invite} whenever it works for you. Still interested? 💪`;
    case 2:
      return `${fn}, no pressure at all — but if you want to see the place for yourself, say the word and I'll ${invite === "come by for a free visit" ? "get you set up with a free visit" : `set you up to ${invite}`}. Takes about 15 minutes, zero obligation.`;
    case 3:
      return `${fn}, ${hook}. That's kind of our thing at FIT Beyond Plus. Whenever you're ready, we've got you.`;
    default:
      return `${fn}, let's make this easy — try FIT Beyond Plus free for 7 days. Full access, no strings, and you can ${invite} while you're at it. Just reply YES and I'll get you set up.`;
  }
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
