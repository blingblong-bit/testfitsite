import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHero } from "@/components/PageHero";
import { createReferral } from "@/lib/referrals";

export const Route = createFileRoute("/claim-free-week")({
  head: () => ({
    meta: [
      { title: "Free Week — End of Summer | FIT Beyond Plus" },
      {
        name: "description",
        content:
          "Claim a free week at FIT Beyond Plus for yourself or a friend — offer ends Labor Day, September 7, 2026.",
      },
    ],
  }),
  component: ClaimFreeWeekPage,
});

// Matches the deadline enforced server-side in referrals.ts.
const DEADLINE_LABEL = "Monday, September 7, 2026 (Labor Day)";

function buildQrUrl(targetUrl: string): string {
  const params = new URLSearchParams({
    size: "220x220",
    data: targetUrl,
  });
  return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`;
}

function ClaimFreeWeekPage() {
  const [mode, setMode] = useState<"self" | "friend">("self");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ code: string } | null>(null);
  const [renderedAt] = useState(() => Date.now());

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const d = new FormData(e.currentTarget);

    // Honeypot — same pattern already proven on the day pass form.
    const honeypot = String(d.get("company_website") ?? "").trim();
    if (honeypot) {
      setResult({ code: "XXXXXXXXXX" });
      return;
    }
    if (Date.now() - renderedAt < 3000) {
      setError("Please take a moment to fill out the form.");
      return;
    }

    const name = String(d.get("name") ?? "").trim();
    const phone = String(d.get("phone") ?? "").trim();

    let payload: {
      referrer_name: string;
      referrer_phone: string;
      friend_name: string;
      friend_phone: string;
      promo_type: "free_week";
      is_self_referral: boolean;
    };

    if (mode === "self") {
      payload = {
        referrer_name: name,
        referrer_phone: phone,
        friend_name: name,
        friend_phone: phone,
        promo_type: "free_week",
        is_self_referral: true,
      };
    } else {
      const friendName = String(d.get("friend_name") ?? "").trim();
      const friendPhone = String(d.get("friend_phone") ?? "").trim();
      payload = {
        referrer_name: name,
        referrer_phone: phone,
        friend_name: friendName,
        friend_phone: friendPhone,
        promo_type: "free_week",
        is_self_referral: false,
      };
    }


    setSubmitting(true);
    const res = await createReferral({ data: payload });
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    setResult({ code: res.code });
  }

  if (result) {
    const redeemUrl = `https://fitbeyondplus.com/redeem-referral?code=${encodeURIComponent(result.code)}`;
    return (
      <>
        <PageHero
          eyebrow="END OF SUMMER"
          title="You're In!"
          description="Show this code (or QR) at the front desk to activate your free week."
        />
        <section className="container-page py-16 md:py-20">
          <div className="max-w-md mx-auto rounded-2xl border border-primary bg-primary/10 p-8 text-center">
            <p className="text-xs uppercase tracking-widest text-primary">Your code</p>
            <p className="mt-2 text-3xl font-bold tracking-widest">{result.code}</p>

            <div className="mt-6 mx-auto h-56 w-56 rounded-lg border border-border bg-white flex items-center justify-center overflow-hidden">
              <img
                src={buildQrUrl(redeemUrl)}
                alt="QR code to redeem your free week"
                className="h-full w-full object-contain"
              />
            </div>

            <p className="mt-6 text-sm text-muted-foreground">
              Staff can scan this QR code at the front desk to activate your free week
              instantly — or you can enter the code manually at{" "}
              <Link to="/redeem-referral" className="text-primary hover:underline">
                fitbeyondplus.com/redeem-referral
              </Link>
              .
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              Offer valid through {DEADLINE_LABEL}. See you soon!
            </p>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHero
        eyebrow="END OF SUMMER"
        title="Claim Your Free Week"
        description={`A full week of access at FIT Beyond Plus — for you, or gift it to a friend. Offer ends ${DEADLINE_LABEL}.`}
      />
      <section className="container-page py-16 md:py-20">
        <div className="max-w-md mx-auto">
          <div className="flex gap-3 mb-6">
            <button
              type="button"
              onClick={() => setMode("self")}
              className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                mode === "self"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              For Myself
            </button>
            <button
              type="button"
              onClick={() => setMode("friend")}
              className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                mode === "friend"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              For a Friend
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Honeypot — hidden from real users */}
            <div
              aria-hidden="true"
              style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}
            >
              <label htmlFor="company_website">Company website</label>
              <input id="company_website" name="company_website" type="text" tabIndex={-1} autoComplete="off" />
            </div>

            <div className="rounded-md border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-widest text-primary">
                {mode === "self" ? "Your Info" : "Your Info (referrer)"}
              </p>
              <div className="mt-3 space-y-4">
                <div>
                  <label htmlFor="name" className="block text-xs uppercase tracking-widest mb-2">
                    Full name
                  </label>
                  <input
                    id="name"
                    name="name"
                    required
                    className="w-full h-12 rounded-md bg-secondary border border-border px-4 text-base focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-xs uppercase tracking-widest mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    className="w-full h-12 rounded-md bg-secondary border border-border px-4 text-base focus:outline-none focus:border-primary"
                  />
                </div>
                {mode === "self" && (
                  <div>
                    <label htmlFor="phone" className="block text-xs uppercase tracking-widest mb-2">
                      Phone
                    </label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      required
                      className="w-full h-12 rounded-md bg-secondary border border-border px-4 text-base focus:outline-none focus:border-primary"
                    />
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      We'll text your code right away.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {mode === "friend" && (
              <div className="rounded-md border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-widest text-primary">Friend's Info</p>
                <div className="mt-3 space-y-4">
                  <div>
                    <label htmlFor="friend_name" className="block text-xs uppercase tracking-widest mb-2">
                      Friend's name
                    </label>
                    <input
                      id="friend_name"
                      name="friend_name"
                      required
                      className="w-full h-12 rounded-md bg-secondary border border-border px-4 text-base focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="friend_email" className="block text-xs uppercase tracking-widest mb-2">
                      Friend's email
                    </label>
                    <input
                      id="friend_email"
                      name="friend_email"
                      type="email"
                      required
                      className="w-full h-12 rounded-md bg-secondary border border-border px-4 text-base focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="friend_phone" className="block text-xs uppercase tracking-widest mb-2">
                      Friend's phone
                    </label>
                    <input
                      id="friend_phone"
                      name="friend_phone"
                      type="tel"
                      required
                      className="w-full h-12 rounded-md bg-secondary border border-border px-4 text-base focus:outline-none focus:border-primary"
                    />
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      We'll text them their code right away.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex h-14 items-center justify-center rounded-md bg-primary px-6 text-base font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-60"
              style={{ boxShadow: "var(--shadow-glow)" }}
            >
              {submitting ? "Claiming..." : mode === "self" ? "Claim My Free Week" : "Send Free Week"}
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
