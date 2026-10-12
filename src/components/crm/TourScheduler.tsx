import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { syncStaffTourAppointment } from "@/lib/appointments.functions";
import { chicagoWallToUTC } from "@/lib/appointment-availability";
import { fmtChicago } from "@/lib/crm/queries";

type Lead = {
  id: string;
  phone: string | null;
  tour_scheduled: boolean | null;
  tour_completed: boolean | null;
  tour_date: string | null;
};
type Appt = {
  id: string;
  type: string;
  status: string;
  confirmed_time: string | null;
  requested_time: string | null;
};

const input =
  "w-full rounded-md bg-secondary border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary";

// "YYYY-MM-DDTHH:mm" in America/Chicago wall-clock time.
function toChicagoInput(iso: string | null): string {
  if (!iso) return "";
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  const hh = g("hour") === "24" ? "00" : g("hour");
  return `${g("year")}-${g("month")}-${g("day")}T${hh}:${g("minute")}`;
}
function fromChicagoInput(v: string): string | null {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  return chicagoWallToUTC(+m[1], +m[2], +m[3], +m[4], +m[5]);
}

export function TourScheduler({ lead, appointments, onChanged }: { lead: Lead; appointments: Appt[]; onChanged: () => void }) {
  const sync = useServerFn(syncStaffTourAppointment);
  const active = !!lead.tour_scheduled && !lead.tour_completed && !!lead.tour_date;
  const [when, setWhen] = useState(toChicagoInput(active ? lead.tour_date : null));
  const [busy, setBusy] = useState(false);

  async function save(patch: Partial<Lead>, ok: string) {
    setBusy(true);
    const { error } = await supabase.from("leads").update(patch as never).eq("id", lead.id);
    if (error) { setBusy(false); toast.error("Couldn't save the tour"); return; }
    const res = await sync({ data: { lead_id: lead.id } });
    setBusy(false);
    if (!res.ok) toast.error("Tour saved, but reminder texts couldn't be set up");
    else if (res.state === "no_phone") toast.message(`${ok} — no phone on file, so no reminders`);
    else toast.success(ok);
    onChanged();
  }

  function book() {
    const iso = fromChicagoInput(when);
    if (!iso) return toast.error("Pick a date and time");
    if (new Date(iso).getTime() < Date.now()) return toast.error("That time has already passed");
    save({ tour_scheduled: true, tour_completed: false, tour_date: iso }, active ? "Tour rescheduled — reminders updated" : "Tour booked — reminders scheduled");
  }

  const pendingRequests = appointments.filter((a) => a.status === "pending" || a.status === "alternative_suggested");

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-3 space-y-3">
        <p className="font-semibold">{active ? "Upcoming tour" : "Book a tour"}</p>
        {active && <p className="text-sm">{fmtChicago(lead.tour_date)} (Chicago time)</p>}
        <label className="block text-xs text-muted-foreground">
          {active ? "New date and time" : "Date and time"}
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={`${input} mt-1 text-foreground`} />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || !when} onClick={book}>{active ? "Reschedule" : "Book tour"}</Button>
          {active && (
            <>
              <Button variant="outline" disabled={busy} onClick={() => save({ tour_completed: true }, "Tour marked completed")}>Mark completed</Button>
              <Button variant="outline" disabled={busy} onClick={() => { if (confirm("Cancel this tour? Reminder texts will stop.")) save({ tour_scheduled: false, tour_date: null }, "Tour canceled — reminders stopped"); }}>Cancel tour</Button>
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {!lead.phone ? "No phone on file — reminders can't be sent." : "Reminder texts go out the day before, 8 AM the morning of, and about an hour before."}
        </p>
      </div>

      {pendingRequests.length > 0 && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
          <p className="font-semibold">Website request waiting</p>
          {pendingRequests.map((a) => (
            <div key={a.id} className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span>{a.type} · requested {fmtChicago(a.requested_time)}</span>
              {a.requested_time && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setWhen(toChicagoInput(a.requested_time))}>Use this time</Button>
              )}
            </div>
          ))}
          <p className="mt-2 text-xs text-muted-foreground">Pick "Use this time," then Book tour to confirm it.</p>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">History</p>
        {appointments.length === 0 && <p className="text-muted-foreground">No appointments yet.</p>}
        {appointments.map((a) => (
          <div key={a.id} className="rounded-lg border border-border p-3">
            <p>{a.type} · {fmtChicago(a.confirmed_time ?? a.requested_time)}</p>
            <p className="text-xs text-muted-foreground">{a.status}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
