import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { CTASection } from "@/components/CTASection";

export const Route = createFileRoute("/memberships")({
  head: () => ({
    meta: [
      { title: "Memberships — FIT Beyond Plus" },
      { name: "description", content: "Simple, honest membership options at FIT Beyond Plus in Tullahoma, TN. 24/7 access, no contracts, real value." },
      { property: "og:title", content: "FIT Beyond Plus Memberships" },
      { property: "og:description", content: "24/7 access. No contracts. Real value." },
    ],
  }),
  component: Memberships,
});

const plans = [
  {
    name: "Standard",
    price: "29",
    tagline: "Full gym access, no extras.",
    features: ["24/7 keycard access", "All equipment & facilities", "Locker rooms & showers", "Free orientation session", "No long-term contract"],
    highlighted: false,
  },
  {
    name: "Plus",
    price: "49",
    tagline: "Our most popular plan.",
    features: ["Everything in Standard", "Bring a guest 2x / month", "Monthly form-check session", "Discounted personal training", "Member-only programming"],
    highlighted: true,
  },
  {
    name: "Couples & Family",
    price: "79",
    tagline: "Train together, save together.",
    features: ["Up to 2 adult members", "Add kids 12+ for $15/mo", "All Plus benefits included", "Shared guest privileges", "Family tour & onboarding"],
    highlighted: false,
  },
];

function Memberships() {
  return (
    <>
      <PageHero
        eyebrow="MEMBERSHIPS"
        title="Honest pricing. No surprises."
        description="Pick the plan that fits how you train. Cancel anytime. No initiation fees, no pressure sales."
      />

      <section className="container-page py-20">
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative rounded-lg border p-8 flex flex-col ${
                p.highlighted ? "border-primary bg-card" : "border-border bg-card"
              }`}
              style={p.highlighted ? { boxShadow: "var(--shadow-glow)" } : undefined}
            >
              {p.highlighted && (
                <div className="absolute -top-3 left-8 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider px-3 py-1 rounded">
                  Most popular
                </div>
              )}
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
                className={`mt-8 inline-flex h-11 items-center justify-center rounded-md text-sm font-bold uppercase tracking-wide transition ${
                  p.highlighted
                    ? "bg-primary text-primary-foreground hover:brightness-110"
                    : "border border-border hover:bg-secondary"
                }`}
              >
                Join the Gym
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center text-sm text-muted-foreground">
          Day passes available for $12 · Active military & first responders get 15% off
        </div>
      </section>

      <section className="bg-card border-y border-border">
        <div className="container-page py-20">
          <h2 className="text-3xl md:text-4xl text-center">Common questions</h2>
          <div className="mt-12 grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              { q: "Is there a contract?", a: "No. All memberships are month-to-month. Cancel anytime with 30 days' notice." },
              { q: "Do you offer a free trial?", a: "Yes — book a tour and we'll set you up with a complimentary day pass." },
              { q: "What ages do you serve?", a: "Members 14+ welcome. Ages 14–17 require a parent or guardian on the membership." },
              { q: "Can I freeze my membership?", a: "Yes. Members can freeze for up to 3 months per year at no charge." },
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
