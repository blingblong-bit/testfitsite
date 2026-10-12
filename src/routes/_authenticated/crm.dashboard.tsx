import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowUpRight, ChevronRight, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { operationsQuery } from "@/lib/crm/operations.queries";
import { ATTENTION_REASONS, deriveOperations, type AttentionReason } from "@/lib/crm/operations";
import { fmtChicago } from "@/lib/crm/queries";
import { OperationsError, OperationsNotFound, operationsHead, useOperationalClock } from "@/components/crm/OperationsShared";

export const Route = createFileRoute("/_authenticated/crm/dashboard")({
  validateSearch: (s: Record<string, unknown>): { reason?: AttentionReason } => ({
    reason: ATTENTION_REASONS.some((r) => r.id === s.reason) ? s.reason as AttentionReason : undefined,
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(operationsQuery),
  head: () => operationsHead("Daily Dashboard", "FIT staff daily attention queue, overdue tasks, appointments, and active sales follow-ups."),
  pendingComponent: () => <p className="p-6 text-muted-foreground">Loading daily Dashboard…</p>,
  errorComponent: OperationsError,
  notFoundComponent: OperationsNotFound,
  component: DashboardPage,
});

function DashboardPage() {
  const { data, refetch, isFetching } = useSuspenseQuery(operationsQuery);
  const { reason } = Route.useSearch();
  const navigate = useNavigate();
  const now = useOperationalClock();
  const { groups, attention } = deriveOperations(data, now);
  const selected = ATTENTION_REASONS.find((r) => r.id === reason);
  const items = reason ? groups[reason] : attention;
  const date = now.toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "long", month: "long", day: "numeric" });
  return <div className="p-4 md:p-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl md:text-3xl">Daily Dashboard</h1><p className="mt-1 text-sm text-muted-foreground">{date} · Chicago</p></div><Button variant="ghost" size="icon" aria-label="Refresh Dashboard" title="Refresh Dashboard" disabled={isFetching} onClick={() => refetch()}><RefreshCw className={isFetching ? "animate-spin" : ""} /></Button></header>
    <div aria-label="Daily operational counts" className="mt-6 grid grid-cols-2 lg:grid-cols-3 gap-3">
      {ATTENTION_REASONS.map((r) => <Button key={r.id} variant="outline" aria-label={`${r.label}: ${groups[r.id].length}`} aria-pressed={reason === r.id} onClick={() => navigate({ to: "/crm/dashboard", search: { reason: r.id } })} className={`h-auto min-h-28 items-start justify-between gap-2 whitespace-normal px-4 py-4 text-left ${reason === r.id ? "border-primary bg-primary/10" : ""}`}>
        <span className="min-w-0"><span className={`block text-3xl tabular-nums ${r.id === "overdue" && groups[r.id].length ? "text-destructive" : "text-primary"}`}>{groups[r.id].length}</span><span className="mt-2 block text-xs sm:text-sm text-muted-foreground">{r.label}</span></span><ArrowUpRight className="text-muted-foreground" />
      </Button>)}
    </div>
    <section className="mt-8" aria-label="Needs Attention">
      <div className="flex flex-wrap items-center gap-3 mb-4"><h2 className="text-xl">{selected?.label ?? "Needs Attention"}</h2><span className="text-sm text-muted-foreground" aria-label="Attention contact count">{items.length} contacts</span>
        {selected && <Button variant="outline" size="sm" aria-label="Clear Dashboard filter" onClick={() => navigate({ to: "/crm/dashboard", search: {} })} className="ml-auto h-auto min-h-8 whitespace-normal"><X />Clear filter</Button>}
      </div>
      <div className="divide-y divide-border border-y border-border" aria-label="Attention results">
        {!items.length && <p className="py-10 text-sm text-muted-foreground">{selected ? "No contacts need this action." : "Nothing needs attention right now."}</p>}
        {items.map((item) => {
          const config = ATTENTION_REASONS.find((r) => r.id === item.reason);
          return <Button key={item.contact.id} variant="ghost" aria-label={`Open ${item.contact.name}: ${config?.instruction}`} onClick={() => navigate({ to: "/crm/dashboard", search: { reason, contact: item.contact.id, tab: config?.tab } })} className="h-auto min-h-24 w-full justify-between whitespace-normal gap-3 px-1 py-4 text-left">
            <span className="min-w-0 flex-1"><span className="block break-words font-medium">{item.contact.name}</span><span className={`mt-1 block text-sm ${item.reason === "overdue" ? "text-destructive" : "text-primary"}`}>{config?.instruction}</span><span className="mt-1 block text-xs text-muted-foreground break-words">{item.detail} · {fmtChicago(item.at)}</span></span><ChevronRight className="text-muted-foreground" />
          </Button>;
        })}
      </div>
    </section>
  </div>;
}