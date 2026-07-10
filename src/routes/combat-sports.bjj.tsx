import { createFileRoute, Link } from "@tanstack/react-router";
import { Phone, Mail, ArrowLeft, ArrowRight } from "lucide-react";
import bjjAdultAsset from "@/assets/bjj-adult.jpg.asset.json";
import bjjKidsAsset from "@/assets/bjj-kids.jpg.asset.json";

export const Route = createFileRoute("/combat-sports/bjj")({
  head: () => ({
    meta: [
      { title: "Brazilian Jiu-Jitsu Classes in Tullahoma, TN — FIT Beyond Plus" },
      {
        name: "description",
        content:
          "Brazilian Jiu-Jitsu classes in Tullahoma, TN for adults and kids. Gi grappling, leverage-based technique — beginner through advanced. Book a free trial class.",
      },
      {
        property: "og:title",
        content: "Brazilian Jiu-Jitsu Classes in Tullahoma, TN — FIT Beyond Plus",
      },
      {
        property: "og:description",
        content:
          "In-house adult and kids Brazilian Jiu-Jitsu at FIT Beyond Plus. Gi grappling classes in Tullahoma, TN, beginner through advanced.",
      },
      { property: "og:url", content: "https://fitbeyondplus.com/combat-sports/bjj" },
      { property: "og:image", content: bjjAdultAsset.url },
    ],
    links: [{ rel: "canonical", href: "https://fitbeyondplus.com/combat-sports/bjj" }],
  }),
  component: BjjPage,
});

const adultSchedule = [
  { day: "Tuesday", time: "6:30 – 8:00 PM" },
  { day: "Thursday", time: "6:30 – 8:00 PM" },
  { day: "Saturday", time: "11:00 AM – 12:30 PM" },
];

const kidsSchedule = [
  { day: "Tuesday", time: "5:30 – 6:15 PM" },
  { day: "Thursday", time: "5:30 – 6:15 PM" },
  { day: "Saturday", time: "10:00 – 10:45 AM" },
];

function BjjPage() {
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
            <p className="text-xs tracking-[0.3em] text-primary">COMBAT SPORTS · BJJ</p>
            <h1 className="mt-3 text-4xl md:text-6xl">
              Brazilian Jiu-Jitsu Classes in Tullahoma, TN
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-xl">
              Coached gi grappling at FIT Beyond Plus — leverage and technique over size and
              strength, for adults and kids of every experience level.
            </p>
          </div>
          <img
            src={bjjAdultAsset.url}
            alt="Adult Brazilian Jiu-Jitsu class rolling on the mats at FIT Beyond Plus in Tullahoma"
            className="w-full h-72 md:h-96 object-cover rounded-lg border border-border"
          />
        </div>
      </section>

      <section className="container-page py-16">
        <div className="max-w-3xl">
          <p className="text-xs tracking-[0.3em] text-primary">THE PROGRAM</p>
          <h2 className="mt-3 text-3xl md:text-4xl">
            Leverage and technique over size and strength.
          </h2>
          <div className="mt-6 space-y-4 text-muted-foreground">
            <p>
              Our Brazilian Jiu-Jitsu program is a traditional gi grappling curriculum built on
              positional control, escapes, sweeps, and submissions. Classes progress from
              fundamentals through advanced concepts, so every training partner — from the
              first-time white belt to the seasoned upper belt — gets a real challenge.
            </p>
            <p>
              BJJ rewards patience, problem-solving, and consistency. You'll learn to stay calm
              under pressure, use leverage instead of raw force, and control an opponent by
              understanding position and timing. Beginners are welcome; the mat is a place to
              learn, not to prove anything.
            </p>
            <p>
              Bring a clean gi (loaners available for your first class), a mouthguard, and
              flip-flops for off-the-mat. Trim your nails and leave the jewelry at home.
            </p>
          </div>
        </div>
      </section>

      <section className="container-page pb-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              src: bjjAdultAsset.url,
              alt: "Adult Brazilian Jiu-Jitsu drilling technique at FIT Beyond Plus",
            },
            {
              src: bjjKidsAsset.url,
              alt: "Kids Brazilian Jiu-Jitsu class at FIT Beyond Plus in Tullahoma",
            },
            {
              src: bjjAdultAsset.url,
              alt: "Adult Brazilian Jiu-Jitsu open mat session at FIT Beyond Plus",
            },
          ].map((img, idx) => (
            <figure
              key={`${img.src}-${idx}`}
              className="overflow-hidden rounded-lg border border-border bg-card"
            >
              <img src={img.src} alt={img.alt} className="w-full h-72 object-cover" loading="lazy" />
            </figure>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-card">
        <div className="container-page py-16 grid lg:grid-cols-2 gap-10 items-start">
          <img
            src={bjjKidsAsset.url}
            alt="Kids Brazilian Jiu-Jitsu class at FIT Beyond Plus in Tullahoma"
            className="w-full h-72 md:h-96 object-cover rounded-lg border border-border"
          />
          <div>
            <p className="text-xs tracking-[0.3em] text-primary">FOR KIDS</p>
            <h2 className="mt-3 text-3xl md:text-4xl">Kids BJJ</h2>
            <p className="mt-2 text-sm uppercase tracking-widest text-muted-foreground">
              Ages 5 – 12 · Separate class times from the adult program
            </p>
            <div className="mt-6 space-y-4 text-muted-foreground">
              <p>
                A safe, structured environment where kids learn real Brazilian Jiu-Jitsu.
                Classes focus on positional control, respectful sparring, discipline, and
                self-defense fundamentals — no striking, no ego.
              </p>
              <p>
                Great for building confidence, focus, and coordination. Every student progresses
                at their own pace with age-appropriate curriculum and hands-on coaching.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <p className="text-xs tracking-[0.3em] text-primary">CLASS SCHEDULE</p>
        <h2 className="mt-3 text-3xl md:text-4xl">Weekly Times</h2>
        <div className="mt-8 grid md:grid-cols-2 gap-8">
          <ScheduleTable heading="Adult BJJ" rows={adultSchedule} />
          <ScheduleTable heading="Kids BJJ (Ages 5 – 12)" rows={kidsSchedule} />
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
            to="/combat-sports/kickboxing"
            className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary hover:brightness-110"
          >
            See Kickboxing <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}

function ScheduleTable({ heading, rows }: { heading: string; rows: { day: string; time: string }[] }) {
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
        <h2 className="mt-3 text-3xl md:text-4xl">Book a Free Trial Class</h2>
        <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
          Reach out directly and we'll get you scheduled for your first class — no obligation.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a
            href="tel:9318418272"
            className="inline-flex h-12 items-center gap-2 rounded-md bg-primary px-6 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:brightness-110 transition"
            style={{ boxShadow: "var(--shadow-glow)" }}
          >
            <Phone className="h-4 w-4" /> Book a Free Trial Class
          </a>
          <a
            href="tel:9318418272"
            className="inline-flex h-12 items-center gap-2 rounded-md border border-border px-6 text-sm font-bold uppercase tracking-wide hover:bg-secondary transition"
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
    </section>
  );
}
