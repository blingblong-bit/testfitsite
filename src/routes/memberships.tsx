import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { CTASection } from "@/components/CTASection";

export const Route = createFileRoute("/memberships")({
  head: () => ({
    meta: [
      { title: "Memberships — FIT Beyond Plus" },
      { name: "description", content: "Monthly and paid-in-full membership options at FIT Beyond Plus in Tullahoma, TN. 24/7 access, no contracts on monthly plans." },
      { property: "og:title", content: "FIT Beyond Plus Memberships" },
      { property: "og:description", content: "Monthly and paid-in-full options. Train your way." },
    ],
  }),
  component: Memberships,
});

const monthlyPlans = [
  {
    name: "Single",
    price: "37",
    tagline: "One member. Full access.",
    features: ["24/7 keycard access", "All equipment & facilities", "Locker rooms & showers", "Free orientation session"],
  },
  {
    name: "Duo",
    price: "55",
    tagline: "Train together.",
    features: ["2 adult members", "All equipment & facilities", "Shared guest privileges", "Free orientation session"],
  },
  {
    name: "Duo +1",
    price: "63",
    tagline: "Three adult members.",
    features: ["3 adult members", "All equipment & facilities", "Shared guest privileges", "Free orientation session"],
  },
  {
    name: "Family",
    price: "72",
    tagline: "The whole crew.",
    features: ["Family access", "All equipment & facilities", "Shared guest privileges", "Free orientation session"],
  },
  {
    name: "Tanning",
    price: "25",
    tagline: "Unlimited tanning access.",
    features: ["Unlimited tanning", "Clean, well-maintained beds", "Add to any membership"],
  },
];

const paidInFullPlans = [
  { name: "Single — 1 Week", price: "35" },
  { name: "Single — 1 Month", price: "55" },
  { name: "Single — 3 Months", price: "111" },
  { name: "Single — 6 Months", price: "222" },
  { name: "Single — 1 Year", price: "399" },
  { name: "Duo — 1 Year", price: "605" },
  { name: "Duo +1 — 1 Year", price: "693" },
  { name: "Family — 1 Year", price: "864" },
];

function Memberships() {
  return (
    <>
      <PageHero
        eyebrow="MEMBERSHIPS"
        title="Honest pricing. No surprises."
        description="Monthly plans with full flexibility, or pay in full and skip the annual fee."
      />

      <section className="container-page py-20">
        <p className="text-xs tracking-[0.3em] text-primary">MONTHLY MEMBERSHIPS</p>
        <p className="mt-2 text-sm text-muted-foreground">$49.99 annual fee billed July 1st · Cancel anytime with 30 days' notice</p>

        <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {monthlyPlans.map((p) => (
            <div key={p.name} className="relative rounded-lg border border-border bg-card p-8 flex flex-col">
              <h3 className="text-2xl">{p.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-5xl font-display font-bold">${p.price}</span>
                <span className="text-sm text-muted-foreground">/ month</span>
              </div>
              <ul className="mt-6 space-y-3 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-3 text-sm">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/contact"
                className="mt-8 inline-flex h-11 items-center justify-center rounded-md text-sm font-bold uppercase tracking-wide transition border border-border hover:bg-secondary"
              >
                Join the Gym
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-20">
          <p className="text-xs tracking-[0.3em] text-primary">PAID IN FULL MEMBERSHIPS</p>
          <p className="mt-2 text-sm text-muted-foreground">No annual fee · One upfront payment · Best value for committed training</p>

          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border">
            {paidInFullPlans.map((p) => (
              <div key={p.name} className="bg-card p-6 flex flex-col justify-between">
                <h3 className="text-sm font-semibold">{p.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-display font-bold">${p.price}</span>
                  <span className="text-xs text-muted-foreground">paid in full</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 text-center text-sm text-muted-foreground">
          Active military & first responders get 15% off · Day passes available for $12
        </div>
      </section>

      <section className="bg-card border-y border-border">
        <div className="container-page py-20">
          <h2 className="text-3xl md:text-4xl text-center">Common questions</h2>
          <div className="mt-12 grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              { q: "Is there a contract on monthly plans?", a: "No. All monthly memberships are month-to-month. Cancel anytime with 30 days' notice." },
              { q: "When is the annual fee charged?", a: "The $49.99 annual fee is billed on July 1st each year for all active monthly memberships." },
              { q: "Do you offer a free trial?", a: "Yes — book a tour and we'll set you up with a complimentary day pass." },
              { q: "What ages do you serve?", a: "Members 14+ welcome. Ages 14–17 require a parent or guardian on the membership." },
            ].map((f) => (
              <div key={f.q} className="border border-border bg-background p-6 rounded-lg">
                <h3 className="text-base">{f.q}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTASection />
    </>
  );
}
