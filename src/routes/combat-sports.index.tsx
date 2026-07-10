import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import kickboxingAdultAsset from "@/assets/kickboxing-adult.jpg.asset.json";
import bjjAdultAsset from "@/assets/bjj-adult.jpg.asset.json";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/combat-sports/")({
  head: () => ({
    meta: [
      { title: "Combat Sports Training in Tullahoma, TN — FIT Beyond Plus" },
      {
        name: "description",
        content:
          "Kickboxing and Brazilian Jiu-Jitsu at FIT Beyond Plus in Tullahoma, TN. Coached in-house for kids and adults, all skill levels welcome.",
      },
      { property: "og:title", content: "Combat Sports Training — FIT Beyond Plus" },
      {
        property: "og:description",
        content:
          "In-house Kickboxing and Brazilian Jiu-Jitsu programs for kids and adults in Tullahoma, TN.",
      },
      { property: "og:url", content: "https://fitbeyondplus.com/combat-sports" },
    ],
    links: [{ rel: "canonical", href: "https://fitbeyondplus.com/combat-sports" }],
  }),
  component: CombatSportsHub,
});

function CombatSportsHub() {
  return (
    <>
      <PageHero
        eyebrow="COMBAT SPORTS"
        title="Combat Sports Training"
        description="Kickboxing and Brazilian Jiu-Jitsu, coached in-house at FIT Beyond Plus. Programs for kids and adults, all skill levels — no experience required."
      />

      <section className="container-page py-16">
        <div className="grid md:grid-cols-2 gap-8">
          <DisciplineTile
            to="/combat-sports/kickboxing"
            image={kickboxingAdultAsset.url}
            alt="Adult kickboxing class training pads at FIT Beyond Plus in Tullahoma"
            eyebrow="STRIKING"
            title="Kickboxing"
            description="Sharpen technique, build conditioning, and burn calories with pad work, combinations, and drills. Beginner-friendly classes for adults and separate programs for kids."
          />
          <DisciplineTile
            to="/combat-sports/bjj"
            image={bjjAdultAsset.url}
            alt="Adult Brazilian Jiu-Jitsu class rolling on the mats at FIT Beyond Plus"
            eyebrow="GRAPPLING"
            title="Brazilian Jiu-Jitsu"
            description="Learn gi grappling and leverage-based self defense. Structured curriculum from white belt fundamentals through advanced training, with a dedicated kids program."
          />
        </div>
      </section>
    </>
  );
}

function DisciplineTile({
  to,
  image,
  alt,
  eyebrow,
  title,
  description,
}: {
  to: "/combat-sports/kickboxing" | "/combat-sports/bjj";
  image: string;
  alt: string;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary"
    >
      <img
        src={image}
        alt={alt}
        className="w-full h-72 md:h-96 object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        loading="lazy"
      />
      <div className="p-8">
        <p className="text-xs tracking-[0.3em] text-primary">{eyebrow}</p>
        <h2 className="mt-2 text-3xl md:text-4xl">{title}</h2>
        <p className="mt-4 text-muted-foreground">{description}</p>
        <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary">
          Explore {title} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}
