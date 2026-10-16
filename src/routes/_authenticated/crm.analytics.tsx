import { createFileRoute } from "@tanstack/react-router";
import { AnalyticsView } from "@/components/AnalyticsView";
import { useTrackerData } from "@/lib/crm/use-tracker-data";
import type { AnalyticsLead, AnalyticsReferral } from "@/lib/analytics";

export const Route = createFileRoute("/_authenticated/crm/analytics")({
  head: () => ({ meta: [
    { title: "Business Analytics — FIT CRM" },
    { name: "description", content: "Monthly leads, sources, campaigns and conversions for FIT Beyond Plus." },
    { property: "og:title", content: "Business Analytics — FIT CRM" },
    { property: "og:description", content: "Monthly leads, sources, campaigns and conversions for FIT Beyond Plus." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { data, error } = useTrackerData();
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold">Business Analytics</h1>
      {error && <p className="mt-4 text-sm text-destructive">{(error as Error).message}</p>}
      <AnalyticsView
        leads={(data?.leads as unknown as AnalyticsLead[]) ?? null}
        referrals={(data?.referrals as unknown as AnalyticsReferral[]) ?? null}
        isAdmin={data?.isAdmin === true}
      />
    </div>
  );
}
