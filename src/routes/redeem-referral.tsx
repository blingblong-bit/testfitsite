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
      { title: "Redeem Your Referral Code | FIT Beyond Plus" },
      {
        name: "description",
        content:
          "Got a referral code from a friend? Redeem it here for your free day pass to FIT Beyond Plus.",
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
        title="Redeem Your Free Day Pass"
        description="Enter the code your friend shared with you to claim your free visit."
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
