import { createFileRoute } from "@tanstack/react-router";
import { ReferralsView, type Referral } from "@/components/crm/LeadTools";
import { useTrackerData } from "@/lib/crm/use-tracker-data";

export const Route = createFileRoute("/_authenticated/crm/referrals")({
  head: () => ({ meta: [
    { title: "Referrals — FIT CRM" },
    { name: "description", content: "Referral codes, redemptions and top referrers at FIT Beyond Plus." },
    { property: "og:title", content: "Referrals — FIT CRM" },
    { property: "og:description", content: "Referral codes, redemptions and top referrers at FIT Beyond Plus." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ReferralsPage,
});

function ReferralsPage() {
  const { data } = useTrackerData();
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold">Referrals</h1>
      <ReferralsView referrals={(data?.referrals as unknown as Referral[]) ?? null} />
    </div>
  );
}
