import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { CTASection } from "@/components/CTASection";
import weights from "@/assets/gym-shoulder-press.jpg";
import cardio from "@/assets/gym-cardio-machines.jpg";
import functional from "@/assets/gym-rower-brand.jpg";
import hero from "@/assets/real-dumbbells.jpg";

export const Route = createFileRoute("/facility")({
  head: () => ({
    meta: [
      { title: "Facility — FIT Beyond Plus | Tullahoma, TN" },
      { name: "description", content: "A clean, organized, well-equipped training facility in Tullahoma, TN. Built for beginners, athletes, and serious lifters." },
      { property: "og:title", content: "FIT Beyond Plus Facility" },
      { property: "og:description", content: "Room to train. Tools to progress." },
      { property: "og:image", content: hero },
    ],
  }),
  component: Facility,
});

const sections = [
  {
    img: weights,
    eyebrow: "STRENGTH EQUIPMENT",
    title: "Strength equipment for real training.",
    body: "FIT Beyond Plus includes quality strength equipment for real training, including free weights, machines, racks, benches, platforms, plate-loaded equipment, and dumbbells. Whether your goal is building muscle, improving strength, training for sport, or simply becoming more confident in the gym, you will have the equipment you need.",
  },
  {
    img: cardio,
    eyebrow: "BEGINNER-FRIENDLY FACILITY",
    title: "New to the gym? You are welcome here.",
    body: "We know starting can be intimidating. That is why we work to keep the gym clean, organized, and approachable. You do not need to know everything before you join. You do not need to already be in shape. You do not need to train like everyone else. You just need a place to start. FIT Beyond Plus gives new members a space where they can learn, build confidence, and improve at their own pace.",
  },
  {
    img: functional,
    eyebrow: "ADVANCED TRAINING FACILITY",
    title: "Beginner-friendly does not mean basic.",
    body: "For experienced lifters and athletes, FIT Beyond Plus provides the space and equipment to train hard. Whether you are working on strength, muscle, power, conditioning, or performance, our facility gives you the tools to build a serious training routine. We are welcoming to beginners and still equipped for people who want to push themselves.",
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

      <section className="container-page py-20 max-w-3xl">
        <p className="text-xs tracking-[0.3em] text-primary">FACILITY OVERVIEW</p>
        <h2 className="mt-3 text-3xl md:text-4xl">Room to train. Tools to progress.</h2>
        <p className="mt-5 text-muted-foreground leading-relaxed">
          Our facility gives members access to the equipment and space they need to train with purpose. Whether you are building strength, improving your health, training for sport, or getting back into a routine, FIT Beyond Plus gives you a place to work at your level and keep moving forward.
        </p>
      </section>

      <section className="container-page pb-20 space-y-20">
        {sections.map((z, i) => (
          <div key={z.title} className={`grid md:grid-cols-2 gap-10 items-center ${i % 2 ? "md:[&>*:first-child]:order-2" : ""}`}>
            <img src={z.img} alt={z.title} loading="lazy" width={1280} height={896} className="rounded-lg border border-border" />
            <div>
              <p className="text-xs tracking-[0.3em] text-primary">{z.eyebrow}</p>
              <h2 className="mt-3 text-3xl md:text-4xl">{z.title}</h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">{z.body}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="bg-card border-y border-border">
        <div className="container-page py-20 max-w-3xl mx-auto text-center">
          <p className="text-xs tracking-[0.3em] text-primary">CLEAN &amp; MAINTAINED</p>
          <h2 className="mt-3 text-3xl md:text-4xl">Clean. Organized. Maintained.</h2>
          <p className="mt-5 text-muted-foreground leading-relaxed">
            A gym should feel like a place you want to return to. We focus on keeping the facility clean, the equipment maintained, and the training space organized so members can focus on their workout.
          </p>
        </div>
      </section>

      <section className="container-page py-20 text-center">
        <h2 className="text-3xl md:text-4xl">Want to see the facility in person?</h2>
        <p className="mt-4 max-w-xl mx-auto text-muted-foreground">Come take a tour and see the equipment, layout, and environment for yourself.</p>
        <div className="mt-8">
          <Link to="/contact" className="inline-flex h-12 items-center rounded-md bg-primary px-6 text-sm font-bold uppercase tracking-wide text-primary-foreground" style={{ boxShadow: "var(--shadow-glow)" }}>
            Book a Tour
          </Link>
        </div>
      </section>

      <CTASection />
    </>
  );
}
