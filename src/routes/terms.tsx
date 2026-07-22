import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms and Conditions — FIT Beyond Plus" },
      {
        name: "description",
        content: "Terms and conditions for using FIT Beyond Plus, including our SMS text messaging program.",
      },
      { property: "og:title", content: "Terms and Conditions — FIT Beyond Plus" },
      {
        property: "og:description",
        content: "Terms and conditions for using FIT Beyond Plus, including our SMS text messaging program.",
      },
      { property: "og:url", content: "https://fitbeyondplus.com/terms" },
      { name: "robots", content: "noindex, follow" },
    ],
    links: [{ rel: "canonical", href: "https://fitbeyondplus.com/terms" }],
  }),
  component: Terms,
});

const LAST_UPDATED = "July 21, 2026";

function Terms() {
  return (
    <>
      <PageHero
        eyebrow="TERMS"
        title="Terms and Conditions"
        description={`The terms that apply when you use our website, forms, and text messaging program. Last updated ${LAST_UPDATED}.`}
      />

      <section className="container-page py-16">
        <div className="max-w-3xl space-y-10 text-muted-foreground leading-relaxed">
          <div>
            <h2 className="text-2xl text-foreground">Overview</h2>
            <p className="mt-3">
              These terms apply to your use of the FIT Beyond Plus website (fitbeyondplus.com),
              the forms on it, and any text messages you receive from us as a result. By
              submitting a form, checking in for a class, redeeming a referral, or providing your
              phone number to us in person, you agree to these terms.
            </p>
          </div>

          <div>
            <h2 className="text-2xl text-foreground">Membership and day passes</h2>
            <p className="mt-3">
              Memberships are set up in person at our facility at 449 W Lincoln St, Tullahoma, TN
              37388. Day passes purchased online or in person grant single-day access on the date
              of purchase and are non-transferable. Specific membership terms, pricing, and
              cancellation policies are provided and agreed to separately at sign-up.
            </p>
          </div>

          <div>
            <h2 className="text-2xl text-foreground">SMS text messaging program</h2>
            <p className="mt-3">
              By providing your phone number and checking the consent box on one of our forms, or
              by verbally providing your number in person and agreeing to receive texts, you
              consent to receive text messages from FIT Beyond Plus.
            </p>
            <p className="mt-3">
              <strong className="text-foreground">Program description:</strong> Messages may
              include responses to your inquiry, appointment and visit reminders, membership
              status updates, and general customer service communication.
            </p>
            <p className="mt-3">
              <strong className="text-foreground">Message frequency:</strong> Frequency varies
              based on your interaction with us — for example, someone inquiring about
              membership may receive several messages over a couple of weeks, while an active
              member may receive occasional messages related to their account or visits.
            </p>
            <p className="mt-3">
              <strong className="text-foreground">Message and data rates may apply.</strong>{" "}
              Carrier fees may apply depending on your mobile plan.
            </p>
            <p className="mt-3">
              <strong className="text-foreground">Opt out:</strong> Reply <strong>STOP</strong>{" "}
              at any time to stop receiving text messages from us. You may receive one final
              message confirming your opt-out.
            </p>
            <p className="mt-3">
              <strong className="text-foreground">Help:</strong> Reply <strong>HELP</strong> to
              any message for assistance, or contact us directly at (931) 222-4449 or{" "}
              <a href="mailto:Info@fitbeyondplus.com" className="text-primary hover:underline">
                Info@fitbeyondplus.com
              </a>
              .
            </p>
            <p className="mt-3">
              Consent to receive text messages is not required as a condition of purchasing any
              membership or service. Carriers are not liable for delayed or undelivered messages.
              See our{" "}
              <Link to="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>{" "}
              for how we handle your phone number and other information.
            </p>
          </div>

          <div>
            <h2 className="text-2xl text-foreground">Liability</h2>
            <p className="mt-3">
              Use of our facility, equipment, and classes carries inherent risk. Members and
              guests are required to review and accept a separate liability waiver before using
              the facility, taking a class, or redeeming a day pass.
            </p>
          </div>

          <div>
            <h2 className="text-2xl text-foreground">Changes to these terms</h2>
            <p className="mt-3">
              We may update these terms from time to time. The date at the top reflects the most
              recent revision. Continued use of our website or messaging program after a change
              means you accept the updated terms.
            </p>
          </div>

          <div>
            <h2 className="text-2xl text-foreground">Contact us</h2>
            <p className="mt-3">
              Questions about these terms? Email{" "}
              <a href="mailto:Info@fitbeyondplus.com" className="text-primary hover:underline">
                Info@fitbeyondplus.com
              </a>{" "}
              or call (931) 222-4449. You can also{" "}
              <Link to="/contact" className="text-primary hover:underline">
                reach us through our contact page
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
