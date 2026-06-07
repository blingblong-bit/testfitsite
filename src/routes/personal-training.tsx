import { createFileRoute, Link } from "@tanstack/react-router";
import { Target, TrendingUp, Users, Calendar } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { CTASection } from "@/components/CTASection";
import ptImg from "@/assets/gym-shoulder-press.jpg";

export const Route = createFileRoute("/personal-training")({
  head: () => ({
    meta: [
      { title: "Personal Training — FIT Beyond Plus" },
      { name: "description", content: "Certified personal trainers in Tullahoma, TN. Real programming, real coaching, real results — for any level." },
      { property: "og:title", content: "Personal Training at FIT Beyond Plus" },
      { property: "og:description", content: "Real coaching. Real programming. Real results." },
    ],
  }),
  component: PT,
});

function PT() {
  return (
    <>
      <PageHero
        eyebrow="PERSONAL TRAINING"
        title="Coaching that actually moves the needle."
        description="Our trainers are certified, experienced, and invested in your progress. Whether you're new to lifting or chasing a competitive goal, we build a plan that fits."
      />

      <section className="container-page py-20 grid md:grid-cols-2 gap-12 items-center">
        <img src={ptImg} alt="Personal trainer coaching" loading="lazy" width={1280} height={896} className="rounded-lg border border-border" />
        <div>
          <h2 className="text-3xl md:text-4xl">Built around you.</h2>
          <p className="mt-5 text-muted-foreground">
            Every session starts with where you are — your goals, your history, your schedule. From there, we build programming that gets you stronger, leaner, faster, or healthier. Whatever the goal, we measure progress and adjust.
          </p>
          <ul className="mt-8 space-y-4">
            {[
              { icon: Target, t: "Goal assessment", d: "We start with a full movement and goals consultation." },
              { icon: TrendingUp, t: "Custom programming", d: "Written plans that progress week over week — not random workouts." },
              { icon: Users, t: "Certified coaches", d: "NASM, NSCA, and CrossFit-credentialed trainers on staff." },
              { icon: Calendar, t: "Flexible scheduling", d: "Morning, lunch, evening — we work with your week." },
            ].map(({ icon: Icon, t, d }) => (
              <li key={t} className="flex gap-4">
                <div className="h-10 w-10 shrink-0 rounded-md bg-primary/15 text-primary flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base">{t}</h3>
                  <p className="text-sm text-muted-foreground">{d}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-card border-y border-border">
        <div className="container-page py-20">
          <div className="text-center">
            <p className="text-xs tracking-[0.3em] text-primary">PACKAGES</p>
            <h2 className="mt-3 text-3xl md:text-4xl">Simple, flexible pricing</h2>
          </div>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {[
              { n: "Starter", s: "4 sessions / month", p: "240", d: "Perfect for getting started or a monthly tune-up." },
              { n: "Committed", s: "8 sessions / month", p: "440", d: "Twice-a-week coaching for steady, measurable progress.", h: true },
              { n: "All-In", s: "12 sessions / month", p: "600", d: "Three sessions a week — built for athletes and serious goals." },
            ].map((p) => (
              <div
                key={p.n}
                className={`rounded-lg border p-8 bg-background ${p.h ? "border-primary" : "border-border"}`}
                style={p.h ? { boxShadow: "var(--shadow-glow)" } : undefined}
              >
                <h3 className="text-2xl">{p.n}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.s}</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-4xl font-display font-bold">${p.p}</span>
                  <span className="text-sm text-muted-foreground">/ mo</span>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">{p.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Single sessions from $65 · Semi-private (2–3 people) from $45/person · Plus members get 10% off all packages.
          </p>
        </div>
      </section>

      <section className="container-page py-20 text-center">
        <h2 className="text-3xl md:text-4xl">Not sure where to start?</h2>
        <p className="mt-4 max-w-xl mx-auto text-muted-foreground">
          Book a free consultation. We'll talk through your goals and recommend the right path — no pressure, no upsell.
        </p>
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Link to="/contact" className="inline-flex h-12 items-center rounded-md bg-primary px-6 text-sm font-bold uppercase tracking-wide text-primary-foreground" style={{ boxShadow: "var(--shadow-glow)" }}>
            Book a Free Consult
          </Link>
        </div>
      </section>

      <CTASection />
    </>
  );
}
