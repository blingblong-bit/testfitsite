import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { ClassesCTA } from "@/components/ClassesCTA";
import barreAbsAsset from "@/assets/barre-abs.jpg.asset.json";
import cardioLiftAsset from "@/assets/cardio-lift-v2.jpg.asset.json";
import trxAsset from "@/assets/trx.jpg.asset.json";
import fitHiitAsset from "@/assets/fit-hiit.jpg.asset.json";
import kickboxingAsset from "@/assets/kickboxing.jpg.asset.json";
import yogaAsset from "@/assets/yoga.jpg.asset.json";

export const Route = createFileRoute("/classes/")({
  head: () => ({
    meta: [
      { title: "Fitness Classes — FIT Beyond Plus" },
      { name: "description", content: "Group fitness classes in Tullahoma, TN: HIIT, TRX, Barre, Yoga, Cardio, Kickboxing, Pilates. Included with FIT membership or $10 drop-in." },
      { property: "og:title", content: "Fitness Classes — FIT Beyond Plus" },
      { property: "og:description", content: "HIIT, TRX, Barre, Yoga, Cardio, Kickboxing, and Pilates in Tullahoma, TN. Included with FIT membership or $10 drop-in." },
      { property: "og:url", content: "https://fitbeyondplus.com/classes" },
    ],
    links: [{ rel: "canonical", href: "https://fitbeyondplus.com/classes" }],
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
    </>
  );
}
