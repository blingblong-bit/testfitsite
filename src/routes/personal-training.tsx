import { createFileRoute, Link } from "@tanstack/react-router";
import { Target, TrendingUp, Users, Calendar } from "lucide-react";
import { PageHero } from "@/components/PageHero";

import ptAsset from "@/assets/personal-training.jpg.asset.json";

export const Route = createFileRoute("/personal-training")({
  head: () => ({
    meta: [
      { title: "Personal Training — FIT Beyond Plus" },
      {
        name: "description",
        content:
          "Certified personal trainers in Tullahoma, TN. Real programming, real coaching, real results — for any level.",
      },
      { property: "og:title", content: "Personal Training at FIT Beyond Plus" },
      { property: "og:description", content: "Real coaching. Real programming. Real results." },
      { property: "og:url", content: "https://fitbeyondplus.com/personal-training" },
    ],
    links: [{ rel: "canonical", href: "https://fitbeyondplus.com/personal-training" }],
  }),
  component: PT,
});

function PT() {
  return (
    <>
      <PageHero
        eyebrow="PERSONAL TRAINING"
        title="Coaching for where you are now."
        description="Personal training at FIT Beyond Plus is built around helping you train with more confidence, structure, and purpose. Whether you are brand new to the gym, trying to lose weight, build strength, improve performance, or get consistent again, our coaches meet you where you are and help you move forward."
      />

      <section className="container-page py-20 grid md:grid-cols-2 gap-12 items-center">
        <img
          src={ptAsset.url}
          alt="Personal trainer coaching a client"
          loading="lazy"
          className="rounded-lg border border-border w-full max-h-[600px] object-contain bg-card mx-auto"
        />
        <div>
          <p className="text-xs tracking-[0.3em] text-primary">TRAINING PHILOSOPHY</p>
          <h2 className="mt-3 text-3xl md:text-4xl">Real coaching. Real progress.</h2>
          <p className="mt-5 text-muted-foreground leading-relaxed">
            Good training is not random. Our personal training focuses on proper movement, smart
            programming, accountability, and steady progress. We help you understand what you are
            doing, why you are doing it, and how it connects to your goals.
          </p>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            You do not need to be advanced to work with a trainer. You just need to be ready to
            start.
          </p>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            We also offer post-physical therapy personal training for those recovering from injuries
            or finishing rehab.{" "}
            <a
              href="https://www.fitbeyondtherapy.com/contact-us/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Learn more about post-physical therapy training.
            </a>
          </p>
        </div>
      </section>

      <section className="bg-card border-y border-border">
        <div className="container-page py-20">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <p className="text-xs tracking-[0.3em] text-primary">WHO IT IS FOR</p>
              <h2 className="mt-3 text-3xl md:text-4xl">Personal training is a good fit if:</h2>
              <ul className="mt-8 space-y-3">
                {[
                  "You are new to the gym and want guidance.",
                  "You have struggled to stay consistent on your own.",
                  "You want a plan instead of guessing.",
                  "You want to build strength, lose fat, or improve overall fitness.",
                  "You are an athlete looking for more structure.",
                  "You want accountability and support.",
                  "You want to feel more confident when you train.",
                  "You are recovering from an injury or finishing physical therapy.",
                ].map((line) => (
                  <li key={line} className="flex gap-3 text-sm text-muted-foreground">
                    <Target className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs tracking-[0.3em] text-primary">WHAT TO EXPECT</p>
              <h2 className="mt-3 text-3xl md:text-4xl">Built around you.</h2>
              <p className="mt-5 text-muted-foreground leading-relaxed">
                Personal training starts with where you are right now. We look at your goals,
                experience level, schedule, and what you need help with. From there, we build a plan
                that helps you train safely, consistently, and effectively.
              </p>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                The goal is not to make training more complicated. The goal is to give you direction
                and help you make progress.
              </p>
              <ul className="mt-6 space-y-4">
                {[
                  {
                    icon: TrendingUp,
                    t: "Custom programming",
                    d: "Written plans that progress week over week — not random workouts.",
                  },
                  {
                    icon: Users,
                    t: "Coaches who care",
                    d: "Trainers invested in your goals, your form, and your progress.",
                  },
                  {
                    icon: Calendar,
                    t: "Flexible scheduling",
                    d: "Morning, lunch, evening — we work with your week.",
                  },
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
          </div>
        </div>
      </section>

      <section className="container-page py-20 text-center">
        <h2 className="text-3xl md:text-4xl">Start with a conversation.</h2>
        <p className="mt-4 max-w-xl mx-auto text-muted-foreground">
          Tell us where you are, what you want to improve, and what has been holding you back. We
          will help you figure out the next step.
        </p>
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Link
            to="/contact"
            className="inline-flex h-12 items-center rounded-md bg-primary px-6 text-sm font-bold uppercase tracking-wide text-primary-foreground"
            style={{ boxShadow: "var(--shadow-glow)" }}
          >
            Ask About Training
          </Link>
        </div>
      </section>
    </>
  );
}
