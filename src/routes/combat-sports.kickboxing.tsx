import { createFileRoute, Link } from "@tanstack/react-router";
import { CombatLeadForm } from "@/components/CombatLeadForm";
import { Phone, Mail, ArrowLeft, ArrowRight } from "lucide-react";
import kickboxingAdultAsset from "@/assets/kickboxing-adult.jpg.asset.json";
import kickboxingPadsTealAsset from "@/assets/kickboxing-pads-teal.jpg.asset.json";
import kickboxingPadsRedAsset from "@/assets/kickboxing-pads-red.jpg.asset.json";
import kickboxingStanceDrillAsset from "@/assets/kickboxing-stance-drill.jpg.asset.json";
import kickboxingKickBagAsset from "@/assets/kickboxing-kick-bag.jpg.asset.json";
import kickboxingHighKickPadsAsset from "@/assets/kickboxing-high-kick-pads.jpg.asset.json";

export const Route = createFileRoute("/combat-sports/kickboxing")({
  head: () => ({
    meta: [
      { title: "Kickboxing Classes in Tullahoma, TN — FIT Beyond Plus" },
      {
        name: "description",
        content:
          "Kickboxing classes in Tullahoma, TN for adults and kids. Technique, conditioning, and pad work — beginner-friendly, no experience required. Book a free trial class.",
      },
      { property: "og:title", content: "Kickboxing Classes in Tullahoma, TN — FIT Beyond Plus" },
      {
        property: "og:description",
        content:
          "In-house adult and kids kickboxing at FIT Beyond Plus. Beginner-friendly technique and conditioning classes in Tullahoma, TN.",
      },
      { property: "og:url", content: "https://fitbeyondplus.com/combat-sports/kickboxing" },
      { property: "og:image", content: kickboxingAdultAsset.url },
    ],
    links: [{ rel: "canonical", href: "https://fitbeyondplus.com/combat-sports/kickboxing" }],
  }),
  component: KickboxingPage,
});

const adultSchedule = [
  { day: "Monday", time: "6:30 – 7:30 PM" },
  { day: "Wednesday", time: "6:30 – 7:30 PM" },
  { day: "Friday", time: "6:00 – 7:00 PM" },
];

const kidsSchedule = [
  { day: "Monday", time: "5:30 – 6:15 PM" },
  { day: "Wednesday", time: "5:30 – 6:15 PM" },
];

