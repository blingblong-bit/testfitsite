import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Dumbbell, Users, Clock, Trophy, Heart, Shield } from "lucide-react";
import heroAsset from "@/assets/hero-gym-v2.png.asset.json";
import weightsImg from "@/assets/gym-shoulder-press.jpg";
import { CTASection } from "@/components/CTASection";

const heroImg = heroAsset.url;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FIT Beyond Plus | Gym, Training & Classes | Tullahoma, TN" },
      { name: "description", content: "Join FIT Beyond Plus in Tullahoma, TN for 24/7 gym access, group fitness classes, personal training, and athlete performance training. Tour the gym today." },
      { property: "og:title", content: "FIT Beyond Plus | Gym, Training & Classes | Tullahoma, TN" },
      { property: "og:description", content: "Join FIT Beyond Plus in Tullahoma, TN for 24/7 gym access, group fitness classes, personal training, and athlete performance training. Tour the gym today." },
      { property: "og:url", content: "https://fitbeyondplus.com/" },
      { name: "twitter:title", content: "FIT Beyond Plus | Gym, Training & Classes | Tullahoma, TN" },
      { name: "twitter:description", content: "Join FIT Beyond Plus in Tullahoma, TN for 24/7 gym access, group fitness classes, personal training, and athlete performance training. Tour the gym today." },
    ],
    links: [
      { rel: "preload", as: "image", href: heroImg, fetchpriority: "high" },
      { rel: "canonical", href: "https://fitbeyondplus.com/" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          "@id": "https://fitbeyondplus.com/#business",
          name: "FIT Beyond Plus",
          description: "A serious gym and training facility in Tullahoma, Tennessee.",
          url: "https://fitbeyondplus.com",
          telephone: "+1-931-222-4449",
          address: {
            "@type": "PostalAddress",
            streetAddress: "449 W Lincoln St",
            addressLocality: "Tullahoma",
            addressRegion: "TN",
            postalCode: "37388",
            addressCountry: "US",
          },
          openingHoursSpecification: [
            { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "09:00", closes: "20:00" },
            { "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "09:00", closes: "18:00" },
            { "@type": "OpeningHoursSpecification", dayOfWeek: "Sunday", opens: "10:00", closes: "17:00" },
          ],
        }),
      },
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
          style={{ objectPosition: "center 65%" }}
          width={1920}
          height={1080}
          // @ts-expect-error fetchpriority is valid HTML
          fetchpriority="high"
        />
        {/* Subtle base darkening so the whole image stays visible */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, oklch(0.15 0.04 250 / 0.35) 0%, oklch(0.12 0.03 250 / 0.45) 100%)" }} />
        {/* Strong left-side gradient behind the text */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, oklch(0.10 0.04 250 / 0.92) 0%, oklch(0.12 0.04 250 / 0.78) 28%, oklch(0.15 0.04 250 / 0.35) 55%, transparent 80%)" }} />
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(700px circle at 75% 25%, oklch(0.70 0.18 235 / 0.15), transparent 60%)" }}
        />
        <div className="container-page relative py-28 md:py-40">
          <p className="text-xs tracking-[0.35em] text-primary">TULLAHOMA · TENNESSEE</p>
          <h1 className="mt-4 text-5xl md:text-7xl lg:text-8xl max-w-4xl leading-[0.95]">
            More than <span className="text-gradient-blue">a gym.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-foreground/85">
            FIT Beyond Plus is a clean, well-equipped training facility in Tullahoma, Tennessee built for beginners, athletes, serious lifters, and everyday people who want to get stronger, move better, and train with purpose.
          </p>
          <p className="mt-4 max-w-xl text-base text-foreground/75">
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
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-border bg-card">
        <div className="container-page py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
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
              At FIT Beyond Plus, you do not have to be advanced to belong here. You just have to be willing to start.
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              We serve first-time gym-goers, weekend warriors, athletes, parents, busy adults, and experienced lifters. Some members are learning the basics. Some are chasing performance. Some are rebuilding confidence. All of them deserve a gym that respects the work.
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Our facility is designed to give you a serious training environment without the ego, attitude, or intimidation that keeps too many people from getting started.
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
              { icon: Dumbbell, t: "Premium Equipment", d: "Train with quality strength equipment, free weights, machines, racks, platforms, and dumbbells built for real progress." },
              { icon: Clock, t: "24/7 Access", d: "Members can train on their schedule with secure access, day or night." },
              { icon: Users, t: "1-on-1 Coaching", d: "For those who want more guidance, our trainers provide real coaching, structure, accountability, and support." },
              { icon: Trophy, t: "Athlete-Ready", d: "For athletes and serious lifters, we have the tools and training environment to build strength, power, and performance." },
              { icon: Heart, t: "Beginner Friendly", d: "New to the gym? You are welcome here. We help you get started without judgment or pressure." },
              { icon: Shield, t: "Clean & Maintained", d: "We care about the details: clean floors, working equipment, organized spaces, and a gym you actually want to come back to." },
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
