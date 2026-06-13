import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export function ClassesCTA() {
  return (
    <section className="border-y border-border bg-card">
      <div className="container-page py-20 text-center">
        <p className="text-xs tracking-[0.3em] text-primary">CLASSES</p>
        <h2 className="mt-3 text-4xl md:text-5xl">Ask about our classes</h2>
        <p className="mt-4 max-w-xl mx-auto text-muted-foreground">
          From HIIT and TRX to Yoga and Kickboxing — find a class that fits your goals.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/classes"
            className="inline-flex h-12 items-center gap-2 rounded-md bg-primary px-6 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:brightness-110 transition"
            style={{ boxShadow: "var(--shadow-glow)" }}
          >
            View Class Schedule <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/contact"
            className="inline-flex h-12 items-center rounded-md border border-border px-6 text-sm font-bold uppercase tracking-wide hover:bg-secondary transition"
          >
            Ask a Question
          </Link>
        </div>
      </div>
    </section>
  );
}
