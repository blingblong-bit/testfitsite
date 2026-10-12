import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Phone, MessageSquare, StickyNote, ListTodo, Flag, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { sendManualSms } from "@/lib/send-manual-sms.functions";
import { assignOpportunityOwner, PIPELINE_STAGES, type PipelineStage } from "@/lib/crm/opportunities.functions";
import { contactQuery, currentUserQuery, fmtChicago } from "@/lib/crm/queries";
import { useMoveStage } from "@/lib/crm/use-move-stage";
import { StageMoveDialog } from "./StageMoveDialog";

const input =
  "w-full rounded-md bg-secondary border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary";

export function ContactDrawer({ contactId, onClose }: { contactId: string | null; onClose: () => void }) {
  return (
    <Sheet open={!!contactId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
        {contactId && <DrawerBody id={contactId} />}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({ id }: { id: string }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery(contactQuery(id));
  const { data: me } = useQuery(currentUserQuery);
  const [tab, setTab] = useState("details");
  const { requestMove, pending, cancel, confirm } = useMoveStage();
  const sendSms = useServerFn(sendManualSms);
  const assign = useServerFn(assignOpportunityOwner);
  const [sms, setSms] = useState("");
  const [note, setNote] = useState("");
  const [task, setTask] = useState({ title: "", due: "" });
  const [busy, setBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["crm"] });

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (error || !data?.lead) return <p className="p-6 text-sm text-destructive">Could not load this contact.</p>;
  const { lead, opportunities, appointments, tasks, activity } = data;
  const openOpp = opportunities.find((o) => o.status === "open") ?? null;

  async function sendText() {
    if (!lead.phone || !sms.trim()) return;
    setBusy(true);
    const r = await sendSms({ data: { lead_id: lead.id, phone: lead.phone, message: sms.trim() } });
    setBusy(false);
    if (r.ok) {
      setSms("");
      toast.success("Text sent — automation paused for this person");
      refresh();
    } else toast.error(r.error === "forbidden" ? "Only admins can send texts." : `Not sent: ${r.error}`);
  }

  async function addNote() {
    if (!note.trim()) return;
    const { error: e } = await supabase.from("contact_activity").insert({
      contact_id: lead.id,
      opportunity_id: openOpp?.id ?? null,
      kind: "note",
      summary: note.trim(),
      actor_id: me ?? null,
    });
    if (e) return toast.error(e.message);
    setNote("");
    refresh();
  }

  async function addTask() {
    if (!task.title.trim()) return;
    const { error: e } = await supabase.from("crm_tasks").insert({
      contact_id: lead.id,
      opportunity_id: openOpp?.id ?? null,
      title: task.title.trim(),
      due_at: task.due ? new Date(task.due).toISOString() : null,
      owner_id: me ?? null,
    });
    if (e) return toast.error(e.message);
    setTask({ title: "", due: "" });
    toast.success("Task added");
    refresh();
  }

  async function completeTask(taskId: string) {
    const { error: e } = await supabase
      .from("crm_tasks")
      .update({ completed_at: new Date().toISOString(), completed_by: me ?? null })
      .eq("id", taskId);
    if (e) return toast.error(e.message);
    refresh();
  }

  async function assignToMe(oppId: string, toMe: boolean) {
    const r = await assign({ data: { opportunity_id: oppId, to_me: toMe } });
    if (!r.ok) toast.error(r.error);
    refresh();
  }

  const notes = activity.filter((a) => a.kind === "note");

  return (
    <div className="flex flex-col">
      <SheetHeader className="p-6 pb-4 border-b border-border text-left">
        <SheetTitle className="text-2xl">{lead.name}</SheetTitle>
        <SheetDescription className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          <span>{lead.contact_type ?? "Unclassified"}</span>
          {lead.phone && <span>{lead.phone}</span>}
          {lead.email && <span>{lead.email}</span>}
        </SheetDescription>
        {lead.review_flag && (
          <div className="mt-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <Flag className="h-4 w-4 mt-0.5 text-destructive" />
            <span>
              <strong>Migration Review:</strong> {lead.review_reason}
            </span>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {lead.phone && (
            <a href={`tel:${lead.phone}`} className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-secondary">
              <Phone className="h-4 w-4" /> Call
            </a>
          )}
          <button onClick={() => setTab("conversation")} className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-secondary">
            <MessageSquare className="h-4 w-4" /> Text
          </button>
          <button onClick={() => setTab("notes")} className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-secondary">
            <StickyNote className="h-4 w-4" /> Note
          </button>
          <button onClick={() => setTab("tasks")} className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-secondary">
            <ListTodo className="h-4 w-4" /> Task
          </button>
          <button onClick={() => setTab("appointments")} className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-secondary">
            <CalendarPlus className="h-4 w-4" /> Appointment
          </button>
        </div>
        {openOpp && (
          <label className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Stage</span>
            <select
              value={openOpp.stage}
              onChange={(e) =>
                requestMove({ id: openOpp.id, status: openOpp.status, contact: { name: lead.name } }, e.target.value as PipelineStage)
              }
              className="h-9 rounded-md bg-secondary border border-border px-2 text-sm"
            >
              {PIPELINE_STAGES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        )}
      </SheetHeader>

      <Tabs value={tab} onValueChange={setTab} className="p-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="conversation">Conversation</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="automation">Automation</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-2 text-sm">
          <Row k="Contact type" v={lead.contact_type ?? "—"} />
          <Row k="Tags" v={lead.tags?.length ? lead.tags.join(", ") : "—"} />
          <Row k="Original source" v={lead.original_source ?? lead.source} />
          <Row k="Latest source" v={lead.latest_source ?? "—"} />
          <Row k="UTM" v={[lead.utm_source, lead.utm_medium, lead.utm_campaign].filter(Boolean).join(" / ") || "—"} />
          <Row k="Communication" v={lead.comm_pref ?? "—"} />
          <Row k="Interest (form)" v={lead.interest ?? "—"} />
          <Row k="Created" v={fmtChicago(lead.created_at)} />
          {lead.message && <p className="mt-3 rounded-md bg-secondary p-3 whitespace-pre-wrap">{lead.message}</p>}
        </TabsContent>

        <TabsContent value="conversation" className="space-y-3">
          <div className="max-h-[50vh] overflow-y-auto space-y-2">
            {data.sms.length === 0 && <p className="text-sm text-muted-foreground">No texts yet.</p>}
            {data.sms.map((m) => {
              const kind = (m.metadata as { kind?: string } | null)?.kind;
              const out = m.direction === "outbound";
              return (
                <div key={m.id} className={`rounded-lg p-3 text-sm ${out ? "bg-primary/10 ml-8" : "bg-secondary mr-8"}`}>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {out ? (m.from_ai || kind !== "manual" ? "Automated" : "Staff") : "Customer"} · {fmtChicago(m.created_at)}
                    {out && m.delivery_status ? ` · ${m.delivery_status}` : ""}
                  </p>
                </div>
              );
            })}
          </div>
          {lead.phone && !lead.sms_opted_out ? (
            <div className="space-y-2">
              <textarea value={sms} onChange={(e) => setSms(e.target.value)} rows={3} className={input} placeholder="Type a text…" />
              <button disabled={busy || !sms.trim()} onClick={sendText} className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50">
                {busy ? "Sending…" : "Send text"}
              </button>
              <p className="text-xs text-muted-foreground">Sending pauses this person's automated texts.</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{lead.sms_opted_out ? "Opted out of texts." : "No phone on file."}</p>
          )}
        </TabsContent>

        <TabsContent value="opportunities" className="space-y-2">
          {opportunities.length === 0 && <p className="text-sm text-muted-foreground">No opportunities.</p>}
          {opportunities.map((o) => (
            <div key={o.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <strong>{o.interest}</strong>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">{o.status}</span>
              </div>
              <p className="mt-1">{o.stage}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Source {o.source ?? "—"} · Last activity {fmtChicago(o.last_activity_at)}
                {o.won_lost_reason ? ` · ${o.won_lost_reason}` : ""}
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span>Owner: {o.owner_id ? (o.owner_id === me ? "You" : "Staff") : "Unassigned"}</span>
                {o.status === "open" && (
                  <button onClick={() => assignToMe(o.id, o.owner_id !== me)} className="underline text-primary">
                    {o.owner_id === me ? "Unassign" : "Assign to me"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="tasks" className="space-y-3">
          <div className="space-y-2">
            <input value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} className={input} placeholder="Task, e.g. Call about membership decision" />
            <input type="datetime-local" value={task.due} onChange={(e) => setTask({ ...task, due: e.target.value })} className={input} />
            <button onClick={addTask} disabled={!task.title.trim()} className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50">
              Add task
            </button>
          </div>
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
              <div>
                <p className={t.completed_at ? "line-through text-muted-foreground" : ""}>{t.title}</p>
                <p className="text-xs text-muted-foreground">Due {fmtChicago(t.due_at)}</p>
              </div>
              {!t.completed_at && (
                <button onClick={() => completeTask(t.id)} className="h-8 rounded-md border border-border px-3 text-xs hover:bg-secondary">
                  Complete
                </button>
              )}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="appointments" className="space-y-2 text-sm">
          {appointments.length === 0 && <p className="text-muted-foreground">No appointments.</p>}
          {appointments.map((a) => (
            <div key={a.id} className="rounded-lg border border-border p-3">
              <p>
                {a.type} · {fmtChicago(a.confirmed_time ?? a.requested_time)}
              </p>
              <p className="text-xs text-muted-foreground">{a.status}</p>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            To book or change a tour, use Book Tour on this person in the Lead Tracker — reminders stay in sync from there.
          </p>
        </TabsContent>

        <TabsContent value="notes" className="space-y-3">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={input} placeholder="Add a note…" />
          <button onClick={addNote} disabled={!note.trim()} className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50">
            Save note
          </button>
          {notes.map((n) => (
            <div key={n.id} className="rounded-lg bg-secondary p-3 text-sm">
              <p className="whitespace-pre-wrap">{n.summary}</p>
              <p className="mt-1 text-xs text-muted-foreground">{fmtChicago(n.created_at)}</p>
            </div>
          ))}
          {lead.notes && (
            <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground whitespace-pre-wrap">
              <p className="mb-1 font-semibold text-foreground">Earlier notes</p>
              {lead.notes}
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity" className="space-y-2 text-sm">
          {activity.length === 0 && <p className="text-muted-foreground">No activity yet.</p>}
          {activity.map((a) => (
            <div key={a.id} className="border-l-2 border-border pl-3">
              <p>{a.summary}</p>
              <p className="text-xs text-muted-foreground">
                {a.kind.replace("_", " ")} · {fmtChicago(a.created_at)}
                {a.source ? ` · ${a.source}` : ""}
              </p>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="automation" className="space-y-2 text-sm">
          <Row k="Sequence" v={lead.sequence_status ?? "—"} />
          <Row k="Follow-ups sent" v={String(lead.followup_count ?? 0)} />
          <Row k="Last text" v={fmtChicago(lead.last_sms_at)} />
          <Row k="SMS opted out" v={lead.sms_opted_out ? "Yes" : "No"} />
          <Row k="High intent" v={lead.high_intent ? `Yes — ${lead.high_intent_note ?? ""}` : "No"} />
        </TabsContent>
      </Tabs>
      <StageMoveDialog pending={pending} onCancel={cancel} onConfirm={confirm} />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 py-1.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}