function KickboxingPage() {
  return (
    <>
      <section className="relative border-b border-border bg-card overflow-hidden">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(600px circle at 20% 20%, oklch(0.70 0.18 235 / 0.25), transparent 60%)",
          }}
        />
        <div className="container-page relative grid lg:grid-cols-2 gap-10 items-center py-16 md:py-20">
          <div>
            <p className="text-xs tracking-[0.3em] text-primary">COMBAT SPORTS · KICKBOXING</p>
            <h1 className="mt-3 text-4xl md:text-6xl">Kickboxing Classes in Tullahoma, TN</h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-xl">
              Coached kickboxing at FIT Beyond Plus — technique, conditioning, and pad work for
              adults and kids of every experience level.
            </p>
          </div>
          <img
            src={kickboxingAdultAsset.url}
            alt="Adult kickboxing class at FIT Beyond Plus in Tullahoma"
            className="w-full h-72 md:h-96 object-cover rounded-lg border border-border"
          />
        </div>
      </section>

      <section className="container-page py-16">
        <div className="max-w-3xl">
          <p className="text-xs tracking-[0.3em] text-primary">THE PROGRAM</p>
          <h2 className="mt-3 text-3xl md:text-4xl">Real technique. Serious conditioning.</h2>
          <div className="mt-6 space-y-4 text-muted-foreground">
            <p>
              Our kickboxing classes teach the fundamentals of stance, footwork, punches, kicks,
              elbows, and knees — then layer in combinations, defense, and pad work as you progress.
              Every class blends skill development with real cardiovascular conditioning, so you
              leave sharper AND more fit than when you walked in.
            </p>
            <p>
              Classes are beginner-friendly by design. You don't need any prior martial arts or
              boxing experience. Coaches scale drills to your level, whether it's your first week or
              you've been training for years, and no sparring is required to participate.
            </p>
            <p>
              Bring athletic clothes, a water bottle, and hand wraps if you have them. Gloves are
              available to borrow while you get started.
            </p>
          </div>
        </div>
      </section>

      <section className="container-page pb-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              src: kickboxingPadsTealAsset.url,
              alt: "Adult kickboxing partner pad work with teal gloves at FIT Beyond Plus in Tullahoma",
            },
            {
              src: kickboxingHighKickPadsAsset.url,
              alt: "High kick to partner-held pads during adult kickboxing class at FIT Beyond Plus in Tullahoma",
            },
            {
              src: kickboxingKickBagAsset.url,
              alt: "Kickboxing high kick on heavy bag at FIT Beyond Plus in Tullahoma",
            },
          ].map((img) => (
            <figure
              key={img.src}
              className="overflow-hidden rounded-lg border border-border bg-card"
            >
              <img
                src={img.src}
                alt={img.alt}
                className="w-full h-72 object-cover"
                loading="lazy"
              />
            </figure>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-card">
        <div className="container-page py-16 grid lg:grid-cols-2 gap-10 items-start">
          <img
            src={kickboxingStanceDrillAsset.url}
            alt="Coach leading kickboxing stance and guard drills at FIT Beyond Plus"
            className="w-full h-72 md:h-96 object-cover rounded-lg border border-border"
          />
          <div>
            <p className="text-xs tracking-[0.3em] text-primary">FOR KIDS</p>
            <h2 className="mt-3 text-3xl md:text-4xl">Kids Kickboxing</h2>
            <p className="mt-2 text-sm uppercase tracking-widest text-muted-foreground">
              Ages 6 – 12 · Separate class times from the adult program
            </p>
            <div className="mt-6 space-y-4 text-muted-foreground">
              <p>
                A fun, structured introduction to striking arts for kids. Classes focus on
                discipline, focus, coordination, and confidence — kids learn real technique in a
                supportive, age-appropriate environment.
              </p>
              <p>
                No experience necessary. Coaches emphasize respect and effort over competition, so
                every child can progress at their own pace.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <p className="text-xs tracking-[0.3em] text-primary">CLASS SCHEDULE</p>
        <h2 className="mt-3 text-3xl md:text-4xl">Weekly Times</h2>
        <div className="mt-8 grid md:grid-cols-2 gap-8">
          <ScheduleTable heading="Adult Kickboxing" rows={adultSchedule} />
          <ScheduleTable heading="Kids Kickboxing (Ages 6 – 12)" rows={kidsSchedule} />
        </div>
      </section>

      <ContactCTA />

      <section className="container-page pb-20">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-border pt-8">
          <Link
            to="/combat-sports"
            className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Combat Sports
          </Link>
          <Link
            to="/combat-sports/bjj"
            className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary hover:brightness-110"
          >
            See Brazilian Jiu-Jitsu <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}

function ScheduleTable({
  heading,
  rows,
}: {
  heading: string;
  rows: { day: string; time: string }[];
}) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-lg font-semibold">{heading}</h3>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={r.day} className="border-b border-border last:border-b-0">
              <td className="px-6 py-3 uppercase tracking-widest text-xs text-muted-foreground">
                {r.day}
              </td>
              <td className="px-6 py-3 text-right">{r.time}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContactCTA() {
  return (
    <section className="container-page pb-16">
      <div className="rounded-lg border border-border bg-card p-8 md:p-10 text-center">
        <p className="text-xs tracking-[0.3em] text-primary">GET STARTED</p>
        <h2 className="mt-3 text-3xl md:text-4xl">Call Today to Get Started</h2>
        <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
          Call or email us to get scheduled for your first class — no obligation. Prefer we reach
          out? Drop your info below.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a
            href="tel:9318418272"
            className="inline-flex h-12 items-center gap-2 rounded-md bg-primary px-6 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:brightness-110 transition"
            style={{ boxShadow: "var(--shadow-glow)" }}
          >
            <Phone className="h-4 w-4" /> Call (931) 841-8272
          </a>
          <a
            href="mailto:station.6.fitness@gmail.com"
            className="inline-flex h-12 items-center gap-2 rounded-md border border-border px-6 text-sm font-bold uppercase tracking-wide hover:bg-secondary transition"
          >
            <Mail className="h-4 w-4" /> Email Us
          </a>
        </div>
        <p className="mt-8 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Or have us reach out
        </p>
        <CombatLeadForm discipline={"Kickboxing"} />
      </div>
    </section>
  );
}
