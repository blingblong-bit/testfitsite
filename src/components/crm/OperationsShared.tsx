import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function useOperationalClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
export function OperationsError() {
  const router = useRouter();
  return <div role="alert" className="p-6 space-y-3"><p className="text-destructive">Could not load this workspace.</p><Button variant="outline" onClick={() => router.invalidate()}>Try again</Button></div>;
}
export function OperationsNotFound() {
  return <p className="p-6 text-muted-foreground">Workspace not found.</p>;
}
export function operationsHead(title: string, description: string) {
  return { meta: [
    { title: `${title} — FIT CRM` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} — FIT CRM` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] };
}