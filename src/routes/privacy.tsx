import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — FIT Beyond Plus" },
      {
        name: "description",
        content: "How FIT Beyond Plus collects, uses, and protects your information.",
      },
      { property: "og:title", content: "Privacy Policy — FIT Beyond Plus" },
      {
        property: "og:description",
        content: "How FIT Beyond Plus collects, uses, and protects your information.",
      },
      { property: "og:url", content: "https://fitbeyondplus.com/privacy" },
      { name: "robots", content: "noindex, follow" },
    ],
    links: [{ rel: "canonical", href: "https://fitbeyondplus.com/privacy" }],
  }),
  component: Privacy,
});

const LAST_UPDATED = "July 12, 2026";

function Privacy() {
  return (
    <>
      <PageHero
        eyebrow="PRIVACY"
        title="Privacy Policy"
        description={`How we collect, use, and protect your information. Last updated ${LAST_UPDATED}.`}
      />

      <section className="container-page py-16">
        <div className="max-w-3xl space-y-10 text-muted-foreground leading-relaxed">
          <div>
            <h2 className="text-2xl text-foreground">Who we are</h2>
            <p className="mt-3">
              FIT Beyond Plus is a gym and training facility located at 449 W Lincoln St, Tullahoma,
              TN 37388. This policy describes how we handle information collected through our
              website, fitbeyondplus.com.
            </p>
          </div>

          <div>
            <h2 className="text-2xl text-foreground">Information we collect</h2>
            <p className="mt-3">
              When you submit a form on our site — such as booking a tour, asking a question, or
              expressing interest in a membership, class, or program — we collect the information
              you provide, which may include your name, email address, phone number, and the
              contents of your message.
            </p>
            <p className="mt-3">
              Like most websites, our hosting provider may also automatically log basic technical
              information such as IP address, browser type, and pages visited in order to operate
              and secure the site.
            </p>
          </div>

          <div>
            <h2 className="text-2xl text-foreground">How we use your information</h2>
            <p className="mt-3">We use the information you submit to:</p>
            <ul className="mt-3 list-disc pl-6 space-y-2">
              <li>
                Respond to your inquiry, schedule tours, and follow up about memberships or
                programs.
              </li>
              <li>Send you information you have requested about the gym, classes, or training.</li>
              <li>Operate, maintain, and improve our website and services.</li>
            </ul>
            <p className="mt-3">
              We do not sell your personal information. We do not share it with third parties for
              their own marketing purposes.
            </p>
          </div>

          <div>
            <h2 className="text-2xl text-foreground">How your information is stored</h2>
            <p className="mt-3">
              Form submissions are stored securely with our website and database providers and are
              accessible only to authorized FIT Beyond Plus staff. We retain inquiries for as long
              as needed to respond and manage our relationship with you.
            </p>
          </div>

          <div>
            <h2 className="text-2xl text-foreground">Email communications</h2>
            <p className="mt-3">
              If you receive email from us, you can opt out at any time using the unsubscribe link
              included in the message, or by contacting us directly.
            </p>
          </div>

          <div>
            <h2 className="text-2xl text-foreground">Children's privacy</h2>
            <p className="mt-3">
              Our website is not directed at children. Enrollment of minors in youth programs (such
              as kids' combat sports classes) is handled by a parent or guardian.
            </p>
          </div>

          <div>
            <h2 className="text-2xl text-foreground">Your choices</h2>
            <p className="mt-3">
              You may contact us at any time to ask what information we hold about you, request a
              correction, or ask us to delete it.
            </p>
          </div>

          <div>
            <h2 className="text-2xl text-foreground">Contact us</h2>
            <p className="mt-3">
              Questions about this policy? Email{" "}
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

          <p className="text-sm">
            We may update this policy from time to time. The date at the top reflects the most
            recent revision.
          </p>
        </div>
      </section>
    </>
  );
}
