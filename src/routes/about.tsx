import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { CTASection } from "@/components/CTASection";
import weightsImg from "@/assets/about-owner.png.asset.json";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — FIT Beyond Plus | Tullahoma, TN" },
      { name: "description", content: "FIT Beyond Plus is more than a gym. Learn about our mission, our team, and how we built Tullahoma's serious training facility." },
      { property: "og:title", content: "About FIT Beyond Plus" },
      { property: "og:description", content: "Tullahoma's serious training facility. Built for every fitness level." },
    ],
  }),
  component: About,
});

function About() {
  return (
    <>
      <PageHero
        eyebrow="ABOUT US"
        title="More than a gym. A standard."
        description="FIT Beyond Plus was built around a simple belief: Tullahoma deserves a gym that is serious about training, welcoming to every fitness level, and committed to doing things the right way."
      />

      <section className="container-page py-20 grid md:grid-cols-2 gap-12 items-start">
        <img src={weightsImg.url} alt="FIT Beyond Plus owner" loading="lazy" width={1280} height={1536} className="rounded-lg border border-border" />
        <div>
          <p className="text-xs tracking-[0.3em] text-primary">OUR STORY</p>
          <h2 className="mt-3 text-3xl md:text-4xl">More than a room full of equipment.</h2>
          <p className="mt-5 text-muted-foreground leading-relaxed">
            We are here for the person starting from zero, the athlete preparing for competition, the lifter chasing strength, and the adult who simply wants to feel better and live healthier.
          </p>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            We wanted to build a facility where people could train hard without feeling judged, where beginners could ask questions without feeling embarrassed, and where serious lifters and athletes could still find the equipment and environment they need to push themselves.
          </p>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            Too many gyms fall into one of two extremes. Some are so casual that training does not feel serious. Others feel so intense that new members feel like they do not belong. FIT Beyond Plus exists in the middle.
          </p>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            We are serious about training, but we are not here for ego. We are welcoming to beginners, but we are not watered down. We believe everyone deserves a clean, well-equipped, supportive place to improve.
          </p>
        </div>
      </section>

      <section className="bg-card border-y border-border">
        <div className="container-page py-20">
          <p className="text-xs tracking-[0.3em] text-primary text-center">WHO WE ARE FOR</p>
          <h2 className="mt-3 text-3xl md:text-4xl text-center">This gym is for you if:</h2>
          <div className="mt-12 grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
            {[
              "You are new to fitness and want a place where you can start without feeling judged.",
              "You are getting back into training and need a gym that gives you confidence, consistency, and support.",
              "You are an athlete who needs to build strength, power, and durability.",
              "You are a serious lifter who wants quality equipment and a focused environment.",
              "You are a busy adult who wants to take care of your health and feel better day to day.",
              "You are someone who wants to train around people who respect effort.",
            ].map((line) => (
              <div key={line} className="flex gap-4 border border-border bg-background p-5 rounded-lg">
                <span className="text-primary font-display">/</span>
                <p className="text-sm text-muted-foreground">{line}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 text-center text-muted-foreground">
            You do not have to be in shape before joining. That is what the gym is for.
          </p>
        </div>
      </section>

      <section className="container-page py-20">
        <h2 className="text-3xl md:text-4xl text-center">What we stand for</h2>
        <div className="mt-14 grid md:grid-cols-2 gap-8">
          {[
            { n: "01", t: "Effort Over Ego", d: "We respect the work, not the image. You do not have to lift the most weight, look a certain way, or already know everything. If you are showing up and trying to improve, you belong here." },
            { n: "02", t: "Coaching That Matters", d: "Good coaching is more than counting reps. It means listening, teaching, correcting, encouraging, and helping people train with purpose." },
            { n: "03", t: "A Space That Delivers", d: "A gym should be clean, organized, well-equipped, and maintained. We want members to feel proud of where they train." },
            { n: "04", t: "Serious But Welcoming", d: "We believe training should be taken seriously, but that does not mean the gym should feel intimidating. Beginners and advanced lifters can share the same space when the culture is built on respect." },
          ].map((v) => (
            <div key={v.t} className="border border-border bg-card p-8 rounded-lg">
              <div className="text-5xl text-primary font-display">{v.n}</div>
              <h3 className="mt-4 text-xl">{v.t}</h3>
              <p className="mt-3 text-sm text-muted-foreground">{v.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-card border-y border-border">
        <div className="container-page py-20 max-w-3xl mx-auto text-center">
          <p className="text-xs tracking-[0.3em] text-primary">MEET THE TEAM</p>
          <h2 className="mt-3 text-3xl md:text-4xl">The people behind FIT Beyond Plus</h2>
          <p className="mt-5 text-muted-foreground leading-relaxed">
            FIT Beyond Plus is built and operated by people who care about training, health, performance, and the local community.
          </p>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            Our team is here to help members feel comfortable, answer questions, provide guidance, and keep the gym moving in the right direction.
          </p>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            Whether you need coaching, accountability, or just a place to train consistently, we are here to help you take the next step.
          </p>
        </div>
      </section>

      <section className="container-page py-20 text-center">
        <h2 className="text-3xl md:text-4xl">Come see what we're building.</h2>
        <p className="mt-4 max-w-xl mx-auto text-muted-foreground">Book a tour, meet the team, and see if FIT Beyond Plus is the right fit for you.</p>
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
