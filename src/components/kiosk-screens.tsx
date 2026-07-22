import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { createReferral, redeemReferral, lookupReferral } from "@/lib/referrals";
import { processDayPassCheckin } from "@/lib/process-day-pass-checkin.functions";
import venmoQrAsset from "@/assets/venmo-qr.jpeg.asset.json";
import { SmsConsentCheckbox } from "@/components/SmsConsent";

export const WAIVER_TEXT =
  "I have read and understood the foregoing assumption of risk and release of liability and I understand that by signing this document it obligates me to indemnify FIT Beyond Plus for any liability for injury or death of any person and damage of property caused by negligent or intentional act or omission. I understand that by signing, I am waiving my valuable legal rights.";

export function WaiverCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-border bg-card p-5 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-primary"
      />
      <span className="text-sm leading-relaxed text-foreground">
        <span className="block text-xs uppercase tracking-widest text-primary mb-2">
          Liability waiver
        </span>
        {WAIVER_TEXT}
      </span>
    </label>
  );
}

export function ScreenHeader({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="mb-8">
      <p className="text-xs tracking-[0.3em] text-primary">{eyebrow}</p>
      <h2 className="mt-2 text-3xl md:text-4xl">{title}</h2>
      {sub && <p className="mt-2 text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function ConfirmationCard({
  title,
  message,
  onDone,
}: {
  title: string;
  message: string;
  onDone: () => void;
}) {
  const [seconds, setSeconds] = useState(5);
  useEffect(() => {
    if (seconds <= 0) {
      onDone();
      return;
    }
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

export function KioskField({
  label,
  name,
  type = "text",
  required,
  placeholder,
  helper,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  helper?: string;
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
        className="w-full h-14 rounded-md bg-secondary border border-border px-4 text-base focus:outline-none focus:border-primary"
      />
      {helper && <p className="mt-1.5 text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}

export function FormShell({
  eyebrow,
  title,
  sub,
  children,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-2xl mx-auto">
      <ScreenHeader eyebrow={eyebrow} title={title} sub={sub} />
      {children}
    </div>
  );
}

export function SubmitButton({ submitting, label }: { submitting: boolean; label: string }) {
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

export function DayPassScreen({ onDone }: { onDone: () => void }) {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"info" | "pay">("info");
  const [guest, setGuest] = useState({ name: "", email: "", phone: "" });
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);

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
    if (!method) {
      setError("Please select a payment method.");
      return;
    }
    if (!waiverAccepted) {
      setError("Please accept the liability waiver to continue.");
      return;
    }
    if (!smsConsent) {
      setError("Please check the box to consent to text messages.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await processDayPassCheckin({
        data: {
          name: guest.name,
          email: guest.email,
          phone: guest.phone,
          payment_method: method,
        },
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent)
    return (
      <ConfirmationCard
        title="You're all set!"
        message="Welcome to FIT Beyond Plus. Enjoy your workout."
        onDone={onDone}
      />
    );

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
          <div className="mt-4 mx-auto h-64 w-64 rounded-lg border border-border bg-white flex items-center justify-center overflow-hidden">
            <img
              src={venmoQrAsset.url}
              alt="Scan to pay FIT Beyond Plus on Venmo"
              className="h-full w-full object-contain"
            />
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

        <WaiverCheckbox checked={waiverAccepted} onChange={setWaiverAccepted} />
        <SmsConsentCheckbox checked={smsConsent} onChange={setSmsConsent} />

        {error && <p className="text-sm text-destructive">{error}</p>}
        <SubmitButton submitting={submitting} label="Confirm Payment & Check In" />
        <button
          type="button"
          onClick={() => {
            setStep("info");
            setError(null);
          }}
          className="w-full text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to guest info
        </button>
      </form>
    </FormShell>
  );
}

export function RedeemScreen({ onDone }: { onDone: () => void }) {
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"code" | "checkin">("code");
  const [code, setCode] = useState("");
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);

  async function handleCodeSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const d = new FormData(e.currentTarget);
    const entered = String(d.get("code") ?? "").trim().toUpperCase();
    const result = await lookupReferral(entered);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCode(entered);
    setReferrerName(result.referral.referrer_name ?? null);
    setStep("checkin");
  }

  async function handleCheckinSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!waiverAccepted) {
      setError("Please accept the liability waiver to continue.");
      return;
    }
    if (!smsConsent) {
      setError("Please check the box to consent to text messages.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const d = new FormData(e.currentTarget);
    const result = await redeemReferral(code, {
      full_name: String(d.get("name") ?? ""),
      email: String(d.get("email") ?? ""),
      phone: String(d.get("phone") ?? ""),
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  if (done)
    return (
      <ConfirmationCard
        title="Referral redeemed successfully"
        message="Free day pass approved. Welcome to FIT Beyond Plus!"
        onDone={onDone}
      />
    );

  if (step === "code") {
    return (
      <FormShell
        eyebrow="REFERRAL"
        title="Redeem a Referral Code"
        sub="Enter the code your friend gave you."
      >
        <form onSubmit={handleCodeSubmit} className="space-y-5">
          <KioskField label="Referral code" name="code" required placeholder="e.g. ABCD234567" />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SubmitButton submitting={submitting} label="Continue" />
        </form>
      </FormShell>
    );
  }

  return (
    <FormShell
      eyebrow="CHECK IN"
      title="Referral Day Pass Check-In"
      sub="Tell us about yourself to complete your free day pass."
    >
      <form onSubmit={handleCheckinSubmit} className="space-y-5">
        <div className="rounded-xl border border-border bg-card p-5 space-y-2">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Referral code
            </p>
            <p className="mt-1 text-lg font-semibold">{code}</p>
          </div>
          {referrerName && (
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Friend who referred you
              </p>
              <p className="mt-1 text-lg font-semibold">{referrerName}</p>
            </div>
          )}
        </div>
        <KioskField label="Full name" name="name" required />
        <KioskField label="Phone" name="phone" type="tel" required />
        <KioskField label="Email" name="email" type="email" required />
        <WaiverCheckbox checked={waiverAccepted} onChange={setWaiverAccepted} />
        <SmsConsentCheckbox checked={smsConsent} onChange={setSmsConsent} />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <SubmitButton submitting={submitting} label="Complete Check-In" />
        <button
          type="button"
          onClick={() => {
            setStep("code");
            setError(null);
          }}
          className="w-full text-sm text-muted-foreground hover:text-foreground"
        >
          ← Use a different code
        </button>
      </form>
    </FormShell>
  );
}

export function ReferScreen({ onDone }: { onDone: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const d = new FormData(e.currentTarget);
    const result = await createReferral({
      referrer_name: String(d.get("referrer_name") ?? ""),
      referrer_email: String(d.get("referrer_email") ?? ""),
      friend_name: String(d.get("friend_name") ?? ""),
      friend_email: String(d.get("friend_email") ?? ""),
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <ConfirmationCard
        title="Referral submitted successfully"
        message="The free day pass code has been emailed to your friend."
        onDone={onDone}
      />
    );
  }

  return (
    <FormShell
      eyebrow="REFER A FRIEND"
      title="Refer a Friend"
      sub="Generate a referral code to share. Your friend gets a free day pass."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-widest text-primary">Your Info</p>
          <div className="mt-3 space-y-4">
            <KioskField
              label="Your name"
              name="referrer_name"
              required
              helper="Enter first and last name."
            />
            <KioskField label="Your email" name="referrer_email" type="email" required />
          </div>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-widest text-primary">Friend's Info</p>
          <div className="mt-3 space-y-4">
            <KioskField
              label="Friend's name"
              name="friend_name"
              required
              helper="Enter first and last name."
            />
            <KioskField label="Friend's email" name="friend_email" type="email" required />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <SubmitButton submitting={submitting} label="Generate Referral Code" />
      </form>
    </FormShell>
  );
}
