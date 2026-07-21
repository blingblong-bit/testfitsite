import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHero } from "@/components/PageHero";
import { ReferScreen } from "@/components/kiosk-screens";

export const Route = createFileRoute("/refer-a-friend")({
  head: () => ({
    meta: [
      { title: "Refer a Friend | FIT Beyond Plus" },
      {
        name: "description",
        content:
          "Refer a friend to FIT Beyond Plus and give them a free day pass. Takes less than a minute.",
      },
    ],
  }),
  component: ReferAFriendPage,
});

function ReferAFriendPage() {
  const [resetKey, setResetKey] = useState(0);

  return (
    <>
      <PageHero
        eyebrow="REFER A FRIEND"
        title="Give a Friend a Free Day Pass"
        description="Enter your info and your friend's — we'll email them a code good for one free day pass."
      />
      <section className="container-page py-16 md:py-20">
        <ReferScreen key={resetKey} onDone={() => setResetKey((k) => k + 1)} />
      </section>
    </>
  );
}
