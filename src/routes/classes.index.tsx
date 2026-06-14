import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHero } from "@/components/PageHero";
import { ClassesCTA } from "@/components/ClassesCTA";
import barreAbsAsset from "@/assets/barre-abs.jpg.asset.json";
import cardioLiftAsset from "@/assets/cardio-lift-v2.jpg.asset.json";
import trxAsset from "@/assets/trx.jpg.asset.json";
import fitHiitAsset from "@/assets/fit-hiit.jpg.asset.json";
import kickboxingAsset from "@/assets/kickboxing.jpg.asset.json";
import yogaAsset from "@/assets/yoga.jpg.asset.json";
import kickboxingKidsAsset from "@/assets/kickboxing-kids.jpg.asset.json";
import kickboxingAdultAsset from "@/assets/kickboxing-adult.jpg.asset.json";
import bjjKidsAsset from "@/assets/bjj-kids.jpg.asset.json";
import bjjAdultAsset from "@/assets/bjj-adult.jpg.asset.json";
import { Phone, Mail } from "lucide-react";

export const Route = createFileRoute("/classes/")({
  head: () => ({
    meta: [
      { title: "Fitness Classes — FIT Beyond Plus" },
      { name: "description", content: "Group fitness classes at FIT Beyond Plus in Tullahoma, TN. HIIT, TRX, Barre, Yoga, Cardio, Kickboxing, and Pilates — included with FIT membership or $10 drop-in." },
      { property: "og:title", content: "Fitness Classes — FIT Beyond Plus" },
      { property: "og:description", content: "Included with FIT membership or $10 drop-in." },
    ],
  }),
  component: ClassesIndex,
});

