import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHero } from "@/components/PageHero";
import { RedeemScreen } from "@/components/kiosk-screens";

export const Route = createFileRoute("/redeem-referral")({
  validateSearch: (search: Record<string, unknown>): { code?: string } => {
    const code = typeof search.code === "string" && search.code.trim() ? search.code.trim() : undefined;
    return code ? { code } : {};
  },
  head: () => ({
    meta: [
      { title: "Check In With Your Code | FIT Beyond Plus" },
      {
        name: "description",
        content:
          "Got a code from a friend? Complete your online check-in here, then bring your code to the FIT Beyond Plus front desk.",
      },
    ],
  }),
  component: RedeemReferralPage,
});

function RedeemReferralPage() {
  const { code } = Route.useSearch();
  const [resetKey, setResetKey] = useState(0);

  return (
    <>
      <PageHero
        eyebrow="REFERRAL"
        title="Complete Your Online Check-In"
        description="Enter your code to check in online. Day passes are good for one visit; free weeks start once staff verifies you at the front desk."
      />

      <section className="container-page py-16 md:py-20">
        <RedeemScreen
          key={resetKey}
          initialCode={code}
          onDone={() => setResetKey((k) => k + 1)}
        />
      </section>
    </>
  );
}
