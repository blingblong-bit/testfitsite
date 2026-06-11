import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Dumbbell, Users, Clock, Trophy, Heart, Shield } from "lucide-react";
import heroImg from "@/assets/real-dumbbells.jpg";
import weightsImg from "@/assets/gym-shoulder-press.jpg";
import { CTASection } from "@/components/CTASection";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FIT Beyond Plus — More Than A Gym | Tullahoma, TN" },
      { name: "description", content: "A serious gym in Tullahoma, TN. Premium equipment, expert coaching, 24/7 access. Join today or book a tour." },
      { property: "og:title", content: "FIT Beyond Plus — More Than A Gym" },
      { property: "og:description", content: "A serious gym in Tullahoma, TN. Train with intent." },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <img
          src={heroImg}
          alt="FIT Beyond Plus training floor"
          className="absolute inset-0 h-full w-full object-cover"
          width={1920}
          height={1080}
        />
        <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(800px circle at 70% 30%, oklch(0.70 0.18 235 / 0.18), transparent 60%)" }}
        />
        <div className="container-page relative py-28 md:py-40">
          <p className="text-xs tracking-[0.35em] text-primary">TULLAHOMA · TENNESSEE</p>
          <h1 className="mt-4 text-5xl md:text-7xl lg:text-8xl max-w-4xl leading-[0.95]">
            More than <span className="text-gradient-blue">a gym.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            FIT Beyond Plus is a clean, well-equipped training facility in Tullahoma, Tennessee built for beginners, athletes, serious lifters, and everyday people who want to get stronger, move better, and train with purpose.
          </p>
          <p className="mt-4 max-w-xl text-base text-muted-foreground">
            You do not have to be in shape before joining. That is what the gym is for.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              to="/memberships"
              className="inline-flex h-12 items-center gap-2 rounded-md bg-primary px-6 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:brightness-110 transition"
              style={{ boxShadow: "var(--shadow-glow)" }}
            >
              Join the Gym <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex h-12 items-center rounded-md border border-border bg-background/40 backdrop-blur px-6 text-sm font-bold uppercase tracking-wide hover:bg-secondary transition"
            >
              Book a Tour
            </Link>
          </div>

          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl">
            {[
              { k: "24/7", v: "Member Access" },
              { k: "13.5K", v: "Sq Ft Facility" },
              { k: "100+", v: "Pieces of Equipment" },
              { k: "1:1", v: "Personal Training" },
            ].map((s) => (
              <div key={s.v} className="border-l-2 border-primary pl-4">
                <div className="text-3xl font-display font-bold">{s.k}</div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Intro */}
      <section className="container-page py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs tracking-[0.3em] text-primary">WHO WE ARE</p>
            <h2 className="mt-3 text-4xl md:text-5xl">Built for people who actually want to train.</h2>
            <p className="mt-5 text-muted-foreground leading-relaxed">
              FIT Beyond Plus is Tullahoma's home for serious fitness. We're a clean, well-equipped facility with the room and tools to train hard — and a coaching team that meets you wherever you're starting from.
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Whether you're chasing a PR, returning after years away, or stepping into a gym for the first time, you'll find space to work and people who respect the effort.
            </p>
            <Link
              to="/about"
              className="mt-8 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary hover:gap-3 transition-all"
            >
              About Us <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="relative">
            <img src={weightsImg} alt="Dumbbell rack" loading="lazy" width={1280} height={896} className="rounded-lg border border-border" />
            <div className="absolute -bottom-6 -left-6 hidden md:block bg-card border border-border rounded-lg p-5 max-w-xs" style={{ boxShadow: "var(--shadow-glow)" }}>
              <p className="text-xs uppercase tracking-widest text-primary">Our promise</p>
              <p className="mt-2 text-sm">Clean equipment, real coaching, zero attitude.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-card border-y border-border">
        <div className="container-page py-24">
          <div className="max-w-2xl">
            <p className="text-xs tracking-[0.3em] text-primary">WHAT YOU GET</p>
            <h2 className="mt-3 text-4xl md:text-5xl">Everything you need. Nothing you don't.</h2>
          </div>
          <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {[
              { icon: Dumbbell, t: "Premium Equipment", d: "Hammer Strength, Rogue, dumbbells to 150 lb, full racks and platforms." },
              { icon: Clock, t: "24/7 Access", d: "Members train on their schedule. Secure keycard entry, day or night." },
              { icon: Users, t: "1-on-1 Coaching", d: "Certified trainers who actually program — not just count reps." },
              { icon: Trophy, t: "Athlete-Ready", d: "Turf, sleds, plyo boxes, and conditioning gear for sport-specific work." },
              { icon: Heart, t: "Beginner Friendly", d: "Free orientation. Zero judgment. Real help when you ask for it." },
              { icon: Shield, t: "Clean & Maintained", d: "Daily sanitization. Working equipment. A space you'll want to come back to." },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="bg-background p-8 hover:bg-card transition-colors group">
                <Icon className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
                <h3 className="mt-5 text-xl">{t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTASection />
    </>
  );
}
