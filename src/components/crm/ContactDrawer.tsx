import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Phone, MessageSquare, StickyNote, ListTodo, Flag, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { sendManualSms } from "@/lib/send-manual-sms.functions";
import { assignOpportunityOwner, PIPELINE_STAGES, type PipelineStage } from "@/lib/crm/opportunities.functions";
import { contactQuery, currentUserQuery, fmtChicago } from "@/lib/crm/queries";
import { useMoveStage } from "@/lib/crm/use-move-stage";
import { StageMoveDialog } from "./StageMoveDialog";
import { CallFromFitButton } from "./CallFromFitButton";
import { TourScheduler } from "./TourScheduler";

const input =
  "w-full rounded-md bg-secondary border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary";

export function ContactDrawer({ contactId, initialTab, onClose }: { contactId: string | null; initialTab?: string; onClose: () => void }) {
  return (
    <Sheet open={!!contactId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0 min-w-0">
        {contactId && <DrawerBody key={contactId} id={contactId} initialTab={initialTab} />}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({ id, initialTab }: { id: string; initialTab?: string }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery(contactQuery(id));
  const { data: me } = useQuery(currentUserQuery);
  const [tab, setTab] = useState(initialTab ?? "details");
  useEffect(() => { setTab(initialTab ?? "details"); }, [initialTab]);
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
      <SheetHeader className="p-4 sm:p-6 pb-4 border-b border-border text-left pr-12">
        <SheetTitle className="text-2xl break-words">{lead.name}</SheetTitle>
        <SheetDescription className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          <span>{lead.contact_type ?? "Unclassified"}</span>
          {lead.phone && <span>{lead.phone}</span>}
          {lead.email && <span className="break-all">{lead.email}</span>}
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
          <CallFromFitButton contactId={lead.id} phone={lead.phone} />
          <Button variant="outline" onClick={() => setTab("conversation")} className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-secondary">
            <MessageSquare className="h-4 w-4" /> Text
          </Button>
          <Button variant="outline" onClick={() => setTab("notes")} className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-secondary">
            <StickyNote className="h-4 w-4" /> Note
          </Button>
          <Button variant="outline" onClick={() => setTab("tasks")} className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-secondary">
            <ListTodo className="h-4 w-4" /> Task
          </Button>
          <Button variant="outline" onClick={() => setTab("appointments")} className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-secondary">
            <CalendarPlus className="h-4 w-4" /> Book Tour
          </Button>
        </div>
        {!lead.review_flag && openOpp && (
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
        <div className="mt-3 space-y-1 text-sm">
          <p className="text-muted-foreground">{lead.review_flag ? "Held for review — outside the sales pipeline" : opportunities.map((o) => `${o.interest}: ${o.stage}`).join(" · ") || "No sales opportunity"}</p>
          <p>{tasks.find((t) => !t.completed_at)?.title ? `Next task: ${tasks.find((t) => !t.completed_at)?.title}` : "No staff task scheduled"}</p>
        </div>
      </SheetHeader>

      <Tabs value={tab} onValueChange={setTab} className="p-4">
        <label className="sm:hidden block mb-3 text-xs text-muted-foreground">
          Contact section
          <select aria-label="Contact section" value={tab} onChange={(e) => setTab(e.target.value)} className={`${input} mt-1 text-foreground`}>
            {["details", "conversation", "opportunities", "tasks", "appointments", "notes", "activity", "automation"].map((v) => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
          </select>
        </label>
        <TabsList className="hidden sm:flex flex-wrap h-auto justify-start">
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
            {!data.sms.some((m) => m.direction === "inbound" || m.direction === "outbound") && <p className="text-sm text-muted-foreground">No texts yet.</p>}
            {data.sms.filter((m) => m.direction === "inbound" || m.direction === "outbound").map((m) => {
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
              <Button disabled={busy || !sms.trim()} onClick={sendText} className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50">
                {busy ? "Sending…" : "Send text"}
              </Button>
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
                  <Button variant="link" onClick={() => assignToMe(o.id, o.owner_id !== me)} className="underline text-primary">
                    {o.owner_id === me ? "Unassign" : "Assign to me"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="tasks" className="space-y-3">
          <div className="space-y-2">
            <input value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} className={input} placeholder="Task, e.g. Call about membership decision" />
            <input type="datetime-local" value={task.due} onChange={(e) => setTask({ ...task, due: e.target.value })} className={input} />
            <Button onClick={addTask} disabled={!task.title.trim()} className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50">
              Add task
            </Button>
          </div>
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
              <div>
                <p className={t.completed_at ? "line-through text-muted-foreground" : ""}>{t.title}</p>
                <p className="text-xs text-muted-foreground">Due {fmtChicago(t.due_at)}</p>
              </div>
              {!t.completed_at && (
                <Button variant="outline" onClick={() => completeTask(t.id)} className="h-8 rounded-md border border-border px-3 text-xs hover:bg-secondary">
                  Complete
                </Button>
              )}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="appointments" className="text-sm">
          <TourScheduler lead={lead} appointments={appointments} onChanged={refresh} />
        </TabsContent>

        <TabsContent value="notes" className="space-y-3">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={input} placeholder="Add a note…" />
          <Button onClick={addNote} disabled={!note.trim()} className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50">
            Save note
          </Button>
          {!notes.length && !lead.notes && <p className="text-sm text-muted-foreground">No notes yet.</p>}
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
          <Row k="Sequence" v={lead.sequence_status ?? "Not enrolled"} />
          <Row k="Next follow-up" v={lead.sequence_status === "active" && !lead.sms_opted_out ? fmtChicago(lead.next_follow_up_date) : "Not scheduled — sequence inactive"} />
          <Row k="Follow-ups sent" v={String(lead.followup_count ?? 0)} />
          <Row k="Last text" v={fmtChicago(lead.last_sms_at)} />
          <Row k="SMS opted out" v={lead.sms_opted_out ? "Yes" : "No"} />
          <Row k="High intent" v={lead.high_intent ? `Yes — ${lead.high_intent_note ?? ""}` : "No"} />
          {activity.filter((a) => /automation|sequence|welcome|stage/.test(a.kind)).map((a) => <div key={a.id} className="border-l-2 border-border pl-3 py-2"><p>{a.summary}</p><p className="text-xs text-muted-foreground">{fmtChicago(a.created_at)}</p></div>)}
          {data.sms.filter((m) => m.direction === "outbound" && (m.metadata as { kind?: string } | null)?.kind !== "manual").slice(-10).reverse().map((m) => <div key={m.id} className="border-l-2 border-border pl-3 py-2"><p className="whitespace-pre-wrap">{m.body}</p><p className="text-xs text-muted-foreground">Automated · {fmtChicago(m.created_at)} · {m.delivery_status ?? m.status}</p></div>)}
          {data.sms.filter((m) => m.direction === "system").slice(-10).reverse().map((m) => <div key={m.id} className="border-l-2 border-border pl-3 py-2"><p className="font-medium">System event — not a customer message</p><p className="whitespace-pre-wrap">{m.body}</p><p className="text-xs text-muted-foreground">{fmtChicago(m.created_at)} · {m.status}</p></div>)}
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
      <span className="text-right min-w-0 break-words">{v}</span>
    </div>
  );
}
