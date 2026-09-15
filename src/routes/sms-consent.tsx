import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { PageHero } from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitSmsConsent } from "@/lib/sms-consent.functions";

export const Route = createFileRoute("/sms-consent")({
  head: () => ({
    meta: [
      { title: "Text Message Consent — FIT Beyond Plus" },
      {
        name: "description",
        content:
          "Opt in to recurring customer-care text messages from FIT Beyond Plus about appointments, scheduling, package renewals, and amounts due.",
      },
      { property: "og:title", content: "Text Message Consent — FIT Beyond Plus" },
      {
        property: "og:description",
        content:
          "Opt in to recurring customer-care text messages from FIT Beyond Plus about appointments, scheduling, package renewals, and amounts due.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://fitbeyondplus.com/sms-consent" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, follow" },
    ],
    links: [{ rel: "canonical", href: "https://fitbeyondplus.com/sms-consent" }],
  }),
  component: SmsConsentPage,
});

const CONSENT_TEXT =
  "I agree to receive recurring customer-care text messages from FIT Beyond Plus about appointments, scheduling, package renewals, upcoming package start dates, amounts due, and service-related updates. Message frequency varies. Message and data rates may apply. Consent is not a condition of purchase. Reply STOP to opt out or HELP for help.";

const VERBAL_SCRIPT =
  "Would you like to receive recurring text messages from FIT Beyond Plus about appointments, scheduling, package renewals, upcoming package start dates, amounts due, and customer-care updates? Message frequency varies. Message and data rates may apply. Consent is optional and is not required to purchase services. You may reply STOP to opt out or HELP for help.";

function SmsConsentPage() {
  const submit = useServerFn(submitSmsConsent);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  // Unchecked by default. Required for A2P 10DLC review.
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setError("Please enter your first name, last name, and mobile phone number.");
      return;
    }
    if (!consent) {
      setError(
        "Please check the consent box if you'd like to receive customer-care text messages. This is optional — you can leave this page without opting in.",
      );
      return;
    }

    setStatus("sending");
    try {
      const res = await submit({
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
          consent: true,
        },
      });
      if (!res.ok) {
        setStatus("idle");
        setError(
          res.error === "invalid_phone"
            ? "Please enter a valid 10-digit U.S. mobile number."
            : "We couldn't save your request. Please try again or call (931) 222-4449.",
        );
        return;
      }
      setStatus("done");
    } catch {
      setStatus("idle");
      setError("Something went wrong. Please try again or call (931) 222-4449.");
    }
  }

  return (
    <>
      <PageHero
        eyebrow="FIT BEYOND PLUS"
        title="Customer-Care Text Messages"
        description="Opt in to recurring customer-care text messages from FIT Beyond Plus. Consent is optional and is not a condition of purchase."
      />

      <section className="container-page py-16">
        <div className="max-w-3xl space-y-12">
          <div className="text-muted-foreground leading-relaxed">
            <h2 className="text-2xl text-foreground">About this messaging program</h2>
            <p className="mt-3">
              FIT Beyond Plus is a gym and training facility located at 449 W Lincoln St, Tullahoma,
              TN 37388. Phone: (931) 222-4449. Email:{" "}
              <a href="mailto:Info@fitbeyondplus.com" className="text-primary hover:underline">
                Info@fitbeyondplus.com
              </a>
              .
            </p>
            <p className="mt-3">
              This program sends recurring customer-care text messages about appointments,
              scheduling, package renewals, upcoming package start dates, amounts due, and
              service-related updates. Message frequency varies. Message and data rates may apply.
              Reply <strong>STOP</strong> to opt out or <strong>HELP</strong> for help. Consent is
              not a condition of purchase.
            </p>
            <p className="mt-3">
              We do not share your mobile information with third parties or affiliates for marketing
              or promotional purposes.
            </p>
          </div>

          {status === "done" ? (
            <div
              className="rounded-lg border border-border bg-card p-6 text-muted-foreground leading-relaxed"
              role="status"
            >
              <h2 className="text-2xl text-foreground">You're all set</h2>
              <p className="mt-3">
                You're signed up for FIT Beyond Plus customer-care text messages. Message frequency
                varies. Message and data rates may apply. Reply <strong>STOP</strong> to opt out or{" "}
                <strong>HELP</strong> for help.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-6 rounded-lg border border-border bg-card p-6"
              noValidate
            >
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First name</Label>
                  <Input
                    id="first_name"
                    name="first_name"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last name</Label>
                  <Input
                    id="last_name"
                    name="last_name"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Mobile phone number</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(931) 555-0123"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="space-y-3">
                <label
                  htmlFor="sms_consent"
                  className="flex items-start gap-3 rounded-lg border border-border bg-background p-4 cursor-pointer"
                >
                  <input
                    id="sms_consent"
                    name="sms_consent"
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-1 h-5 w-5 shrink-0 accent-primary"
                  />
                  <span className="text-sm leading-relaxed text-muted-foreground">
                    {CONSENT_TEXT}
                  </span>
                </label>

                <p className="text-sm text-muted-foreground">
                  <Link to="/privacy" className="text-primary hover:underline">
                    Privacy Policy
                  </Link>
                  <span className="px-2">·</span>
                  <Link to="/terms" className="text-primary hover:underline">
                    Terms &amp; Conditions
                  </Link>
                </p>

                <p className="text-xs text-muted-foreground">
                  This consent is optional and separate from any other agreement, purchase, or
                  acceptance of our Terms &amp; Conditions.
                </p>
              </div>

              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}

              <Button type="submit" disabled={status === "sending"}>
                {status === "sending" ? "Submitting…" : "Submit"}
              </Button>
            </form>
          )}

          <div className="text-muted-foreground leading-relaxed">
            <h2 className="text-2xl text-foreground">Other opt-in methods</h2>
            <h3 className="mt-6 text-lg text-foreground">In-person verbal opt-in</h3>
            <p className="mt-3">
              FIT Beyond Plus may also obtain consent verbally during intake, scheduling, or package
              setup. Staff uses this exact script:
            </p>
            <blockquote className="mt-4 border-l-2 border-primary pl-4 italic">
              “{VERBAL_SCRIPT}”
            </blockquote>
            <p className="mt-4">The client must affirmatively agree before messages are sent.</p>
          </div>
        </div>
      </section>
    </>
  );
}
