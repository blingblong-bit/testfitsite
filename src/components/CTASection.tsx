import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export function CTASection() {
  return (
    <section className="border-y border-border bg-card">
      <div className="container-page py-20 text-center">
        <p className="text-xs tracking-[0.3em] text-primary">READY TO TRAIN?</p>
        <h2 className="mt-3 text-4xl md:text-5xl">Walk in. Lift heavy. Leave better.</h2>
        <p className="mt-4 max-w-xl mx-auto text-muted-foreground">
          Join a gym that takes training seriously — without the ego. Stop by for a tour, or sign up today.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/memberships"
            className="inline-flex h-12 items-center gap-2 rounded-md bg-primary px-6 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:brightness-110 transition"
            style={{ boxShadow: "var(--shadow-glow)" }}
          >
            Join the Gym <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/contact"
            className="inline-flex h-12 items-center rounded-md border border-border px-6 text-sm font-bold uppercase tracking-wide hover:bg-secondary transition"
          >
            Book a Tour
          </Link>
        </div>
      </div>
    </section>
  );
}
