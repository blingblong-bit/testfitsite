import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { PageHero } from "@/components/PageHero";

export const Route = createFileRoute("/memberships")({
  head: () => ({
    meta: [
      { title: "Memberships — FIT Beyond Plus" },
      {
        name: "description",
        content:
          "Monthly and paid-in-full membership options at FIT Beyond Plus in Tullahoma, TN. 24/7 access, no contracts on monthly plans.",
      },
      { property: "og:title", content: "FIT Beyond Plus Memberships" },
      { property: "og:description", content: "Monthly and paid-in-full options. Train your way." },
      { property: "og:url", content: "https://fitbeyondplus.com/memberships" },
    ],
    links: [{ rel: "canonical", href: "https://fitbeyondplus.com/memberships" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "What does a FIT Beyond Plus membership include?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Membership includes 24/7 keycard access, all equipment and facilities, all fitness classes, sauna and tanning beds, locker rooms and showers, and a free orientation session.",
              },
            },
            {
              "@type": "Question",
              name: "What membership options are available?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "We offer monthly memberships (Single, Duo, Duo +1, and Family) as well as paid-in-full options ranging from 1 week to 1 year. Tanning is included with every gym membership, and a tanning-only plan is available for $25/month. Active military and first responders receive 15% off.",
              },
            },
            {
              "@type": "Question",
              name: "Is there a contract for monthly memberships?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Monthly memberships have no contract. There is a $49 annual fee billed on July 1st. Paid-in-full memberships have no annual fee and offer the best value for committed training.",
              },
            },
            {
              "@type": "Question",
              name: "Who is FIT Beyond Plus for?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "FIT Beyond Plus is for beginners who want a comfortable place to start, adults who want to get stronger and healthier, athletes who need a facility that supports performance, lifters who want quality equipment, and anyone tired of crowded or unserious gyms.",
              },
            },
          ],
        }),
      },
    ],
  }),
  component: Memberships,
});

const monthlyPlans = [
  {
    name: "Single",
    price: "39",
    tagline: "One member. Full access.",
    features: [
      "24/7 keycard access",
      "All equipment & facilities",
      "All classes",
      "Sauna & tanning beds",
      "Locker rooms & showers",
      "Free orientation session",
    ],
  },
  {
    name: "Duo",
    price: "59",
    tagline: "Train together.",
    features: [
      "2 adult members",
      "All equipment & facilities",
      "All classes",
      "Sauna & tanning beds",
      "Shared guest privileges",
      "Free orientation session",
    ],
  },
  {
    name: "Duo +1",
    price: "69",
    tagline: "Three adult members.",
    features: [
      "3 adult members",
      "All equipment & facilities",
      "All classes",
      "Sauna & tanning beds",
      "Shared guest privileges",
      "Free orientation session",
    ],
  },
  {
    name: "Family",
    price: "82",
    tagline: "The whole crew.",
    features: [
      "Up to 5 in the same household",
      "All equipment & facilities",
      "All classes",
      "Sauna & tanning beds",
      "Shared guest privileges",
      "Free orientation session",
    ],
  },
  {
    name: "Tanning Only",
    price: "25",
    tagline: "No gym membership required.",
    features: [
      "Unlimited tanning",
      "Clean, well-maintained beds",
      "Tanning is already included with every gym membership",
    ],
  },
];

const paidInFullPlans = [
  { name: "Single — 1 Week", price: "35" },
  { name: "Single — 1 Month", price: "55" },
  { name: "Single — 3 Months", price: "123" },
  { name: "Single — 6 Months", price: "234" },
  { name: "Single — 1 Year", price: "399" },
  { name: "Duo — 1 Year", price: "610" },
  { name: "Duo +1 — 1 Year", price: "703" },
  { name: "Family — 1 Year", price: "864" },
];

