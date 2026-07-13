import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PageHero } from "@/components/PageHero";

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
    classes: [{ name: "Pilates Stretch", time: "8:00 AM", instructor: "Carla" }],
  },
];

export const Route = createFileRoute("/classes/schedule")({
  head: () => ({
    meta: [
      { title: "Class Schedule — FIT Beyond Plus" },
      {
        name: "description",
        content:
          "Weekly fitness class schedule at FIT Beyond Plus in Tullahoma, TN. HIIT, TRX, Barre, Yoga, Cardio, Kickboxing, and Pilates.",
      },
      { property: "og:title", content: "Class Schedule — FIT Beyond Plus" },
      { property: "og:description", content: "Weekly fitness class schedule." },
      { property: "og:url", content: "https://fitbeyondplus.com/classes/schedule" },
    ],
    links: [{ rel: "canonical", href: "https://fitbeyondplus.com/classes/schedule" }],
  }),
  component: ClassSchedule,
});

function ClassSchedule() {
  return (
    <>
      <PageHero
        eyebrow="SCHEDULE"
        title="Weekly class schedule"
        description="Find your class and plan your week. All classes are included with any FIT membership or $10 drop-in."
      />

      <section className="container-page pb-20">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div className="text-sm text-muted-foreground">
            Included with FIT membership · $10 drop-in
          </div>
          <Link
            to="/classes"
            className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary hover:gap-3 transition-all"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Classes
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {schedule.map((d) => (
            <div key={d.day} className="rounded-lg border border-border bg-card p-6 flex flex-col">
              <div className="flex items-baseline justify-between border-b border-border pb-3">
                <h3 className="text-2xl text-primary">{d.day}</h3>
                <span className="text-xs text-muted-foreground">
                  {d.classes.length} {d.classes.length === 1 ? "class" : "classes"}
                </span>
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
                    <span className="shrink-0 text-sm font-display tracking-wide text-foreground">
                      {c.time}
                    </span>
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
    </>
  );
}
