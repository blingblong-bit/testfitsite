import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import { SmsConsentCheckbox } from "@/components/SmsConsent";
import {
  upcomingDates,
  formatChicagoDate,
  formatChicagoTime,
  formatChicagoDateTime,
} from "@/lib/appointment-availability";
import {
  getAvailableSlotsFn,
  submitAppointmentRequest,
} from "@/lib/appointments.functions";

export const Route = createFileRoute("/schedule-visit")({
  head: () => ({
    meta: [
      { title: "Schedule a Visit — FIT Beyond Plus" },
      {
        name: "description",
        content:
          "Book a free tour of FIT Beyond Plus in Tullahoma. Pick a time that works for you — we'll confirm shortly.",
      },
      { property: "og:title", content: "Schedule a Visit — FIT Beyond Plus" },
      {
        property: "og:description",
        content:
          "Book a free tour of FIT Beyond Plus in Tullahoma. Pick a time that works for you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScheduleVisit,
});

function ScheduleVisit() {
  const days = useMemo(() => upcomingDates(), []);
  const [selectedDate, setSelectedDate] = useState<string>(days[0] ?? "");
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<string | null>(null);

  // 3-second bot-protection timer.
  const [mountedAt] = useState(() => Date.now());

  const getSlots = useServerFn(getAvailableSlotsFn);
  const submit = useServerFn(submitAppointmentRequest);

  useEffect(() => {
    if (!selectedDate) return;
    let cancelled = false;
    setLoadingSlots(true);
    setSelectedSlot(null);
    getSlots({ data: { date: selectedDate } })
      .then((res) => {
        if (!cancelled) setSlots(res.slots);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate, getSlots]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (website) return; // bot
    if (Date.now() - mountedAt < 3000) {
      toast.error("Please take a moment to fill this out.");
      return;
    }
    if (!selectedSlot) {
      toast.error("Pick a time first.");
      return;
    }
    if (!smsConsent) {
      toast.error("Please agree to receive text updates about your visit.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await submit({
        data: {
          name,
          email,
          phone,
          requested_time: selectedSlot,
          sms_consent: smsConsent,
        },
      });
      if (!result.ok) {
        toast.error(result.error || "Something went wrong.");
        return;
      }
      setConfirmed(selectedSlot);
    } catch (err) {
      toast.error("Something went wrong. Please try again.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed) {
    return (
      <section className="container-page py-16 min-h-[70vh]">
        <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8 text-center">
          <div className="mx-auto h-14 w-14 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
            <CalendarClock className="h-7 w-7" />
          </div>
          <h1 className="mt-6 text-3xl">Request received!</h1>
          <p className="mt-3 text-muted-foreground">
            We got your request for{" "}
            <strong className="text-foreground">
              {formatChicagoDateTime(confirmed)}
            </strong>{" "}
            — we'll confirm shortly! Look out for a text at {phone}.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="container-page py-12 min-h-[70vh]">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs tracking-[0.3em] text-primary">SCHEDULE A VISIT</p>
        <h1 className="mt-2 text-3xl md:text-4xl">Book your free tour</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick a day and time — we'll confirm by text shortly. All times in
          Central (Tullahoma, TN).
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label className="text-sm font-semibold uppercase tracking-wide">
              Choose a day
            </label>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
              {days.map((iso) => {
                const active = iso === selectedDate;
                return (
                  <button
                    type="button"
                    key={iso}
                    onClick={() => setSelectedDate(iso)}
                    className={`shrink-0 rounded-lg border px-4 py-3 text-sm text-left transition-colors ${
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-card hover:border-primary/50"
                    }`}
                  >
                    <div className="text-xs text-muted-foreground">
                      {formatChicagoDate(`${iso}T18:00:00Z`).split(",")[0]}
                    </div>
                    <div className="mt-1 font-semibold">
                      {formatChicagoDate(`${iso}T18:00:00Z`)
                        .split(",")[1]
                        ?.trim()}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold uppercase tracking-wide">
              Choose a time
            </label>
            <div className="mt-3">
              {loadingSlots ? (
                <p className="text-sm text-muted-foreground">Loading slots…</p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No open slots on this day. Try another.
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {slots.map((iso) => {
                    const active = iso === selectedSlot;
                    return (
                      <button
                        type="button"
                        key={iso}
                        onClick={() => setSelectedSlot(iso)}
                        className={`rounded-md border px-3 py-2 text-sm ${
                          active
                            ? "border-primary bg-primary/10"
                            : "border-border bg-card hover:border-primary/50"
                        }`}
                      >
                        {formatChicagoTime(iso)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm mb-1" htmlFor="name">Name</label>
              <input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm mb-1" htmlFor="phone">Phone</label>
              <input
                id="phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm mb-1" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* honeypot */}
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="hidden"
            aria-hidden="true"
          />

          <SmsConsentCheckbox checked={smsConsent} onChange={setSmsConsent} />

          <button
            type="submit"
            disabled={submitting || !selectedSlot}
            className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-sm font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-60"
          >
            {submitting ? "Sending…" : "Request this time"}
          </button>
        </form>
      </div>
    </section>
  );
}
