import { createFileRoute } from "@tanstack/react-router";
import { MissedCallsView } from "@/components/MissedCallsView";

export const Route = createFileRoute("/_authenticated/crm/missed-calls")({
  head: () => ({ meta: [
    { title: "Missed Calls — FIT CRM" },
    { name: "description", content: "Missed calls and text-backs for FIT Beyond Plus." },
    { property: "og:title", content: "Missed Calls — FIT CRM" },
    { property: "og:description", content: "Missed calls and text-backs for FIT Beyond Plus." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold">Missed Calls</h1>
      <MissedCallsView />
    </div>
  ),
});
