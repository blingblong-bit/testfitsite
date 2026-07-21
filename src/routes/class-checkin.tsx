import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { submitClassCheckIn } from "@/lib/class-checkin.functions";
import {
  getClassesForDay,
  getDayName,
  type ClassEntry,
} from "@/lib/class-schedule";

export const Route = createFileRoute("/class-checkin")({
  head: () => ({
    meta: [
      { title: "Class Check-In — FIT Beyond Plus" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClassCheckIn,
});

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; verified: boolean }
  | { kind: "error"; message: string };

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function ClassCheckIn() {
  const submit = useServerFn(submitClassCheckIn);
  const day = getDayName();
  const classes = useMemo(() => getClassesForDay(day), [day]);
  const [canceled, setCanceled] = useState<Record<string, string | null>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("class_sessions")
        .select("class_name, canceled_reason, status")
        .eq("session_date", todayISO())
        .eq("status", "canceled");
      const map: Record<string, string | null> = {};
      (data ?? []).forEach((r) => {
        map[r.class_name] = r.canceled_reason ?? null;
      });
      setCanceled(map);
    })();
  }, []);

  useEffect(() => {
    if (classes.length === 1 && !canceled[classes[0].name]) {
      setSelected(classes[0].name);
    }
  }, [classes, canceled]);

  const currentClass: ClassEntry | undefined = classes.find(
    (c) => c.name === selected,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentClass) {
      setStatus({ kind: "error", message: "Please select a class." });
      return;
    }
    setStatus({ kind: "loading" });
    try {
      const res = await submit({
        data: {
          name,
          phone,
          class_name: currentClass.name,
          class_day: day,
          class_time: currentClass.time,
        },
      });
      if (res.ok) {
        setStatus({ kind: "success", verified: res.verified });
        setName("");
        setPhone("");
      } else {
        setStatus({ kind: "error", message: res.error });
      }
    } catch {
      setStatus({ kind: "error", message: "Something went wrong. See the front desk." });
    }
  }

  if (status.kind === "success") {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center">
          {status.verified ? (
            <>
              <h1 className="text-3xl font-bold mb-3">You're checked in! 💪</h1>
              <p className="text-muted-foreground">Have a great class.</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold mb-3">Almost there</h1>
              <p className="text-muted-foreground">
                We couldn't verify an active membership — please see the front desk to check in.
              </p>
            </>
          )}
          <button
            onClick={() => setStatus({ kind: "idle" })}
            className="mt-6 inline-flex h-11 items-center rounded-md bg-primary px-6 text-sm font-bold uppercase tracking-wide text-primary-foreground"
          >
            Check in another
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <p className="text-xs tracking-[0.3em] text-primary">CLASS CHECK-IN</p>
          <h1 className="mt-2 text-3xl font-bold">Today — {day}</h1>
        </div>

        {classes.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
            No classes scheduled today.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 space-y-5">
            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full h-12 rounded-md border border-border bg-background px-4"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                inputMode="tel"
                className="w-full h-12 rounded-md border border-border bg-background px-4"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Class</label>
              <div className="space-y-2">
                {classes.map((c) => {
                  const isCanceled = c.name in canceled;
                  const isSelected = selected === c.name;
                  return (
                    <button
                      key={`${c.name}-${c.time}`}
                      type="button"
                      disabled={isCanceled}
                      onClick={() => setSelected(c.name)}
                      className={`w-full text-left rounded-lg border p-4 transition ${
                        isCanceled
                          ? "border-destructive/40 bg-destructive/10 opacity-70 cursor-not-allowed"
                          : isSelected
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{c.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {c.time}{c.instructor ? ` • ${c.instructor}` : ""}
                          </div>
                        </div>
                        {isCanceled && (
                          <span className="text-xs uppercase tracking-wider text-destructive font-bold">
                            Canceled
                          </span>
                        )}
                      </div>
                      {isCanceled && canceled[c.name] && (
                        <div className="mt-2 text-xs text-destructive">{canceled[c.name]}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {status.kind === "error" && (
              <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                {status.message}
              </div>
            )}

            <button
              type="submit"
              disabled={status.kind === "loading" || !selected}
              className="w-full h-12 rounded-md bg-primary text-primary-foreground font-bold uppercase tracking-wide disabled:opacity-50"
            >
              {status.kind === "loading" ? "Checking in..." : "Check In"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
