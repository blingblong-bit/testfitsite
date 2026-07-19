import { useState } from "react";
import { submitLead } from "@/lib/leads";

export function CombatLeadForm({ discipline }: { discipline: string }) {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const data = new FormData(e.currentTarget);
    try {
      await submitLead({
        source: "combat_sports",
        name: String(data.get("name") ?? ""),
        email: String(data.get("email") ?? ""),
        phone: String(data.get("phone") ?? ""),
        interest: `${discipline} trial class`,
        message: String(data.get("message") ?? ""),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-8 rounded-lg border border-primary bg-primary/10 p-6 text-center">
        <p className="text-lg">
          You're on the list — we'll reach out shortly to get your first {discipline} class
          scheduled.
        </p>
      </div>
    );
  }

  return (
    <form className="mt-8 mx-auto max-w-xl space-y-4 text-left" onSubmit={handleSubmit}>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="cs-name" className="block text-xs uppercase tracking-widest mb-2">
            Name
          </label>
          <input
            id="cs-name"
            name="name"
            required
            className="w-full h-11 rounded-md bg-secondary border border-border px-3 text-sm focus:outline-none focus:border-primary"
          />
        </div>
        <div>
          <label htmlFor="cs-phone" className="block text-xs uppercase tracking-widest mb-2">
            Phone
          </label>
          <input
            id="cs-phone"
            name="phone"
            type="tel"
            className="w-full h-11 rounded-md bg-secondary border border-border px-3 text-sm focus:outline-none focus:border-primary"
          />
        </div>
      </div>
      <div>
        <label htmlFor="cs-email" className="block text-xs uppercase tracking-widest mb-2">
          Email
        </label>
        <input
          id="cs-email"
          name="email"
          type="email"
          required
          className="w-full h-11 rounded-md bg-secondary border border-border px-3 text-sm focus:outline-none focus:border-primary"
        />
      </div>
      <div>
        <label htmlFor="cs-message" className="block text-xs uppercase tracking-widest mb-2">
          Anything we should know? (optional)
        </label>
        <textarea
          id="cs-message"
          name="message"
          rows={3}
          className="w-full rounded-md bg-secondary border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary"
          placeholder="Age (for kids classes), experience level, questions..."
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="text-center">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-12 items-center rounded-md bg-primary px-6 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:brightness-110 transition disabled:opacity-60"
          style={{ boxShadow: "var(--shadow-glow)" }}
        >
          {submitting ? "Sending..." : "Request a Free Trial Class"}
        </button>
      </div>
    </form>
  );
}
