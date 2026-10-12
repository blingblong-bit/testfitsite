import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Plus, Check, Undo2, Pencil, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TaskEditor } from "@/components/crm/TaskEditor";
import { operationsQuery } from "@/lib/crm/operations.queries";
import { TASK_VIEWS, taskView, deriveOperations, type TaskView, type CrmTask } from "@/lib/crm/operations";
import { fmtChicago } from "@/lib/crm/queries";
import { supabase } from "@/integrations/supabase/client";
import { OperationsError, OperationsNotFound, operationsHead, useOperationalClock } from "@/components/crm/OperationsShared";

export const Route = createFileRoute("/_authenticated/crm/tasks")({
  validateSearch: (s: Record<string, unknown>): { view: TaskView; q?: string } => ({
    view: TASK_VIEWS.includes(s.view as TaskView) ? s.view as TaskView : "Due Today",
    q: typeof s.q === "string" && s.q ? s.q : undefined,
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(operationsQuery),
  head: () => operationsHead("Tasks", "FIT staff tasks by overdue, due today, upcoming, and completed, linked to contacts and sales attempts."),
  pendingComponent: () => <p className="p-6 text-muted-foreground">Loading tasks…</p>,
  errorComponent: OperationsError,
  notFoundComponent: OperationsNotFound,
  component: TasksPage,
});

function TasksPage() {
  const { data } = useSuspenseQuery(operationsQuery);
  const { view, q } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const now = useOperationalClock();
  const { tasks } = deriveOperations(data, now);
  const [editor, setEditor] = useState<CrmTask | "new" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const contacts = new Map(data.contacts.map((c) => [c.id, c]));
  const visible = tasks.filter((t) => taskView(t, now) === view && (!q || `${t.title} ${contacts.get(t.contact_id)?.name ?? ""}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => view === "Completed" ? (b.completed_at ?? "").localeCompare(a.completed_at ?? "") : (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999"));
  async function toggle(task: CrmTask) {
    if (busy) return;
    setBusy(task.id);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Sign in required");
      const { error } = await supabase.from("crm_tasks").update({ completed_at: task.completed_at ? null : new Date().toISOString(), completed_by: task.completed_at ? null : auth.user.id }).eq("id", task.id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["crm"] });
      toast.success(task.completed_at ? "Task reopened" : "Task completed");
    } catch { toast.error("Could not update task. Please try again."); }
    finally { setBusy(null); }
  }
  return <div className="p-4 md:p-6">
    <header className="flex items-center justify-between gap-3"><div><h1 className="text-2xl md:text-3xl">Tasks</h1><p className="mt-1 text-sm text-muted-foreground">Chicago time</p></div><Button onClick={() => setEditor("new")}><Plus />New task</Button></header>
    <div className="mt-6 flex flex-wrap gap-2" aria-label="Task views">{TASK_VIEWS.map((v) => <Button key={v} variant={v === view ? "secondary" : "ghost"} aria-pressed={v === view} onClick={() => navigate({ to: "/crm/tasks", search: { view: v, q } })}>{v}<span className="text-xs text-muted-foreground">{tasks.filter((t) => taskView(t, now) === v).length}</span></Button>)}</div>
    <div className="mt-4 relative max-w-sm"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input aria-label="Search tasks" placeholder="Search task or contact" value={q ?? ""} onChange={(e) => navigate({ to: "/crm/tasks", search: { view, q: e.target.value || undefined }, replace: true })} className="h-10 w-full rounded-md border border-border bg-secondary pl-9 pr-3 text-sm" /></div>
    {q && <Button variant="outline" size="sm" className="mt-3 h-auto min-h-8 max-w-full whitespace-normal" onClick={() => navigate({ to: "/crm/tasks", search: { view } })}><X /><span className="break-all">Search: {q}</span></Button>}
    <div className="mt-6 mb-3 flex items-center gap-3"><h2 className="text-xl">{view}</h2><span className="text-sm text-muted-foreground" aria-label="Task count">{visible.length} tasks</span></div>
    <div className="divide-y divide-border border-y border-border" aria-label="Task results">
      {!visible.length && <p className="py-10 text-sm text-muted-foreground">No {view.toLowerCase()} tasks{q ? " match this search" : ""}.</p>}
      {visible.map((t) => {
        const contact = contacts.get(t.contact_id);
        const opportunity = data.opportunities.find((o) => o.id === t.opportunity_id);
        return <div key={t.id} className="flex items-start gap-3 py-4">
          <Button variant="outline" size="icon" className="shrink-0" title={t.completed_at ? "Reopen task" : "Complete task"} aria-label={`${t.completed_at ? "Reopen" : "Complete"} ${t.title}`} disabled={busy !== null} onClick={() => toggle(t)}>{t.completed_at ? <Undo2 /> : <Check />}</Button>
          <div className="min-w-0 flex-1"><p className={`break-words font-medium ${t.completed_at ? "text-muted-foreground" : ""}`}>{t.title}</p><Button variant="link" className="h-auto p-0 py-1 max-w-full whitespace-normal break-words justify-start text-left" onClick={() => navigate({ to: "/crm/tasks", search: { view, q, contact: t.contact_id, tab: "tasks" } })}>{contact?.name ?? "Contact"}</Button>
            {opportunity && <Button variant="link" className="flex h-auto p-0 py-1 max-w-full whitespace-normal break-words justify-start text-left text-xs" onClick={() => navigate({ to: "/crm/tasks", search: { view, q, contact: t.contact_id, tab: "opportunities" } })}>{opportunity.interest} · {opportunity.stage}</Button>}
            <p className={`mt-1 text-xs ${view === "Overdue" ? "text-destructive" : "text-muted-foreground"}`}>{t.completed_at ? `Completed ${fmtChicago(t.completed_at)}` : t.due_at ? `Due ${fmtChicago(t.due_at)}` : "No due date"}</p>
          </div><Button variant="ghost" size="icon" title="Edit task" aria-label={`Edit ${t.title}`} onClick={() => setEditor(t)}><Pencil /></Button>
        </div>;
      })}
    </div>
    {editor && <TaskEditor key={typeof editor === "string" ? editor : editor.id} task={typeof editor === "string" ? undefined : editor} data={data} onClose={() => setEditor(null)} />}
  </div>;
}