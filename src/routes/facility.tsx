import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { CTASection } from "@/components/CTASection";
import trainingLegPressAsset from "@/assets/facility-training-legpress.jpg.asset.json";
import cardioRowAsset from "@/assets/facility-cardio-row.jpg.asset.json";
import fullFloorAsset from "@/assets/facility-full-floor.jpg.asset.json";
import strengthTrainingAsset from "@/assets/facility-strength-training.jpg.asset.json";
import brandingBenchAsset from "@/assets/facility-branding-bench.jpg.asset.json";
import dumbbellsAsset from "@/assets/facility-dumbbells.jpg.asset.json";

export const Route = createFileRoute("/facility")({
  head: () => ({
    meta: [
      { title: "Facility — FIT Beyond Plus | Tullahoma, TN" },
      {
        name: "description",
        content:
          "A clean, organized, well-equipped training facility in Tullahoma, TN. Built for beginners, athletes, and serious lifters.",
      },
      { property: "og:title", content: "FIT Beyond Plus Facility" },
      { property: "og:description", content: "Room to train. Tools to progress." },
      { property: "og:image", content: fullFloorAsset.url },
    ],
  }),
  component: Facility,
});

const galleryPhotos = [
  {
    src: fullFloorAsset.url,
    title: "Full gym floor",
    alt: "Wide view of the FIT Beyond Plus gym floor with cardio and strength equipment.",
  },
  {
    src: cardioRowAsset.url,
    title: "Cardio area",
    alt: "Row of treadmills and cardio machines inside FIT Beyond Plus.",
  },
  {
    src: strengthTrainingAsset.url,
    title: "Strength machines",
    alt: "Member training on strength equipment inside FIT Beyond Plus.",
  },
  {
    src: dumbbellsAsset.url,
    title: "Dumbbells & free weights",
    alt: "Member using dumbbells in the free weight area at FIT Beyond Plus.",
  },
  {
    src: trainingLegPressAsset.url,
    title: "Coaching & training",
    alt: "Members training on leg press and cardio equipment at FIT Beyond Plus.",
  },
  {
    src: brandingBenchAsset.url,
    title: "Branding & training space",
    alt: "Incline bench area with FIT Beyond Plus branding visible in the background.",
  },
];

const sections = [
  {
    img: trainingLegPressAsset.url,
    eyebrow: "STRENGTH EQUIPMENT",
    title: "Strength equipment for real training.",
    body: "FIT Beyond Plus includes quality strength equipment for real training, including free weights, machines, racks, benches, platforms, plate-loaded equipment, and dumbbells. Whether your goal is building muscle, improving strength, training for sport, or simply becoming more confident in the gym, you will have the equipment you need.",
    alt: "Members training in the strength area at FIT Beyond Plus.",
  },
  {
    img: cardioRowAsset.url,
    eyebrow: "CARDIO AREA",
    title: "Cardio space with room to move.",
    body: "Our cardio area gives members a clean, open space for conditioning, warmups, interval training, and steady-state work. Treadmills and additional machines are laid out for comfort, visibility, and a smooth training flow throughout the facility.",
    alt: "Cardio equipment lined up inside FIT Beyond Plus.",
  },
  {
    img: fullFloorAsset.url,
    eyebrow: "FULL FACILITY VIEW",
    title: "A full gym floor built for every level.",
    body: "From first-time members to experienced lifters, the full gym floor is designed to feel open, organized, and ready for serious work. You have space to train, equipment to progress, and an environment that supports both everyday fitness and long-term performance goals.",
    alt: "Wide view of the full gym floor at FIT Beyond Plus.",
  },
];

function Facility() {
  return (
    <>
      <PageHero
        eyebrow="THE FACILITY"
        title="A facility built for real training."
        description="FIT Beyond Plus gives members access to a clean, organized, and well-equipped training environment built for strength, fitness, performance, and long-term progress. From beginners learning the basics to experienced lifters pushing heavy weight, our facility supports a wide range of training goals."
      />

      <section className="container-page py-16 md:py-20">
        <div className="max-w-3xl">
          <p className="text-xs tracking-[0.3em] text-primary">TAKE A LOOK INSIDE</p>
          <h2 className="mt-3 text-3xl md:text-4xl">See the space before you train.</h2>
          <p className="mt-5 text-muted-foreground leading-relaxed">
            Explore a quick look at the cardio area, strength floor, free weights, and training
            spaces that make FIT Beyond Plus clean, professional, and ready for every level.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {galleryPhotos.map((photo) => (
            <figure
              key={photo.title}
              className="overflow-hidden rounded-lg border border-border bg-card"
            >
              <div className="aspect-[3/2] overflow-hidden bg-muted">
                <img
                  src={photo.src}
                  alt={photo.alt}
                  loading="lazy"
                  width={1200}
                  height={800}
                  className="h-full w-full object-cover object-center"
                />
              </div>
            </figure>
          ))}
        </div>
      </section>

      <section className="container-page pb-20 max-w-3xl">
        <p className="text-xs tracking-[0.3em] text-primary">FACILITY OVERVIEW</p>
        <h2 className="mt-3 text-3xl md:text-4xl">Room to train. Tools to progress.</h2>
        <p className="mt-5 text-muted-foreground leading-relaxed">
          Our facility gives members access to the equipment and space they need to train with
          purpose. Whether you are building strength, improving your health, training for sport, or
          getting back into a routine, FIT Beyond Plus gives you a place to work at your level and
          keep moving forward.
        </p>
      </section>

      <section className="container-page pb-20 space-y-20">
        {sections.map((section, i) => (
          <div
            key={section.title}
            className={`grid items-center gap-10 md:grid-cols-2 ${i % 2 ? "md:[&>*:first-child]:order-2" : ""}`}
          >
            <img
              src={section.img}
              alt={section.alt}
              loading="lazy"
              width={1200}
              height={800}
              className="aspect-[3/2] w-full rounded-lg border border-border object-cover object-center"
            />
            <div>
              <p className="text-xs tracking-[0.3em] text-primary">{section.eyebrow}</p>
              <h2 className="mt-3 text-3xl md:text-4xl">{section.title}</h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">{section.body}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="bg-card border-y border-border">
        <div className="container-page py-20 max-w-3xl mx-auto text-center">
          <p className="text-xs tracking-[0.3em] text-primary">CLEAN &amp; MAINTAINED</p>
          <h2 className="mt-3 text-3xl md:text-4xl">Clean. Organized. Maintained.</h2>
          <p className="mt-5 text-muted-foreground leading-relaxed">
            A gym should feel like a place you want to return to. We focus on keeping the facility
            clean, the equipment maintained, and the training space organized so members can focus
            on their workout.
          </p>
        </div>
      </section>

      <section className="container-page py-20 text-center">
        <h2 className="text-3xl md:text-4xl">Want to see the facility in person?</h2>
        <p className="mt-4 max-w-xl mx-auto text-muted-foreground">
          Come take a tour and see the equipment, layout, and environment for yourself.
        </p>
        <div className="mt-8">
          <Link
            to="/contact"
            className="inline-flex h-12 items-center rounded-md bg-primary px-6 text-sm font-bold uppercase tracking-wide text-primary-foreground"
            style={{ boxShadow: "var(--shadow-glow)" }}
          >
            Book a Tour
          </Link>
        </div>
      </section>

      <CTASection />
    </>
  );
}