function ClassesIndex() {
  return (
    <>
      <PageHero
        eyebrow="CLASSES"
        title="Group fitness, six days a week."
        description="HIIT, TRX, Barre, Yoga, Cardio, Kickboxing, and Pilates — included with any FIT membership or $10 drop-in."
      />

      <section className="container-page pt-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { src: barreAbsAsset.url, label: "BARRE ABS", caption: "Low-impact strength, balance, and core work at the barre.", alt: "Barre Abs class at FIT Beyond Plus" },
            { src: trxAsset.url, label: "TRX", caption: "Suspension training for full-body strength and stability.", alt: "TRX class at FIT Beyond Plus" },
            { src: fitHiitAsset.url, label: "FIT HIIT", caption: "High-intensity intervals with weighted ball circuits.", alt: "FIT HIIT class at FIT Beyond Plus" },
            { src: kickboxingAsset.url, label: "KICKBOXING", caption: "High-energy cardio conditioning that builds endurance.", alt: "Kickboxing class at FIT Beyond Plus" },
            { src: cardioLiftAsset.url, label: "CARDIO / LIFT", caption: "Cardio bursts paired with strength training.", alt: "Cardio and Lift class at FIT Beyond Plus" },
            { src: yogaAsset.url, label: "YOGA", caption: "Balance, flexibility, and mindful movement.", alt: "Yoga class at FIT Beyond Plus" },
          ].map((c) => (
            <figure key={c.label} className="overflow-hidden rounded-lg border border-border bg-card">
              <img src={c.src} alt={c.alt} className="w-full h-72 md:h-80 object-cover" loading="lazy" />
              <figcaption className="px-5 py-3 text-sm">
                <span className="text-xs tracking-[0.3em] text-primary">{c.label}</span>
                <p className="mt-1 text-muted-foreground">{c.caption}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <ClassesCTA />

      <section className="container-page pt-20">
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-xs tracking-[0.3em] text-primary">SPECIALTY PROGRAMS</p>
          <h2 className="mt-3 text-3xl md:text-4xl">Combat Sports — Separate Programs</h2>
          <p className="mt-4 text-muted-foreground">
            Kickboxing and Brazilian Jiu-Jitsu are coached programs run independently and{" "}
            <span className="text-foreground font-semibold">are not included with a FIT Beyond Plus membership</span>.
            Contact the program directly for schedules, pricing, and to get started.
          </p>
        </div>

        <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { src: kickboxingKidsAsset.url, label: "KIDS KICKBOXING", caption: "Discipline, focus, and confidence through striking fundamentals.", alt: "Kids kickboxing class" },
            { src: kickboxingAdultAsset.url, label: "ADULT KICKBOXING", caption: "Technique, conditioning, and pad work for all skill levels.", alt: "Adult kickboxing class" },
            { src: bjjKidsAsset.url, label: "KIDS BRAZILIAN JIU-JITSU", caption: "Grappling, self-defense, and respect on the mats.", alt: "Kids Brazilian Jiu-Jitsu class" },
            { src: bjjAdultAsset.url, label: "ADULT BRAZILIAN JIU-JITSU", caption: "Gi training for beginners to advanced practitioners.", alt: "Adult Brazilian Jiu-Jitsu class" },
          ].map((c) => (
            <figure key={c.label} className="overflow-hidden rounded-lg border border-border bg-card">
              <img src={c.src} alt={c.alt} className="w-full h-72 object-cover" loading="lazy" />
              <figcaption className="px-5 py-3 text-sm">
                <span className="text-xs tracking-[0.3em] text-primary">{c.label}</span>
                <p className="mt-1 text-muted-foreground">{c.caption}</p>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-10 rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-xs tracking-[0.3em] text-primary">CONTACT — KICKBOXING & BJJ</p>
          <h3 className="mt-3 text-2xl">Ask about Combat Sports</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            For Kickboxing and Brazilian Jiu-Jitsu inquiries, reach out directly:
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a
              href="tel:9318418272"
              className="inline-flex h-12 items-center gap-2 rounded-md bg-primary px-6 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:brightness-110 transition"
              style={{ boxShadow: "var(--shadow-glow)" }}
            >
              <Phone className="h-4 w-4" /> (931) 841-8272
            </a>
            <a
              href="mailto:station.6.fitness@gmail.com"
              className="inline-flex h-12 items-center gap-2 rounded-md border border-border px-6 text-sm font-bold uppercase tracking-wide hover:bg-secondary transition"
            >
              <Mail className="h-4 w-4" /> station.6.fitness@gmail.com
            </a>
          </div>
        </div>

        <div className="mt-10 max-w-3xl mx-auto">
          <CombatContactForm />
        </div>
      </section>
    </>
  );
}

function CombatContactForm() {
  const [sent, setSent] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card p-8">
      <h3 className="text-xl text-center">Send us a message about Combat Sports</h3>
      <p className="mt-2 text-sm text-center text-muted-foreground">
        Questions about Kickboxing or Brazilian Jiu-Jitsu? Fill out the form below.
      </p>
      {sent ? (
        <div className="mt-6 rounded-lg border border-primary bg-primary/10 p-8 text-center">
          <p className="text-lg">Thanks — we'll be in touch shortly.</p>
        </div>
      ) : (
        <form
          className="mt-6 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
        >
          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Name" name="combat-name" required />
            <Field label="Email" name="combat-email" type="email" required />
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Phone" name="combat-phone" type="tel" />
            <div>
              <label className="block text-xs uppercase tracking-widest mb-2">Interested in</label>
              <select className="w-full h-11 rounded-md bg-secondary border border-border px-3 text-sm focus:outline-none focus:border-primary">
                <option>Kids Kickboxing</option>
                <option>Adult Kickboxing</option>
                <option>Kids Brazilian Jiu-Jitsu</option>
                <option>Adult Brazilian Jiu-Jitsu</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest mb-2">Message</label>
            <textarea
              rows={5}
              className="w-full rounded-md bg-secondary border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary"
              placeholder="Tell us a bit about your goals or what you're looking for."
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-12 items-center rounded-md bg-primary px-6 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:brightness-110 transition"
            style={{ boxShadow: "var(--shadow-glow)" }}
          >
            Send Message
          </button>
        </form>
      )}
    </div>
  );
}

function Field({ label, name, type = "text", required }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs uppercase tracking-widest mb-2">{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        className="w-full h-11 rounded-md bg-secondary border border-border px-3 text-sm focus:outline-none focus:border-primary"
      />
    </div>
  );
}
