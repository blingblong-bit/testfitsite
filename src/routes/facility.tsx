import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { CTASection } from "@/components/CTASection";
import weights from "@/assets/facility-weights.jpg";
import cardio from "@/assets/facility-cardio.jpg";
import functional from "@/assets/facility-functional.jpg";
import hero from "@/assets/hero-gym.jpg";

export const Route = createFileRoute("/facility")({
  head: () => ({
    meta: [
      { title: "Facility & Equipment — FIT Beyond Plus" },
      { name: "description", content: "15,000+ sq ft training facility in Tullahoma, TN. Premium strength equipment, cardio, turf, and functional zones." },
      { property: "og:title", content: "FIT Beyond Plus Facility" },
      { property: "og:description", content: "Premium equipment. Clean space. Built for training." },
      { property: "og:image", content: hero },
    ],
  }),
  component: Facility,
});

const zones = [
  {
    img: weights,
    title: "Free Weights",
    desc: "Dumbbells from 5–150 lb, full Olympic platforms, multiple power racks, specialty bars, bumper plates, and Hammer Strength selectorized machines.",
  },
  {
    img: cardio,
    title: "Cardio Floor",
    desc: "Rows of treadmills, ellipticals, stair-climbers, Concept2 rowers, AssaultBikes, and Echo bikes. Built for conditioning, not just steady-state.",
  },
  {
    img: functional,
    title: "Functional & Turf",
    desc: "40-foot turf lane with sleds, kettlebells, plyo boxes, battle ropes, slam balls, and rig stations for athletic and conditioning work.",
  },
];

function Facility() {
  return (
    <>
      <PageHero
        eyebrow="THE FACILITY"
        title="15,000+ sq ft. Built for serious training."
        description="Every zone is designed to give you space to move, the right equipment to progress, and the cleanliness you expect from a premium gym."
      />

      <section className="container-page py-20 space-y-20">
        {zones.map((z, i) => (
          <div key={z.title} className={`grid md:grid-cols-2 gap-10 items-center ${i % 2 ? "md:[&>*:first-child]:order-2" : ""}`}>
            <img src={z.img} alt={z.title} loading="lazy" width={1280} height={896} className="rounded-lg border border-border" />
            <div>
              <p className="text-xs tracking-[0.3em] text-primary">ZONE 0{i + 1}</p>
              <h2 className="mt-3 text-3xl md:text-4xl">{z.title}</h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">{z.desc}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="bg-card border-y border-border">
        <div className="container-page py-20">
          <h2 className="text-3xl md:text-4xl text-center">Equipment highlights</h2>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border max-w-5xl mx-auto">
            {[
              "6 Power Racks",
              "2 Olympic Platforms",
              "Hammer Strength Plate-Loaded",
              "Cybex Selectorized Line",
              "Concept2 RowErgs",
              "Echo & AssaultBikes",
              "Turf Sled Lane",
              "Functional Rig Stations",
              "Glute-Ham Developer",
              "Reverse Hyper",
              "Specialty Bars (SSB, Trap, Cambered)",
              "Dumbbells to 150 lb",
            ].map((e) => (
              <div key={e} className="bg-background p-5 text-sm">
                <span className="text-primary mr-2">/</span>{e}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-20">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { t: "Locker Rooms", d: "Full-size lockers, hot showers, towel service, hair-dryers, and clean restrooms." },
            { t: "Recovery", d: "Foam rollers, percussion guns, stretching zone, and dedicated mobility area." },
            { t: "Amenities", d: "Filtered water stations, protein & supplement bar, parking, and member Wi-Fi." },
          ].map((f) => (
            <div key={f.t} className="border border-border p-7 rounded-lg bg-card">
              <h3 className="text-xl">{f.t}</h3>
              <p className="mt-3 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <CTASection />
    </>
  );
}
