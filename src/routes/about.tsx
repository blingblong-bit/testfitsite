import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { CTASection } from "@/components/CTASection";
import weightsImg from "@/assets/facility-weights.jpg";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — FIT Beyond Plus | Tullahoma, TN" },
      { name: "description", content: "FIT Beyond Plus is more than a gym. Learn about our mission, our team, and how we built Tullahoma's serious training facility." },
      { property: "og:title", content: "About FIT Beyond Plus" },
      { property: "og:description", content: "Tullahoma's serious training facility. Built for results." },
    ],
  }),
  component: About,
});

function About() {
  return (
    <>
      <PageHero
        eyebrow="ABOUT US"
        title="More than a gym. A standard."
        description="FIT Beyond Plus was built on a simple idea — Tullahoma deserved a facility that takes training as seriously as the people walking through the door."
      />

      <section className="container-page py-20 grid md:grid-cols-2 gap-12 items-start">
        <img src={weightsImg} alt="Facility" loading="lazy" width={1280} height={896} className="rounded-lg border border-border" />
        <div>
          <h2 className="text-3xl md:text-4xl">Our story</h2>
          <p className="mt-5 text-muted-foreground leading-relaxed">
            We opened FIT Beyond Plus because something was missing in Tullahoma — a clean, well-equipped, no-nonsense gym where serious lifters and everyday athletes could train without compromise.
          </p>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            Today we serve hundreds of members across the community — first-time gym-goers, weekend warriors, competitive athletes, and lifelong lifters. They all share one thing: they want to get better, and they want a place that respects that.
          </p>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            We invest in the right equipment. We hire coaches who know what they're doing. We keep the place clean. And we keep the door open 24/7 so you can train when life lets you.
          </p>
        </div>
      </section>

      <section className="bg-card border-y border-border">
        <div className="container-page py-20">
          <h2 className="text-3xl md:text-4xl text-center">What we stand for</h2>
          <div className="mt-14 grid md:grid-cols-3 gap-8">
            {[
              { t: "Effort over ego", d: "We respect the work, not the weight. Everyone trains. Everyone gets stronger." },
              { t: "Coaching that matters", d: "Real programming, real feedback. Our trainers are here to make you better." },
              { t: "A space that delivers", d: "Functional layout. Premium gear. Cleaned daily. Maintained always." },
            ].map((v) => (
              <div key={v.t} className="border border-border bg-background p-8 rounded-lg">
                <div className="text-5xl text-primary font-display">0{["1","2","3"][["effort over ego","coaching that matters","a space that delivers"].indexOf(v.t.toLowerCase())]}</div>
                <h3 className="mt-4 text-xl">{v.t}</h3>
                <p className="mt-3 text-sm text-muted-foreground">{v.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-20 text-center">
        <h2 className="text-3xl md:text-4xl">Ready to see it in person?</h2>
        <p className="mt-4 max-w-xl mx-auto text-muted-foreground">Book a free tour and we'll walk you through the facility, the equipment, and the membership options.</p>
        <div className="mt-8">
          <Link to="/contact" className="inline-flex h-12 items-center rounded-md bg-primary px-6 text-sm font-bold uppercase tracking-wide text-primary-foreground" style={{ boxShadow: "var(--shadow-glow)" }}>
            Book a Tour
          </Link>
        </div>
      </section>

      <CTASection />
    </>
  );
}
