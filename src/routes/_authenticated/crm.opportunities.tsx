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
import { Phone, MessageSquare, ListTodo, ExternalLink, Search, X, LayoutGrid, List } from "lucide-react";
import { PIPELINE_STAGES, type PipelineStage } from "@/lib/crm/opportunities.functions";
import { boardQuery, currentUserQuery, daysSince, fmtChicago, type BoardOpportunity } from "@/lib/crm/queries";
import { useMoveStage } from "@/lib/crm/use-move-stage";
import { StageMoveDialog } from "@/components/crm/StageMoveDialog";

export const Route = createFileRoute("/_authenticated/crm/opportunities")({
  head: () => ({
    meta: [
      { title: "Opportunities — FIT CRM" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OpportunitiesPage,
});

const INTERESTS = ["Membership", "Personal Training", "Combat Sports", "Classes", "Day Pass", "Free Week", "Other"];

function OpportunitiesPage() {
  const navigate = useNavigate();
  const { data = [], isLoading, error } = useQuery(boardQuery);
  const { data: me } = useQuery(currentUserQuery);
  const [view, setView] = useState<"board" | "list">("board");
  const [q, setQ] = useState("");
  const [interest, setInterest] = useState("");
  const [mine, setMine] = useState(false);
  const { requestMove, pending, cancel, confirm } = useMoveStage();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const open = (contactId: string, tab?: string) =>
    navigate({ to: "/crm/opportunities", search: { contact: contactId, ...(tab ? {} : {}) } });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = needle.replace(/\D/g, "");
    return data.filter((o) => {
      if (needle) {
        const c = o.contact;
        const hit =
          (c?.name ?? "").toLowerCase().includes(needle) ||
          (c?.email ?? "").toLowerCase().includes(needle) ||
          (digits.length >= 3 && (c?.phone ?? "").replace(/\D/g, "").includes(digits));
        // Global search ignores every other filter.
        return hit;
      }
      if (interest && o.interest !== interest) return false;
      if (mine && o.owner_id !== me) return false;
      return true;
    });
  }, [data, q, interest, mine, me]);

  const chips = [
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
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, phone, email"
            className="h-10 w-64 rounded-md bg-secondary border border-border pl-9 pr-3 text-sm focus:outline-none focus:border-primary"
          />
        </div>
        <select value={interest} onChange={(e) => setInterest(e.target.value)} className="h-10 rounded-md bg-secondary border border-border px-3 text-sm">
          <option value="">All interests</option>
          {INTERESTS.map((i) => (
            <option key={i}>{i}</option>
          ))}
        </select>
        <button
          onClick={() => setMine((m) => !m)}
          className={`h-10 rounded-md border px-3 text-sm ${mine ? "border-primary text-primary" : "border-border"}`}
        >
          My opportunities
        </button>
        <div className="flex rounded-md border border-border overflow-hidden">
          <button onClick={() => setView("board")} className={`h-10 px-3 ${view === "board" ? "bg-primary/15 text-primary" : ""}`} aria-label="Board view">
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button onClick={() => setView("list")} className={`h-10 px-3 ${view === "list" ? "bg-primary/15 text-primary" : ""}`} aria-label="List view">
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {(chips.length > 0 || q) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {q && <span className="rounded-full bg-secondary px-3 py-1">Searching everything — other filters ignored</span>}
          {chips.map((c) => (
            <button key={c.label} onClick={c.clear} className="inline-flex items-center gap-1 rounded-full border border-primary/50 px-3 py-1 text-primary">
              {c.label} <X className="h-3 w-3" />
            </button>
          ))}
          <button
            onClick={() => {
              setQ("");
              setInterest("");
              setMine(false);
            }}
            className="underline text-muted-foreground"
          >
            Clear all
          </button>
        </div>
      )}

      {isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading pipeline…</p>}
      {error && <p className="mt-8 text-sm text-destructive">Could not load opportunities.</p>}

      {!isLoading && view === "board" && (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="mt-5 flex gap-3 overflow-x-auto pb-4">
            {PIPELINE_STAGES.map((stage) => (
              <Column key={stage} stage={stage} items={filtered.filter((o) => o.stage === stage)} me={me ?? null} onOpen={open} onMove={requestMove} />
            ))}
          </div>
        </DndContext>
      )}

      {!isLoading && view === "list" && (
        <div className="mt-5 overflow-x-auto rounded-lg border border-border">
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
              {filtered.map((o) => (
                <tr key={o.id} className="border-t border-border hover:bg-secondary/40">
                  <td className="p-3">
                    <button onClick={() => open(o.contact_id)} className="font-medium hover:text-primary">
                      {o.contact?.name ?? "—"}
                    </button>
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
  return o.no_action_required ? "No action required" : "—";
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
  onOpen: (id: string) => void;
  onMove: (o: BoardOpportunity, s: PipelineStage) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div
      ref={setNodeRef}
      className={`w-72 shrink-0 rounded-lg border bg-card/50 ${isOver ? "border-primary" : "border-border"}`}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h2 className="text-xs uppercase tracking-wider">{stage}</h2>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <div className="space-y-2 p-2 min-h-24 max-h-[70vh] overflow-y-auto">
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
  onOpen: (id: string) => void;
  onMove: (o: BoardOpportunity, s: PipelineStage) => void;
}) {
  const closed = opp.status !== "open";
  const { setNodeRef, listeners, attributes, transform, isDragging } = useDraggable({ id: opp.id, disabled: closed });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`rounded-md border border-border bg-background p-3 text-sm ${closed ? "opacity-80" : "cursor-grab"} ${isDragging ? "z-50 shadow-lg" : ""}`}
    >
      <button onClick={() => onOpen(opp.contact_id)} className="text-left font-medium hover:text-primary">
        {opp.contact?.name ?? "—"}
      </button>
      <p className="mt-1 text-xs text-muted-foreground">
        {opp.interest} · {opp.source ?? "—"}
      </p>
      <p className="mt-1 text-xs">{taskLabel(opp)}</p>
      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
        <span>{ownerLabel(opp, me)}</span>
        <span>Idle {idleLabel(opp)}</span>
        {opp.appointmentAt && <span className="text-primary">Appt {fmtChicago(opp.appointmentAt)}</span>}
      </div>
      <div className="mt-2 flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
        {opp.contact?.phone && (
          <a href={`tel:${opp.contact.phone}`} aria-label="Call" className="rounded p-1.5 hover:bg-secondary">
            <Phone className="h-4 w-4" />
          </a>
        )}
        <button onClick={() => onOpen(opp.contact_id)} aria-label="Text" className="rounded p-1.5 hover:bg-secondary">
          <MessageSquare className="h-4 w-4" />
        </button>
        <button onClick={() => onOpen(opp.contact_id)} aria-label="Task" className="rounded p-1.5 hover:bg-secondary">
          <ListTodo className="h-4 w-4" />
        </button>
        <button onClick={() => onOpen(opp.contact_id)} aria-label="Open record" className="rounded p-1.5 hover:bg-secondary">
          <ExternalLink className="h-4 w-4" />
        </button>
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
