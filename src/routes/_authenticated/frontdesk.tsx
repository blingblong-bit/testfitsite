import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft, CalendarDays, CreditCard, DollarSign, Gift, LogOut, Star, Ticket, UserPlus, Check, Copy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { submitLead } from "@/lib/leads";
import { createReferral, redeemReferral } from "@/lib/referrals";

export const Route = createFileRoute("/_authenticated/frontdesk")({
  head: () => ({
    meta: [
      { title: "Front Desk — FIT Beyond Plus" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FrontDesk,
});

type Screen =
  | "home"
  | "pricing"
  | "schedule"
  | "daypass"
  | "redeem"
  | "refer"
  | "review";

const GOOGLE_REVIEW_URL = "https://search.google.com/local/writereview?placeid=ChIJ"; // placeholder

function FrontDesk() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>("home");

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/admin/login" });
  }

  return (
    <div className="min-h-[90vh] bg-background">
      <div className="container-page py-8 md:py-12">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {screen !== "home" ? (
              <button
                onClick={() => setScreen("home")}
                className="inline-flex h-11 items-center gap-2 rounded-md border border-border px-4 text-sm hover:bg-secondary"
              >
                <ArrowLeft className="h-4 w-4" /> Front Desk
              </button>
            ) : (
              <div>
                <p className="text-xs tracking-[0.3em] text-primary">FRONT DESK</p>
                <h1 className="mt-1 text-2xl md:text-3xl">How can we help you today?</h1>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate({ to: "/staff-home" })}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-border px-4 text-sm hover:bg-secondary"
            >
              <Home className="h-4 w-4" /> <span className="hidden sm:inline">Staff Home</span>
            </button>
            <button
              onClick={signOut}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-border px-4 text-sm hover:bg-secondary"
            >
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        <main className="mt-8">
          {screen === "home" && <HomeGrid go={setScreen} />}
          {screen === "pricing" && <PricingScreen />}
          {screen === "schedule" && <ScheduleScreen />}
          {screen === "daypass" && <DayPassScreen onDone={() => setScreen("home")} />}
          {screen === "redeem" && <RedeemScreen onDone={() => setScreen("home")} />}
          {screen === "refer" && <ReferScreen onDone={() => setScreen("home")} />}
          {screen === "review" && <ReviewScreen onDone={() => setScreen("home")} />}
        </main>
      </div>
    </div>
  );
}

function HomeGrid({ go }: { go: (s: Screen) => void }) {
  const tiles: { id: Screen; title: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "pricing", title: "Membership Pricing", desc: "View monthly & paid-in-full plans", icon: DollarSign },
    { id: "schedule", title: "Class Schedule", desc: "This week's classes", icon: CalendarDays },
    { id: "daypass", title: "Buy Day Pass", desc: "$10 single-day access", icon: Ticket },
    { id: "redeem", title: "Redeem Referral Code", desc: "Apply a friend's code", icon: CreditCard },
    { id: "refer", title: "Refer a Friend", desc: "Share FIT Beyond Plus", icon: UserPlus },
    { id: "review", title: "Leave a Google Review", desc: "Tell others about us", icon: Star },
  ];
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {tiles.map((t) => (
        <button
          key={t.id}
          onClick={() => go(t.id)}
          className="group text-left rounded-2xl border border-border bg-card p-7 min-h-[180px] flex flex-col justify-between hover:border-primary transition-colors"
        >
          <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            <t.icon className="h-6 w-6" />
          </div>
          <div className="mt-6">
            <h3 className="text-xl">{t.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

/* -------- INFO SCREENS -------- */

function ScreenHeader({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mb-8">
      <p className="text-xs tracking-[0.3em] text-primary">{eyebrow}</p>
      <h2 className="mt-2 text-3xl md:text-4xl">{title}</h2>
      {sub && <p className="mt-2 text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

function PricingScreen() {
  const monthly = [
    { name: "Single", price: "37", tagline: "One member. Full access." },
    { name: "Duo", price: "55", tagline: "Two adults." },
    { name: "Duo +1", price: "63", tagline: "Three adults." },
    { name: "Family", price: "72", tagline: "The whole crew." },
    { name: "Tanning", price: "25", tagline: "Unlimited tanning." },
  ];
  const paid = [
    { name: "Single — 1 Week", price: "35" },
    { name: "Single — 1 Month", price: "55" },
    { name: "Single — 3 Months", price: "111" },
    { name: "Single — 6 Months", price: "222" },
    { name: "Single — 1 Year", price: "399" },
    { name: "Duo — 1 Year", price: "605" },
    { name: "Duo +1 — 1 Year", price: "693" },
    { name: "Family — 1 Year", price: "864" },
  ];
  return (
    <>
      <ScreenHeader eyebrow="MEMBERSHIPS" title="Membership Pricing" sub="$49.99 annual fee billed July 1st · All memberships include 24/7 access, classes, sauna, & tanning." />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {monthly.map((p) => (
          <div key={p.name} className="rounded-xl border border-border bg-card p-7">
            <h3 className="text-2xl">{p.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
            <div className="mt-5 flex items-baseline gap-1">
              <span className="text-4xl font-bold">${p.price}</span>
              <span className="text-sm text-muted-foreground">/ month</span>
            </div>
          </div>
        ))}
      </div>
      <h3 className="mt-12 text-xs tracking-[0.3em] text-primary">PAID IN FULL</h3>
      <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border">
        {paid.map((p) => (
          <div key={p.name} className="bg-card p-5">
            <p className="text-sm font-semibold">{p.name}</p>
            <p className="mt-2 text-2xl font-bold">${p.price}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm text-muted-foreground">Day passes available for $10 · Active military & first responders get 15% off.</p>
    </>
  );
}

function ScheduleScreen() {
  const schedule = [
    { day: "Monday", classes: [
      { name: "FIT HIIT", time: "8:00 AM" }, { name: "TRX Circuit", time: "12:00 PM" },
      { name: "Barre Abs", time: "4:30 PM" }, { name: "Kickboxing / Lift", time: "6:15 PM" },
    ]},
    { day: "Tuesday", classes: [{ name: "Cardio Barre", time: "5:00 AM" }, { name: "Yoga", time: "8:00 AM" }]},
    { day: "Wednesday", classes: [
      { name: "FIT HIIT / TRX", time: "8:00 AM" }, { name: "Barre Abs", time: "4:30 PM" },
      { name: "Cardio / Lift", time: "6:15 PM" },
    ]},
    { day: "Thursday", classes: [
      { name: "Cardio Barre", time: "5:00 AM" }, { name: "Yoga", time: "8:00 AM" },
      { name: "Barre Abs", time: "4:30 PM" },
    ]},
    { day: "Friday", classes: [{ name: "TRX Circuit", time: "12:00 PM" }, { name: "HIIT", time: "5:30 PM" }]},
    { day: "Saturday", classes: [{ name: "Pilates Stretch", time: "8:00 AM" }]},
  ];
  return (
    <>
      <ScreenHeader eyebrow="SCHEDULE" title="Weekly Class Schedule" sub="Included with any FIT membership · $10 drop-in" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {schedule.map((d) => (
          <div key={d.day} className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-xl text-primary border-b border-border pb-3">{d.day}</h3>
            <ul className="mt-4 space-y-3">
              {d.classes.map((c, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">{c.name}</span>
                  <span className="text-sm text-muted-foreground">{c.time}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}

/* -------- FORM SCREENS -------- */

function ConfirmationCard({ title, message, onDone }: { title: string; message: string; onDone: () => void }) {
  const [seconds, setSeconds] = useState(5);
  useEffect(() => {
    if (seconds <= 0) { onDone(); return; }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds, onDone]);

  return (
    <div className="max-w-xl mx-auto rounded-2xl border border-primary bg-primary/10 p-10 text-center">
      <div className="mx-auto h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
        <Check className="h-8 w-8" />
      </div>
      <h2 className="mt-6 text-3xl">{title}</h2>
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      <p className="mt-6 text-xs uppercase tracking-widest text-primary">
        Returning in {seconds}s
      </p>
      <button
        onClick={onDone}
        className="mt-4 inline-flex h-11 items-center rounded-md border border-border px-5 text-sm hover:bg-secondary"
      >
        Back now
      </button>
    </div>
  );
}

function KioskField({
  label, name, type = "text", required, placeholder,
}: { label: string; name: string; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs uppercase tracking-widest mb-2">{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full h-14 rounded-md bg-secondary border border-border px-4 text-base focus:outline-none focus:border-primary"
      />
    </div>
  );
}

function FormShell({
  eyebrow, title, sub, children,
}: { eyebrow: string; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="max-w-2xl mx-auto">
      <ScreenHeader eyebrow={eyebrow} title={title} sub={sub} />
      {children}
    </div>
  );
}

function SubmitButton({ submitting, label }: { submitting: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={submitting}
      className="w-full inline-flex h-14 items-center justify-center rounded-md bg-primary px-6 text-base font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-60"
      style={{ boxShadow: "var(--shadow-glow)" }}
    >
      {submitting ? "Submitting..." : label}
    </button>
  );
}

type PaymentMethod = "venmo" | "paid_at_desk";

function DayPassScreen({ onDone }: { onDone: () => void }) {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"info" | "pay">("info");
  const [guest, setGuest] = useState({ name: "", email: "", phone: "" });
  const [method, setMethod] = useState<PaymentMethod | null>(null);

  function handleInfoSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    setGuest({
      name: String(d.get("name") ?? ""),
      email: String(d.get("email") ?? ""),
      phone: String(d.get("phone") ?? ""),
    });
    setStep("pay");
  }

  async function handlePaySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!method) { setError("Please select a payment method."); return; }
    setSubmitting(true); setError(null);
    try {
      await submitLead({
        source: "paid_day_pass",
        name: guest.name,
        email: guest.email,
        phone: guest.phone,
        interest: "Day Pass ($10)",
        message: `Day pass — paid via ${method}. $10 collected at front desk.`,
        status: "checked_in",
        payment_status: "confirmed",
        payment_method: method,
        day_pass_price: 10,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit.");
    } finally { setSubmitting(false); }
  }

  if (sent) return <ConfirmationCard title="You're all set!" message="Welcome to FIT Beyond Plus. Enjoy your workout." onDone={onDone} />;

  if (step === "info") {
    return (
      <FormShell eyebrow="DAY PASS" title="Buy a Day Pass" sub="$10 single-day access.">
        <form onSubmit={handleInfoSubmit} className="space-y-5">
          <KioskField label="Full name" name="name" required />
          <KioskField label="Email" name="email" type="email" required />
          <KioskField label="Phone" name="phone" type="tel" required />
          <SubmitButton submitting={false} label="Continue to Payment" />
        </form>
      </FormShell>
    );
  }

  const methods: { id: PaymentMethod; label: string }[] = [
    { id: "venmo", label: "Venmo" },
    { id: "paid_at_desk", label: "Paid at desk" },
  ];

  return (
    <FormShell eyebrow="PAYMENT" title="Confirm Payment — $10" sub={`Day pass for ${guest.name}`}>
      <form onSubmit={handlePaySubmit} className="space-y-6">
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-xs uppercase tracking-widest text-primary">Venmo</p>
          <div className="mt-4 mx-auto h-56 w-56 rounded-lg border-2 border-dashed border-border bg-secondary flex items-center justify-center">
            <span className="text-xs text-muted-foreground text-center px-4">Venmo QR code<br/>(add image here)</span>
          </div>
          <p className="mt-4 text-sm text-foreground font-semibold">
            Scan to pay $10 through Venmo, or pay at the front desk.
          </p>
        </div>

        <div>
          <p className="block text-xs uppercase tracking-widest mb-3">Payment method</p>
          <div className="grid grid-cols-2 gap-3">
            {methods.map((m) => {
              const active = method === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={`h-14 rounded-md border text-base font-semibold transition-colors ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-secondary hover:border-primary"
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <SubmitButton submitting={submitting} label="Confirm Payment & Check In" />
        <button
          type="button"
          onClick={() => { setStep("info"); setError(null); }}
          className="w-full text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to guest info
        </button>
      </form>
    </FormShell>
  );
}

function RedeemScreen({ onDone }: { onDone: () => void }) {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true); setError(null);
    const d = new FormData(e.currentTarget);
    try {
      await submitLead({
        source: "referral_redeem",
        name: String(d.get("name") ?? ""),
        email: String(d.get("email") ?? ""),
        phone: String(d.get("phone") ?? ""),
        interest: `Referral code: ${String(d.get("code") ?? "")}`,
        message: `Referral code redeemed at front desk. Code: ${String(d.get("code") ?? "")}`,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit.");
    } finally { setSubmitting(false); }
  }

  if (sent) return <ConfirmationCard title="Code received" message="Staff will apply your referral reward shortly." onDone={onDone} />;

  return (
    <FormShell eyebrow="REFERRAL" title="Redeem a Referral Code" sub="Enter the code your friend gave you.">
      <form onSubmit={handleSubmit} className="space-y-5">
        <KioskField label="Referral code" name="code" required placeholder="e.g. FBP-1234" />
        <KioskField label="Your name" name="name" required />
        <KioskField label="Email" name="email" type="email" required />
        <KioskField label="Phone" name="phone" type="tel" placeholder="(optional)" />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <SubmitButton submitting={submitting} label="Redeem Code" />
      </form>
    </FormShell>
  );
}

function ReferScreen({ onDone }: { onDone: () => void }) {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true); setError(null);
    const d = new FormData(e.currentTarget);
    const referrerName = String(d.get("referrer_name") ?? "").trim();
    const referrerEmail = String(d.get("referrer_email") ?? "").trim();
    const friendName = String(d.get("friend_name") ?? "").trim();
    const friendContact = String(d.get("friend_contact") ?? "").trim();
    try {
      await submitLead({
        source: "refer_friend",
        name: referrerName,
        email: referrerEmail,
        phone: null,
        interest: `Referring: ${friendName}`,
        message: `Referrer: ${referrerName} (${referrerEmail})\nFriend: ${friendName}\nFriend contact: ${friendContact}`,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit.");
    } finally { setSubmitting(false); }
  }

  if (sent) return <ConfirmationCard title="Thanks for the referral!" message="We'll reach out to your friend and credit your account." onDone={onDone} />;

  return (
    <FormShell eyebrow="REFER A FRIEND" title="Refer a Friend" sub="Share FIT Beyond Plus and earn rewards.">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-widest text-primary">Your Info</p>
          <div className="mt-3 space-y-4">
            <KioskField label="Your name" name="referrer_name" required />
            <KioskField label="Your email" name="referrer_email" type="email" required />
          </div>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-widest text-primary">Friend's Info</p>
          <div className="mt-3 space-y-4">
            <KioskField label="Friend's name" name="friend_name" required />
            <KioskField label="Friend's email or phone" name="friend_contact" required />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <SubmitButton submitting={submitting} label="Send Referral" />
      </form>
    </FormShell>
  );
}

function ReviewScreen({ onDone }: { onDone: () => void }) {
  const [seconds, setSeconds] = useState(8);
  useEffect(() => {
    if (seconds <= 0) { onDone(); return; }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds, onDone]);

  return (
    <FormShell eyebrow="GOOGLE REVIEW" title="Leave us a review" sub="Tap the button to open Google. Thanks for supporting FIT Beyond Plus.">
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <div className="mx-auto h-16 w-16 rounded-full bg-primary/15 text-primary flex items-center justify-center">
          <Gift className="h-8 w-8" />
        </div>
        <p className="mt-6 text-base text-muted-foreground">Your honest review helps other people find a serious gym.</p>
        <a
          href={GOOGLE_REVIEW_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex h-14 items-center rounded-md bg-primary px-8 text-base font-bold uppercase tracking-wide text-primary-foreground"
          style={{ boxShadow: "var(--shadow-glow)" }}
        >
          <Star className="h-5 w-5 mr-2" /> Open Google Review
        </a>
        <p className="mt-6 text-xs uppercase tracking-widest text-muted-foreground">Returning in {seconds}s</p>
      </div>
    </FormShell>
  );
}
