import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Phone, MessageSquare, ListTodo, ExternalLink, Search, X, LayoutGrid, List, GripVertical, Flag } from "lucide-react";
import { PIPELINE_STAGES, type PipelineStage } from "@/lib/crm/opportunities.functions";
import { boardQuery, contactLookupQuery, currentUserQuery, daysSince, fmtChicago, type BoardOpportunity } from "@/lib/crm/queries";
import { useMoveStage } from "@/lib/crm/use-move-stage";
import { Button } from "@/components/ui/button";
import { StageMoveDialog } from "@/components/crm/StageMoveDialog";
import { CallFromFitButton } from "@/components/crm/CallFromFitButton";

export const Route = createFileRoute("/_authenticated/crm/opportunities")({
  head: () => ({
    meta: [
      { title: "Opportunities — FIT CRM" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "FIT sales opportunities, stages, next actions, and contact history." },
      { property: "og:title", content: "Opportunities — FIT CRM" },
      { property: "og:description", content: "FIT sales opportunities, stages, next actions, and contact history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OpportunitiesPage,
});

const INTERESTS = ["Membership", "Personal Training", "Combat Sports", "Classes", "Day Pass", "Free Week", "Other"];

function OpportunitiesPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error } = useQuery(boardQuery);
  const { data: contacts = [] } = useQuery(contactLookupQuery);
  const { data: me } = useQuery(currentUserQuery);
  const [view, setView] = useState<"board" | "list">("board");
  const [q, setQ] = useState("");
  const [interest, setInterest] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [mine, setMine] = useState(false);
  const { requestMove, pending, cancel, confirm } = useMoveStage();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const open = (contactId: string, tab?: string) =>
    navigate({ to: "/crm/opportunities", search: { contact: contactId, ...(tab ? { tab } : { tab: "details" }) } });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = needle.replace(/\D/g, "");
    return data.filter((o) => {
      if (o.contact?.review_flag) return false;
      if (needle) {
        const c = o.contact;
        const hit =
          (c?.name ?? "").toLowerCase().includes(needle) ||
          (c?.email ?? "").toLowerCase().includes(needle) ||
          (digits.length >= 3 && (c?.phone ?? "").replace(/\D/g, "").includes(digits));
        if (!hit) return false;
      }
      if (interest && o.interest !== interest) return false;
      if (stageFilter && o.stage !== stageFilter) return false;
      if (mine && o.owner_id !== me) return false;
      return true;
    });
  }, [data, q, interest, stageFilter, mine, me]);

  const held = contacts.filter((c) => c.review_flag);
  const needle = q.trim().toLowerCase();
  const digits = needle.replace(/\D/g, "");
  const contactMatches = contacts.filter((c) => needle && ((c.name ?? "").toLowerCase().includes(needle) || (c.email ?? "").toLowerCase().includes(needle) || (digits.length >= 3 && (c.phone ?? "").replace(/\D/g, "").includes(digits))));
  const chips = [
    ...(q ? [{ label: `Search: ${q}`, clear: () => setQ("") }] : []),
    ...(stageFilter ? [{ label: `Stage: ${stageFilter}`, clear: () => setStageFilter("") }] : []),
    ...(interest ? [{ label: `Interest: ${interest}`, clear: () => setInterest("") }] : []),
    ...(mine ? [{ label: "Owner: Me", clear: () => setMine(false) }] : []),
  ];

  function onDragEnd(e: DragEndEvent) {
    const opp = data.find((o) => o.id === e.active.id);
    const stage = e.over?.id as PipelineStage | undefined;
    if (!opp || !stage || stage === opp.stage) return;
    requestMove(opp, stage);
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl md:text-3xl mr-auto">FIT Sales</h1>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search contacts" placeholder="Search name, phone, email"
            className="h-10 w-full rounded-md bg-secondary border border-border pl-9 pr-3 text-sm focus:outline-none focus:border-primary"
          />
        </div>
        <select aria-label="Interest filter" value={interest} onChange={(e) => setInterest(e.target.value)} className="h-10 rounded-md bg-secondary border border-border px-3 text-sm">
          <option value="">All interests</option>
          {INTERESTS.map((i) => (
            <option key={i}>{i}</option>
          ))}
        </select>
        <select aria-label="Stage filter" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="h-10 max-w-full rounded-md bg-secondary border border-border px-3 text-sm">
          <option value="">All stages</option>
          {PIPELINE_STAGES.map((stage) => <option key={stage}>{stage}</option>)}
        </select>
        <Button variant="ghost"
          aria-pressed={mine}
          onClick={() => setMine((m) => !m)}
          className={`h-10 rounded-md border px-3 text-sm ${mine ? "border-primary text-primary" : "border-border"}`}
        >
          My opportunities
        </Button>
        <div className="flex rounded-md border border-border overflow-hidden">
          <Button variant="ghost" onClick={() => setView("board")} className={`h-10 px-3 ${view === "board" ? "bg-primary/15 text-primary" : ""}`} title="Board view" aria-pressed={view === "board"} aria-label="Board view">
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button variant="ghost" onClick={() => setView("list")} className={`h-10 px-3 ${view === "list" ? "bg-primary/15 text-primary" : ""}`} title="List view" aria-pressed={view === "list"} aria-label="List view">
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {(chips.length > 0 || q) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {chips.map((c) => (
            <Button variant="ghost" key={c.label} onClick={c.clear} className="inline-flex h-auto max-w-full whitespace-normal items-center gap-1 rounded-full border border-primary/50 px-3 py-1 text-primary">
              {c.label} <X className="h-3 w-3" />
            </Button>
          ))}
          <Button variant="ghost"
            onClick={() => {
              setQ("");
              setInterest("");
              setMine(false);
              setStageFilter("");
            }}
            className="underline text-muted-foreground"
          >
            Clear all
          </Button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted-foreground">{filtered.length} opportunities</span>
        <Button variant="ghost" size="sm" aria-expanded={showReview} onClick={() => setShowReview((v) => !v)}><Flag /> Migration Review · {held.length}</Button>
      </div>
      {(showReview || needle) && (
        <div className="mt-3 border-y border-border py-3 space-y-2" aria-label="Contact lookup results">
          {(needle ? contactMatches : held).map((c) => (
            <Button key={c.id} variant="ghost" onClick={() => open(c.id)} className="h-auto w-full justify-start whitespace-normal text-left py-2">
              {c.review_flag && <Flag className="text-destructive" />}
              <span className="min-w-0"><span className="block">{c.name}</span><span className="block text-xs text-muted-foreground break-words">{c.contact_type ?? "Unclassified"} · {c.phone || "No phone"}{c.review_flag ? " · Held for review — outside pipeline" : ""}</span></span>
            </Button>
          ))}
          {needle && !contactMatches.length && <p className="text-sm text-muted-foreground">No contacts match this search.</p>}
        </div>
      )}
      {!isLoading && <div className="mt-4 grid grid-cols-3 sm:grid-cols-5 xl:grid-cols-9 gap-2" aria-label="Pipeline stage overview">
        {PIPELINE_STAGES.map((stage) => <Button key={stage} variant={stageFilter === stage ? "secondary" : "ghost"} aria-pressed={stageFilter === stage} onClick={() => setStageFilter(stageFilter === stage ? "" : stage)} className="h-auto min-h-16 flex-col gap-1 whitespace-normal px-2 py-2 text-center text-xs"><span>{stage}</span><span className="text-primary">{data.filter((o) => !o.contact?.review_flag && o.stage === stage).length}</span></Button>)}
      </div>}

      {isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading pipeline…</p>}
      {error && <p className="mt-8 text-sm text-destructive">Could not load opportunities.</p>}

      {!isLoading && view === "board" && (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="mt-5 flex items-start gap-3 overflow-x-auto pb-4 snap-x snap-mandatory">
            {PIPELINE_STAGES.filter((stage) => !stageFilter || stage === stageFilter).map((stage) => (
              <Column key={stage} stage={stage} items={filtered.filter((o) => o.stage === stage)} me={me ?? null} onOpen={open} onMove={requestMove} />
            ))}
          </div>
        </DndContext>
      )}

      {!isLoading && view === "list" && (
        <div className="mt-5 rounded-lg border border-border">
          <div className="sm:hidden divide-y divide-border">
            {!filtered.length && <p className="p-4 text-sm text-muted-foreground">No opportunities match these filters.</p>}
            {filtered.map((o) => <Button key={o.id} variant="ghost" onClick={() => open(o.contact_id)} className="h-auto w-full justify-start whitespace-normal px-4 py-3 text-left">
              <span className="w-full min-w-0 space-y-1">
                <span className="block font-medium">{o.contact?.name ?? "—"}</span>
                <span className="block text-xs text-muted-foreground">{o.contact?.contact_type ?? "Unclassified"} · {o.interest}</span>
                <span className="block text-xs text-primary">{o.stage}</span>
                <span className="block text-xs">{taskLabel(o)}</span>
              </span>
            </Button>)}
          </div>
          <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-card text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Contact</th>
                <th className="p-3">Interest</th>
                <th className="p-3">Stage</th>
                <th className="p-3">Source</th>
                <th className="p-3">Owner</th>
                <th className="p-3">Next task</th>
                <th className="p-3">Idle</th>
              </tr>
            </thead>
            <tbody>
              {!filtered.length && <tr><td colSpan={7} className="p-6 text-muted-foreground">No opportunities match these filters.</td></tr>}
              {filtered.map((o) => (
                <tr key={o.id} className="border-t border-border hover:bg-secondary/40">
                  <td className="p-3">
                    <Button variant="ghost" onClick={() => open(o.contact_id)} className="font-medium hover:text-primary">
                      {o.contact?.name ?? "—"}
                    </Button>
                  </td>
                  <td className="p-3">{o.interest}</td>
                  <td className="p-3">
                    <StageSelect opp={o} onMove={requestMove} />
                  </td>
                  <td className="p-3 text-muted-foreground">{o.source ?? "—"}</td>
                  <td className="p-3">{ownerLabel(o, me ?? null)}</td>
                  <td className="p-3">{taskLabel(o)}</td>
                  <td className="p-3">{idleLabel(o)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
      <StageMoveDialog pending={pending} onCancel={cancel} onConfirm={confirm} />
    </div>
  );
}

function ownerLabel(o: BoardOpportunity, me: string | null) {
  return o.owner_id ? (o.owner_id === me ? "You" : "Staff") : "Unassigned";
}
function taskLabel(o: BoardOpportunity) {
  if (o.nextTask) return `${o.nextTask.title}${o.nextTask.due_at ? ` · ${fmtChicago(o.nextTask.due_at)}` : ""}`;
  if (o.status === "won") return "Joined — no sales follow-up";
  if (o.status === "lost") return "Closed — no sales follow-up";
  const guidance: Record<string, string> = {
    "New Lead": "Check initial outreach", "Attempting Contact": "Awaiting response",
    "Engaged": "Review conversation", "Tour or Assessment Booked": "Check appointment details",
    "Trial or Day Pass Active": "Review visit and follow-up", "Decision and Follow-Up": "Follow up on decision",
    "Long-Term Nurture": "Nurture — no task scheduled",
  };
  return guidance[o.stage] ?? "No task scheduled";
}
function idleLabel(o: BoardOpportunity) {
  const d = daysSince(o.last_activity_at);
  return d === null ? "—" : d === 0 ? "Today" : `${d}d`;
}

function Column({
  stage,
  items,
  me,
  onOpen,
  onMove,
}: {
  stage: PipelineStage;
  items: BoardOpportunity[];
  me: string | null;
  onOpen: (id: string, tab?: string) => void;
  onMove: (o: BoardOpportunity, s: PipelineStage) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div
      ref={setNodeRef}
      className={`w-[85vw] sm:w-72 shrink-0 snap-start rounded-lg border bg-card/50 ${isOver ? "border-primary" : "border-border"}`}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h2 className="text-sm font-medium">{stage}</h2>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <div className="space-y-2 p-2 min-h-24 max-h-[65vh] overflow-y-auto">
        {!items.length && <p className="p-3 text-xs text-muted-foreground">No opportunities</p>}
        {items.map((o) => (
          <Card key={o.id} opp={o} me={me} onOpen={onOpen} onMove={onMove} />
        ))}
      </div>
    </div>
  );
}

function Card({
  opp,
  me,
  onOpen,
  onMove,
}: {
  opp: BoardOpportunity;
  me: string | null;
  onOpen: (id: string, tab?: string) => void;
  onMove: (o: BoardOpportunity, s: PipelineStage) => void;
}) {
  const closed = opp.status !== "open";
  const { setNodeRef, listeners, attributes, transform, isDragging } = useDraggable({ id: opp.id, disabled: closed });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-md border border-border bg-background p-3 text-sm ${closed ? "opacity-80" : "cursor-grab"} ${isDragging ? "z-50 shadow-lg" : ""}`}
    >
      {!closed && <Button variant="ghost" size="icon" {...listeners} {...attributes} title="Drag to move stage" aria-label={`Move ${opp.contact?.name ?? "opportunity"}`} className="float-right h-7 w-7 cursor-grab touch-none"><GripVertical /></Button>}
      <Button variant="ghost" onClick={() => onOpen(opp.contact_id)} className="h-auto min-h-8 max-w-full px-0 py-1 whitespace-normal break-words text-left justify-start font-medium hover:text-primary">
        {opp.contact?.name ?? "—"}
      </Button>
      <p className="mt-1 text-xs text-muted-foreground">{opp.contact?.contact_type ?? "Unclassified"}{opp.contact?.phone ? ` · ${opp.contact.phone}` : ""}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {opp.interest} · {opp.source ?? "—"}
      </p>
      <p className={`mt-2 text-xs ${opp.nextTask?.due_at && new Date(opp.nextTask.due_at).getTime() < Date.now() ? "text-destructive" : "text-foreground"}`}>{taskLabel(opp)}</p>
      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
        <span>{ownerLabel(opp, me)}</span>
        <span>Idle {idleLabel(opp)}</span>
        {opp.appointmentAt && <span className="text-primary">Appt {fmtChicago(opp.appointmentAt)}</span>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
        <CallFromFitButton contactId={opp.contact_id} opportunityId={opp.id} phone={opp.contact?.phone} compact />
        {false && <Phone />}
        <Button variant="ghost" onClick={() => onOpen(opp.contact_id, "conversation")} title="Open conversation" aria-label="Text" className="rounded p-1.5 hover:bg-secondary">
          <MessageSquare className="h-4 w-4" />
        </Button>
        <Button variant="ghost" onClick={() => onOpen(opp.contact_id, "tasks")} title="Open tasks" aria-label="Task" className="rounded p-1.5 hover:bg-secondary">
          <ListTodo className="h-4 w-4" />
        </Button>
        <Button variant="ghost" onClick={() => onOpen(opp.contact_id)} title="Open contact record" aria-label="Open record" className="rounded p-1.5 hover:bg-secondary">
          <ExternalLink className="h-4 w-4" />
        </Button>
        {!closed && (
          <div className="ml-auto md:hidden">
            <StageSelect opp={opp} onMove={onMove} compact />
          </div>
        )}
      </div>
    </div>
  );
}

function StageSelect({
  opp,
  onMove,
  compact,
}: {
  opp: BoardOpportunity;
  onMove: (o: BoardOpportunity, s: PipelineStage) => void;
  compact?: boolean;
}) {
  if (opp.status !== "open") return <span className="text-xs">{opp.stage}</span>;
  return (
    <select
      value={opp.stage}
      onChange={(e) => onMove(opp, e.target.value as PipelineStage)}
      aria-label="Move stage"
      className={`rounded-md bg-secondary border border-border text-xs ${compact ? "h-8 px-1 max-w-32" : "h-8 px-2"}`}
    >
      {PIPELINE_STAGES.map((s) => (
        <option key={s}>{s}</option>
      ))}
    </select>
  );
}