function Memberships() {
  return (
    <>
      <PageHero
        eyebrow="MEMBERSHIPS"
        title="Join a gym built around progress."
        description="A FIT Beyond Plus membership gives you access to a serious training environment without the intimidation. Whether you are starting your fitness journey, returning after time away, or looking for a better place to train, we are here to give you the space and support to keep moving forward."
      />

      <section className="container-page py-20 grid md:grid-cols-2 gap-12 items-start">
        <div>
          <p className="text-xs tracking-[0.3em] text-primary">WHAT MEMBERSHIP MEANS HERE</p>
          <h2 className="mt-3 text-3xl md:text-4xl">More than access to equipment.</h2>
          <p className="mt-5 text-muted-foreground leading-relaxed">
            Membership at FIT Beyond Plus is not just access to equipment. It is access to a better
            training environment.
          </p>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            You get a clean facility, quality equipment, 24/7 access, and a gym culture built around
            respect and effort. Train on your schedule. Work at your level. Build at your pace.
          </p>
          <ul className="mt-5 space-y-2">
            {["Access to all classes", "Sauna access", "24/7 keycard access", "Tanning beds"].map(
              (item) => (
                <li key={item} className="flex gap-3 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ),
            )}
          </ul>
        </div>
        <div>
          <p className="text-xs tracking-[0.3em] text-primary">FIT BEYOND PLUS IS FOR:</p>
          <ul className="mt-5 space-y-3">
            {[
              "Beginners who want a comfortable place to start.",
              "Adults who want to get stronger, healthier, and more consistent.",
              "Athletes who need a facility that supports performance.",
              "Lifters who want quality equipment and a focused environment.",
              "People who are tired of crowded, dirty, or unserious gyms.",
              "Anyone ready to take the next step.",
            ].map((line) => (
              <li key={line} className="flex gap-3 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-card border-y border-border">
        <div className="container-page py-20">
          <h2 className="text-3xl md:text-4xl text-center">Why members choose FIT Beyond Plus</h2>
          <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { t: "24/7 Member Access", d: "Train when it works for your schedule." },
              {
                t: "Quality Equipment",
                d: "Use the tools you need for strength, fitness, and performance.",
              },
              {
                t: "Supportive Environment",
                d: "Train around people who respect effort and improvement.",
              },
              { t: "Clean Facility", d: "A gym that is cared for and maintained." },
              {
                t: "Coaching Available",
                d: "Personal training is available for those who want more guidance.",
              },
            ].map((f) => (
              <div key={f.t} className="border border-border bg-background p-7 rounded-lg">
                <h3 className="text-xl">{f.t}</h3>
                <p className="mt-3 text-sm text-muted-foreground">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-20">
        <p className="text-xs tracking-[0.3em] text-primary">MONTHLY MEMBERSHIPS</p>
        <p className="mt-2 text-sm text-muted-foreground">$49 annual fee billed July 1st</p>

        <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {monthlyPlans.map((p) => (
            <div
              key={p.name}
              className="relative rounded-lg border border-border bg-card p-8 flex flex-col"
            >
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
          <p className="mt-2 text-sm text-muted-foreground">
            No annual fee · One upfront payment · Best value for committed training
          </p>

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
          Active military & first responders get 15% off · Day passes available for $10
        </div>
      </section>

      <section className="container-page py-20 text-center">
        <h2 className="text-3xl md:text-4xl">Not sure where to start?</h2>
        <p className="mt-4 max-w-xl mx-auto text-muted-foreground">
          Come take a tour. We will walk you through the facility, answer your questions, and help
          you decide what option makes the most sense for your goals.
        </p>
        <div className="mt-8">
          <Link
            to="/contact"
            className="inline-flex h-12 items-center rounded-md bg-primary px-6 text-sm font-bold uppercase tracking-wide text-primary-foreground"
            style={{ boxShadow: "var(--shadow-glow)" }}
          >
            Book a Tour
          </Link>
        </div>
      </section>
    </>
  );
}
