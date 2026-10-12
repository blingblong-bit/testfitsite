import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/crm/")({
  head: () => ({ meta: [
    { title: "Sales workspace — FIT Beyond Plus" },
    { name: "description", content: "Open the FIT sales pipeline and customer records." },
    { property: "og:title", content: "Sales workspace — FIT Beyond Plus" },
    { property: "og:description", content: "Open the FIT sales pipeline and customer records." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: () => {
    throw redirect({ to: "/crm/opportunities" });
  },
});
