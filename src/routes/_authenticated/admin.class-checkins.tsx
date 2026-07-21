import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Trash2, Plus, Ban, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { submitClassCheckIn } from "@/lib/class-checkin.functions";
import { getClassesForDay, DAYS, type DayOfWeek } from "@/lib/class-schedule";

export const Route = createFileRoute("/_authenticated/admin/class-checkins")({
  head: () => ({
    meta: [
      { title: "Class Check-Ins — Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminClassCheckins,
});

type CheckIn = {
  id: string;
  name: string;
  phone: string;
  class_name: string;
  class_day: string;
  class_time: string;
  checked_in_at: string;
  verified: boolean;
  added_manually: boolean;
  notes: string | null;
};

type CanceledSession = {
  id: string;
  class_name: string;
  canceled_reason: string | null;
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayFromISO(iso: string): DayOfWeek {
  const d = new Date(iso + "T12:00:00");
  return DAYS[d.getDay()];
}

function AdminClassCheckins() {
  const submit = useServerFn(submitClassCheckIn);
  const [date, setDate] = useState<string>(todayISO());
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [canceled, setCanceled] = useState<CanceledSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);

  const day = dayFromISO(date);
  const classes = useMemo(() => getClassesForDay(day), [day]);

  const load = useCallback(async () => {
    setLoading(true);
    const start = `${date}T00:00:00`;
    const end = `${date}T23:59:59.999`;
    const [ci, cs] = await Promise.all([
      supabase
        .from("class_checkins")
        .select("*")
        .gte("checked_in_at", start)
        .lte("checked_in_at", end)
        .order("checked_in_at", { ascending: true }),
      supabase
        .from("class_sessions")
        .select("id, class_name, canceled_reason, status")
        .eq("session_date", date)
        .eq("status", "canceled"),
    ]);
    setCheckins((ci.data as CheckIn[]) ?? []);
    setCanceled((cs.data as CanceledSession[]) ?? []);
    setLoading(false);
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  async function removeCheckin(id: string) {
    if (!confirm("Remove this check-in?")) return;
    const { error } = await supabase.from("class_checkins").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    load();
  }

  async function cancelClass(className: string) {
    const reason = prompt(`Cancel "${className}"? Optional reason:`) ?? undefined;
    if (reason === null) return;
    const { error } = await supabase.from("class_sessions").insert({
      class_name: className,
      session_date: date,
      status: "canceled",
      canceled_reason: reason || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Class marked canceled");
    load();
  }

  async function undoCancel(id: string) {
    const { error } = await supabase.from("class_sessions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Cancellation removed");
    load();
  }

  const grouped = useMemo(() => {
    const map = new Map<string, CheckIn[]>();
    classes.forEach((c) => map.set(c.name, []));
    checkins.forEach((c) => {
      const arr = map.get(c.class_name) ?? [];
      arr.push(c);
      map.set(c.class_name, arr);
    });
    return map;
  }, [checkins, classes]);

  const canceledMap = useMemo(() => {
    const m = new Map<string, CanceledSession>();
    canceled.forEach((c) => m.set(c.class_name, c));
    return m;
  }, [canceled]);

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link to="/admin/leads" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to Lead Tracker
          </Link>
          <button
            onClick={() => setManualOpen(true)}
            className="inline-flex items-center gap-2 h-10 rounded-md bg-primary px-4 text-sm font-bold uppercase tracking-wide text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Add Check-In
          </button>
        </div>

        <div className="mb-6">
          <p className="text-xs tracking-[0.3em] text-primary">ADMIN</p>
          <h1 className="text-3xl font-bold mt-1">Class Check-Ins</h1>
          <div className="mt-4 flex items-center gap-3">
            <label className="text-sm text-muted-foreground">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 rounded-md border border-border bg-background px-3"
            />
            <button
              onClick={() => setDate(todayISO())}
              className="text-sm text-primary hover:underline"
            >
              Today
            </button>
            <span className="ml-auto text-sm text-muted-foreground">{day}</span>
          </div>
        </div>

        {loading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : classes.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
            No classes scheduled for {day}.
          </div>
        ) : (
          <div className="space-y-4">
            {classes.map((c) => {
              const rows = grouped.get(c.name) ?? [];
              const cancel = canceledMap.get(c.name);
              return (
                <div key={`${c.name}-${c.time}`} className="rounded-xl border border-border bg-card">
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <div>
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {c.time}{c.instructor ? ` • ${c.instructor}` : ""} • {rows.length} checked in
                      </div>
                      {cancel && (
                        <div className="mt-1 text-xs text-destructive">
                          Canceled{cancel.canceled_reason ? ` — ${cancel.canceled_reason}` : ""}
                        </div>
                      )}
                    </div>
                    {cancel ? (
                      <button
                        onClick={() => undoCancel(cancel.id)}
                        className="text-xs uppercase tracking-wider font-bold text-muted-foreground hover:text-foreground"
                      >
                        Undo Cancel
                      </button>
                    ) : (
                      <button
                        onClick={() => cancelClass(c.name)}
                        className="inline-flex items-center gap-1 text-xs uppercase tracking-wider font-bold text-destructive hover:opacity-80"
                      >
                        <Ban className="h-3 w-3" /> Mark Canceled
                      </button>
                    )}
                  </div>
                  {rows.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">No check-ins yet.</div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {rows.map((r) => (
                        <li key={r.id} className="flex items-center gap-3 p-4">
                          {r.verified ? (
                            <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">
                              {r.name}
                              {r.added_manually && (
                                <span className="ml-2 text-xs uppercase tracking-wider text-muted-foreground">Manual</span>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {r.phone} • {new Date(r.checked_in_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                              {!r.verified && " • unverified"}
                            </div>
                            {r.notes && <div className="text-xs text-muted-foreground mt-1">{r.notes}</div>}
                          </div>
                          <button
                            onClick={() => removeCheckin(r.id)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {manualOpen && (
        <ManualCheckinModal
          day={day}
          date={date}
          classes={classes}
          onClose={() => setManualOpen(false)}
          onDone={() => {
            setManualOpen(false);
            load();
          }}
          submit={submit}
        />
      )}
    </main>
  );
}

function ManualCheckinModal({
  day,
  date,
  classes,
  onClose,
  onDone,
  submit,
}: {
  day: DayOfWeek;
  date: string;
  classes: ReturnType<typeof getClassesForDay>;
  onClose: () => void;
  onDone: () => void;
  submit: ReturnType<typeof useServerFn<typeof submitClassCheckIn>>;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [classIdx, setClassIdx] = useState(0);
  const [override, setOverride] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const isToday = date === todayISO();

  async function handle() {
    if (!name.trim() || classes.length === 0) return;
    setSaving(true);
    try {
      const cls = classes[classIdx];
      if (override) {
        const { error } = await supabase.from("class_checkins").insert({
          name: name.trim(),
          phone: phone.trim() || "manual",
          class_name: cls.name,
          class_day: day,
          class_time: cls.time,
          verified: true,
          added_manually: true,
          notes: notes.trim() || null,
        });
        if (error) throw error;
        toast.success("Check-in added (override)");
      } else {
        if (!isToday) {
          toast.error("Membership verification only works for today. Use override for past dates.");
          setSaving(false);
          return;
        }
        const res = await submit({
          data: {
            name: name.trim(),
            phone: phone.trim(),
            class_name: cls.name,
            class_day: day,
            class_time: cls.time,
          },
        });
        if (!res.ok) throw new Error(res.error);
        toast.success(res.verified ? "Verified check-in added" : "Unverified check-in added");
      }
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">Add Check-In</h2>
        <div className="space-y-3">
          <input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-11 rounded-md border border-border bg-background px-3"
          />
          <input
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full h-11 rounded-md border border-border bg-background px-3"
          />
          <select
            value={classIdx}
            onChange={(e) => setClassIdx(Number(e.target.value))}
            className="w-full h-11 rounded-md border border-border bg-background px-3"
          >
            {classes.map((c, i) => (
              <option key={`${c.name}-${c.time}`} value={i}>
                {c.name} — {c.time}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
            Override — skip membership verification (guests / manual)
          </label>
          {override && (
            <input
              placeholder="Note (e.g. guest of Jane)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-11 rounded-md border border-border bg-background px-3"
            />
          )}
        </div>
        <div className="mt-6 flex gap-3 justify-end">
          <button onClick={onClose} className="h-10 px-4 text-sm">Cancel</button>
          <button
            onClick={handle}
            disabled={saving || !name.trim() || classes.length === 0}
            className="h-10 px-5 rounded-md bg-primary text-primary-foreground text-sm font-bold uppercase tracking-wide disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
