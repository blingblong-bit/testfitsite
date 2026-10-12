import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { chicagoDateOf, chicagoOffset } from "@/lib/chicago-time";
import { isTestOrSpam } from "@/lib/crm/contact-directory";
import type { CrmTask, OperationsData } from "@/lib/crm/operations";

const inputClass = "h-10 w-full min-w-0 rounded-md border border-border bg-secondary px-3 text-sm";
function chicagoLocal(iso: string | null) {
  if (!iso) return "";
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Chicago", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
  return `${chicagoDateOf(iso)}T${time}`;
}
export function TaskEditor({ task, data, onClose }: { task?: CrmTask; data: OperationsData; onClose: () => void }) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [contact, setContact] = useState(task?.contact_id ?? "");
  const [opportunity, setOpportunity] = useState(task?.opportunity_id ?? "");
  const [due, setDue] = useState(chicagoLocal(task?.due_at ?? null));
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const contacts = data.contacts.filter((c) => !isTestOrSpam(c)).sort((a, b) => a.name.localeCompare(b.name));
  const opportunities = data.opportunities.filter((o) => o.contact_id === contact);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !contact || busy) return;
    setBusy(true);
    try {
      const dueAt = due ? new Date(`${due}:00${chicagoOffset(due.slice(0, 10))}`).toISOString() : null;
      const fields = { title: title.trim(), contact_id: contact, opportunity_id: opportunity || null, due_at: dueAt };
      const { error } = task ? await supabase.from("crm_tasks").update(fields).eq("id", task.id) : await supabase.from("crm_tasks").insert(fields);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["crm"] });
      toast.success(task ? "Task updated" : "Task created");
      onClose();
    } catch { toast.error("Could not save task. Please try again."); }
    finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={(open) => !open && !busy && onClose()}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle><DialogDescription>Staff task · Chicago time</DialogDescription></DialogHeader>
    <form onSubmit={save} className="space-y-4">
      <label className="block space-y-2 text-sm"><span>Task</span><input aria-label="Task title" required maxLength={240} className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="block space-y-2 text-sm"><span>Contact</span><select aria-label="Task contact" required className={inputClass} value={contact} onChange={(e) => { setContact(e.target.value); setOpportunity(""); }}><option value="">Select contact</option>{contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="block space-y-2 text-sm"><span>Opportunity · optional</span><select aria-label="Task opportunity" className={inputClass} value={opportunity} onChange={(e) => setOpportunity(e.target.value)} disabled={!contact}><option value="">Contact only</option>{opportunities.map((o) => <option key={o.id} value={o.id}>{o.interest} · {o.stage}</option>)}</select></label>
      <label className="block space-y-2 text-sm"><span>Due · Chicago time · optional</span><input aria-label="Task due date" type="datetime-local" className={inputClass} value={due} onChange={(e) => setDue(e.target.value)} /></label>
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy || !contact || !title.trim()}>{busy ? "Saving…" : "Save task"}</Button></div>
    </form>
  </DialogContent></Dialog>;
}