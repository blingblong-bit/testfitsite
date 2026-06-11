import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { CTASection } from "@/components/CTASection";
import barreAbsAsset from "@/assets/barre-abs.jpg.asset.json";
import kickboxingLiftAsset from "@/assets/kickboxing-lift.jpg.asset.json";

export const Route = createFileRoute("/classes")({
  head: () => ({
    meta: [
      { title: "Fitness Classes — FIT Beyond Plus" },
      { name: "description", content: "Weekly fitness class schedule at FIT Beyond Plus in Tullahoma, TN. HIIT, TRX, Barre, Yoga, Cardio, Kickboxing, and Pilates — included with FIT membership or $10 drop-in." },
      { property: "og:title", content: "Fitness Classes — FIT Beyond Plus" },
      { property: "og:description", content: "Included with FIT membership or $10 drop-in." },
    ],
  }),
  component: Classes,
});

type ClassItem = { name: string; time: string; instructor?: string };

const schedule: { day: string; classes: ClassItem[] }[] = [
  {
    day: "Monday",
    classes: [
      { name: "FIT HIIT", time: "8:00 AM", instructor: "Emily" },
      { name: "TRX Circuit", time: "12:00 PM", instructor: "Emily" },
      { name: "Barre Abs", time: "4:30 PM", instructor: "Debbie" },
      { name: "Kickboxing / Lift", time: "6:15 PM", instructor: "Carla" },
    ],
  },
  {
    day: "Tuesday",
    classes: [
      { name: "Cardio Barre", time: "5:00 AM" },
      { name: "Yoga", time: "8:00 AM", instructor: "Hope" },
    ],
  },
  {
    day: "Wednesday",
    classes: [
      { name: "FIT HIIT / TRX", time: "8:00 AM", instructor: "Emily" },
      { name: "Barre Abs", time: "4:30 PM", instructor: "Debbie" },
      { name: "Cardio / Lift", time: "6:15 PM", instructor: "Carla" },
    ],
  },
  {
    day: "Thursday",
    classes: [
      { name: "Cardio Barre", time: "5:00 AM" },
      { name: "Yoga", time: "8:00 AM", instructor: "Hope" },
      { name: "Barre Abs", time: "4:30 PM", instructor: "Debbie" },
    ],
  },
  {
    day: "Friday",
    classes: [
      { name: "TRX Circuit", time: "12:00 PM", instructor: "Emily" },
      { name: "HIIT", time: "5:30 PM", instructor: "Carla" },
    ],
  },
  {
    day: "Saturday",
    classes: [
      { name: "Pilates Stretch", time: "8:00 AM", instructor: "Carla" },
    ],
  },
];

function Classes() {
  return (
    <>
      <PageHero
        eyebrow="CLASSES"
        title="Group fitness, six days a week."
        description="HIIT, TRX, Barre, Yoga, Cardio, Kickboxing, and Pilates — included with any FIT membership or $10 drop-in."
      />

      <section className="container-page pt-16">
        <div className="grid md:grid-cols-2 gap-6">
          <figure className="overflow-hidden rounded-lg border border-border bg-card">
            <img
              src={barreAbsAsset.url}
              alt="Barre Abs class at FIT Beyond Plus"
              className="w-full h-72 md:h-96 object-cover"
              loading="lazy"
            />
            <figcaption className="px-5 py-3 text-sm">
              <span className="text-xs tracking-[0.3em] text-primary">BARRE ABS</span>
              <p className="mt-1 text-muted-foreground">Low-impact strength, balance, and core work at the barre.</p>
            </figcaption>
          </figure>
          <figure className="overflow-hidden rounded-lg border border-border bg-card">
            <img
              src={kickboxingLiftAsset.url}
              alt="Kickboxing and Lift class at FIT Beyond Plus"
              className="w-full h-72 md:h-96 object-cover"
              loading="lazy"
            />
            <figcaption className="px-5 py-3 text-sm">
              <span className="text-xs tracking-[0.3em] text-primary">KICKBOXING / LIFT</span>
              <p className="mt-1 text-muted-foreground">High-energy conditioning paired with strength training.</p>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="container-page py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.3em] text-primary">WEEKLY SCHEDULE</p>
            <h2 className="mt-2 text-3xl md:text-4xl">Find your class</h2>
          </div>
          <div className="text-sm text-muted-foreground">
            Included with FIT membership · $10 drop-in
          </div>
        </div>

        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {schedule.map((d) => (
            <div key={d.day} className="rounded-lg border border-border bg-card p-6 flex flex-col">
              <div className="flex items-baseline justify-between border-b border-border pb-3">
                <h3 className="text-2xl text-primary">{d.day}</h3>
                <span className="text-xs text-muted-foreground">{d.classes.length} {d.classes.length === 1 ? "class" : "classes"}</span>
              </div>
              <ul className="mt-4 space-y-4">
                {d.classes.map((c, i) => (
                  <li key={i} className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-base font-semibold">{c.name}</p>
                      {c.instructor && (
                        <p className="text-xs text-muted-foreground mt-0.5">with {c.instructor}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-sm font-display tracking-wide text-foreground">{c.time}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-10 text-xs text-muted-foreground text-center">
          Schedule subject to change. Check in at the front desk to confirm class times.
        </p>
      </section>

      <CTASection />
    </>
  );
}
