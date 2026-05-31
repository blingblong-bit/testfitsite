interface PageHeroProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function PageHero({ eyebrow, title, description }: PageHeroProps) {
  return (
    <section className="relative border-b border-border bg-card overflow-hidden">
      <div
        className="absolute inset-0 opacity-30"
        style={{ background: "radial-gradient(600px circle at 20% 20%, oklch(0.70 0.18 235 / 0.25), transparent 60%)" }}
      />
      <div className="container-page relative py-20 md:py-28">
        <p className="text-xs tracking-[0.3em] text-primary">{eyebrow}</p>
        <h1 className="mt-3 text-5xl md:text-6xl max-w-3xl">{title}</h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">{description}</p>
      </div>
    </section>
  );
}
