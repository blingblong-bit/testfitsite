import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { submitLead } from "@/lib/leads";
import { MapPin, Phone, Mail, Clock } from "lucide-react";
import { PageHero } from "@/components/PageHero";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact & Book a Tour — FIT Beyond Plus" },
      { name: "description", content: "Visit FIT Beyond Plus in Tullahoma, TN. Book a free tour, ask a question, or sign up for a membership." },
      { property: "og:title", content: "Contact & Book a Tour — FIT Beyond Plus" },
      { property: "og:description", content: "Visit FIT Beyond Plus at 449 W Lincoln St, Tullahoma, TN. Book a free tour, ask a question, or start your membership today." },
      { property: "og:url", content: "https://fitbeyondplus.com/contact" },
    ],
    links: [{ rel: "canonical", href: "https://fitbeyondplus.com/contact" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HealthClub",
          "@id": "https://fitbeyondplus.com/#business",
          name: "FIT Beyond Plus",
          description: "A serious gym and training facility in Tullahoma, Tennessee.",
          url: "https://fitbeyondplus.com",
          telephone: "+1-931-222-4449",
          address: {
            "@type": "PostalAddress",
            streetAddress: "449 W Lincoln St",
            addressLocality: "Tullahoma",
            addressRegion: "TN",
            postalCode: "37388",
            addressCountry: "US",
          },
          openingHoursSpecification: [
            { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "09:00", closes: "20:00" },
            { "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "09:00", closes: "18:00" },
            { "@type": "OpeningHoursSpecification", dayOfWeek: "Sunday", opens: "10:00", closes: "17:00" },
          ],
        }),
      },
    ],
  }),
  component: Contact,
});

function Contact() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    try {
      await submitLead({
        source: "general_contact",
        name: String(data.get("name") ?? ""),
        email: String(data.get("email") ?? ""),
        phone: String(data.get("phone") ?? ""),
        interest: String(data.get("interest") ?? ""),
        message: String(data.get("message") ?? ""),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHero
        eyebrow="CONTACT"
        title="Stop by. Book a tour. Get started."
        description="Tell us what you're looking for and we'll get back to you within one business day. Or just walk in — we're here."
      />

      <section className="container-page py-20 grid lg:grid-cols-5 gap-12">
        <div className="lg:col-span-3">
          <h2 className="text-2xl md:text-3xl">Send us a message</h2>
          {sent ? (
            <div className="mt-8 rounded-lg border border-primary bg-primary/10 p-8 text-center">
              <p className="text-lg">Thanks — your message was received. We'll be in touch shortly.</p>
            </div>
          ) : (
            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div className="grid sm:grid-cols-2 gap-5">
                <Field label="Name" name="name" required />
                <Field label="Email" name="email" type="email" required />
              </div>
              <div className="grid sm:grid-cols-2 gap-5">
                <Field label="Phone" name="phone" type="tel" />
                <div>
                  <label htmlFor="interest" className="block text-xs uppercase tracking-widest mb-2">Interested in</label>
                  <select
                    id="interest"
                    name="interest"
                    defaultValue="Book a tour"
                    className="w-full h-11 rounded-md bg-secondary border border-border px-3 text-sm focus:outline-none focus:border-primary"
                  >
                    <option>Book a tour</option>
                    <option>Classes</option>
                    <option>Membership question</option>
                    <option>Personal training</option>
                    <option>Something else</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="message" className="block text-xs uppercase tracking-widest mb-2">Message</label>
                <textarea
                  id="message"
                  name="message"
                  rows={5}
                  className="w-full rounded-md bg-secondary border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  placeholder="Tell us a bit about your goals or what you're looking for."
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-12 items-center rounded-md bg-primary px-6 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:brightness-110 transition disabled:opacity-60"
                style={{ boxShadow: "var(--shadow-glow)" }}
              >
                {submitting ? "Sending..." : "Send Message"}
              </button>
            </form>
          )}
        </div>

        <aside className="lg:col-span-2 space-y-6">
          <InfoCard icon={MapPin} title="Visit">
            449 W Lincoln St<br />Tullahoma, TN, United States, Tennessee
          </InfoCard>
          <InfoCard icon={Phone} title="Call">
            <a href="tel:9312224449" className="hover:text-primary">(931) 222-4449</a>
          </InfoCard>
          <InfoCard icon={Mail} title="Email">
            <a href="mailto:Info@fitbeyondplus.com" className="hover:text-primary">Info@fitbeyondplus.com</a>
          </InfoCard>
          <InfoCard icon={Clock} title="Hours">
            Staffed: Mon–Fri 9a–8p · Sat 9a–6p · Sun 10a–5p<br />
            Member access: 24/7
          </InfoCard>
        </aside>
      </section>
    </>
  );
}

function Field({ label, name, type = "text", required }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs uppercase tracking-widest mb-2">{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        className="w-full h-11 rounded-md bg-secondary border border-border px-3 text-sm focus:outline-none focus:border-primary"
      />
    </div>
  );
}

function InfoCard({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-md bg-primary/15 text-primary flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-base">{title}</h3>
      </div>
      <div className="mt-3 text-sm text-muted-foreground leading-relaxed">{children}</div>
    </div>
  );
}
