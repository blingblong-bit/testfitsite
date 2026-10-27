import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ClipboardList, Dumbbell, LineChart, MessageSquare, Salad, CalendarCheck } from "lucide-react";
import { submitLead } from "@/lib/leads";
import { SmsConsentCheckbox } from "@/components/SmsConsent";
import ptAsset from "@/assets/personal-training.jpg.asset.json";

export const Route = createFileRoute("/beat-the-holidays")({
  head: () => ({
    meta: [
      { title: "Beat the Holidays Coaching Program — FIT Beyond Plus Tullahoma" },
      {
        name: "description",
        content:
          "8 one-on-one personal training sessions, 3 months of gym access, body scans, and weekly coach check-ins for $550 in Tullahoma, TN.",
      },
      { property: "og:title", content: "Beat the Holidays — $550 Coaching Program in Tullahoma" },
      {
        property: "og:description",
        content:
          "Start before January: 8 personal training sessions, 3 months of gym access, body scans, and weekly accountability.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://fitbeyondplus.com/beat-the-holidays" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://fitbeyondplus.com/beat-the-holidays" }],
  }),
  component: BeatTheHolidays,
});

const INCLUDED = [
  { icon: Dumbbell, title: "8 personal training sessions", body: "45-minute one-on-one sessions, about once a week, with a FIT coach." },
  { icon: CalendarCheck, title: "3 months of gym access", body: "Train on your own between sessions, through the holidays and into January." },
  { icon: LineChart, title: "Starting and ending body scans", body: "See where you begin and how things change." },
  { icon: ClipboardList, title: "Your own workout plan", body: "Know exactly what to do on the days you train alone." },
  { icon: Salad, title: "Practical nutrition guidance", body: "A simple template that works with real life and holiday meals." },
  { icon: MessageSquare, title: "Weekly check-ins", body: "A real coach reviews your progress each week and helps you adjust." },
];

const STEPS = [
  "Send the short form below.",
  "A FIT staff member reaches out to answer questions and set your first visit.",
  "At your first visit: starting assessment, body scan, and your personal goal.",
  "Enroll at the front desk, get your plan, and start training.",
];

function BeatTheHolidays() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [smsConsent, setSmsConsent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    const phone = String(data.get("phone") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const goal = String(data.get("goal") ?? "").trim();
    const availability = String(data.get("availability") ?? "").trim();
    if (!phone) {
      setError("Please add your phone number so a coach can reach you.");
      return;
    }
    if (!smsConsent) {
      setError("Please check the box to consent to text messages.");
      return;
    }
    setSubmitting(true);
    try {
      await submitLead({
        source: "beat_the_holidays",
        name: String(data.get("name") ?? ""),
        email,
        phone,
        interest: "Personal training",
        message: `Beat the Holidays program ($550) inquiry.\nMain goal: ${goal || "—"}\nPreferred training times: ${availability || "—"}`,
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
      <section className="border-b border-border bg-card">
        <div className="container-page py-16 md:py-24 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs tracking-[0.3em] text-primary">HOLIDAY COACHING PROGRAM · TULLAHOMA</p>
            <h1 className="mt-4 text-4xl md:text-6xl">Beat the Holidays.</h1>
            <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
              Don't wait for January. Get a coach, a plan, and weekly accountability to stay consistent
              through the busiest time of year.
            </p>
            <p className="mt-6 text-3xl font-bold">
              $550 <span className="text-base font-normal text-muted-foreground">per person</span>
            </p>
            <a
              href="#inquire"
              className="mt-8 inline-flex h-12 items-center rounded-md bg-primary px-6 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:brightness-110 transition"
              style={{ boxShadow: "var(--shadow-glow)" }}
            >
              Ask about a spot
            </a>
          </div>
          <img
            src={ptAsset.url}
            alt="FIT Beyond coach training a client in Tullahoma"
            className="rounded-lg border border-border w-full max-h-[520px] object-cover"
          />
        </div>
      </section>

      <section className="container-page py-16">
        <h2 className="text-3xl md:text-4xl">What's included</h2>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {INCLUDED.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-lg border border-border bg-card p-6">
              <div className="h-10 w-10 rounded-md bg-primary/15 text-primary flex items-center justify-center">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page pb-16 grid md:grid-cols-2 gap-10">
        <div>
          <h2 className="text-3xl">Who it's for</h2>
          <ul className="mt-6 space-y-3 text-muted-foreground">
            {[
              "Adults who want structure and someone in their corner",
              "Beginners who don't know where to start",
              "People getting back into a routine after time off",
              "Anyone who wants a head start before the new year",
            ].map((t) => (
              <li key={t} className="flex gap-3">
                <Check className="h-5 w-5 text-primary shrink-0" /> {t}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted-foreground">
            No crash diets and no promised results — just coaching, a plan, and consistency. You set a
            realistic personal goal with your coach at the start.
          </p>
        </div>
        <div>
          <h2 className="text-3xl">How it works</h2>
          <ol className="mt-6 space-y-4">
            {STEPS.map((s, i) => (
              <li key={s} className="flex gap-4">
                <span className="h-8 w-8 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                  {i + 1}
                </span>
                <span className="pt-1 text-muted-foreground">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="inquire" className="border-t border-border bg-card">
        <div className="container-page py-16 max-w-2xl">
          <h2 className="text-3xl md:text-4xl">Ask about a spot</h2>
          <p className="mt-3 text-muted-foreground">
            Spots are limited by coach availability. Send this and we'll follow up to answer
            questions and set up your first visit.
          </p>
          {sent ? (
            <div className="mt-8 rounded-lg border border-primary bg-primary/10 p-8">
              <p className="text-lg font-semibold">Thanks — we got your request.</p>
              <p className="mt-2 text-muted-foreground">
                A FIT staff member will call or text you, usually within one business day, to talk
                through the program and find a time for your starting assessment. Questions now? Call{" "}
                <a href="tel:9312224449" className="text-primary underline">(931) 222-4449</a>.
              </p>
            </div>
          ) : (
            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div className="grid sm:grid-cols-2 gap-5">
                <Field label="Name" name="name" required />
                <Field label="Phone" name="phone" type="tel" required />
              </div>
              <Field label="Email (optional)" name="email" type="email" />
              <Field label="Main goal" name="goal" placeholder="e.g. get stronger, lose weight, build a routine" />
              <Field label="Best times to train" name="availability" placeholder="e.g. weekday mornings, Tue/Thu evenings" />
              <SmsConsentCheckbox checked={smsConsent} onChange={setSmsConsent} />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-12 items-center rounded-md bg-primary px-6 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:brightness-110 transition disabled:opacity-60"
              >
                {submitting ? "Sending..." : "Send my request"}
              </button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs uppercase tracking-widest mb-2">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full h-11 rounded-md bg-secondary border border-border px-3 text-sm focus:outline-none focus:border-primary"
      />
    </div>
  );
}
