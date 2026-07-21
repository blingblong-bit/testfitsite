import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHero } from "@/components/PageHero";
import { DayPassScreen } from "@/components/kiosk-screens";

export const Route = createFileRoute("/day-pass")({
  head: () => ({
    meta: [
      { title: "Buy a Day Pass — $10 | FIT Beyond Plus" },
      {
        name: "description",
        content:
          "Grab a $10 single-day pass to FIT Beyond Plus in Tullahoma, TN. No membership required.",
      },
    ],
  }),
  component: DayPassPage,
});

function DayPassPage() {
  // Incrementing resetKey forces DayPassScreen to remount with fresh
  // internal state once the confirmation card's onDone fires, so a
  // second guest can use the same device right after.
  const [resetKey, setResetKey] = useState(0);

  return (
    <>
      <PageHero
        eyebrow="DAY PASS"
        title="Try FIT Beyond Plus for a Day"
        description="$10 gets you full access for the day — no membership required."
      />
      <section className="container-page py-16 md:py-20">
        <DayPassScreen key={resetKey} onDone={() => setResetKey((k) => k + 1)} />
      </section>
    </>
  );
}
