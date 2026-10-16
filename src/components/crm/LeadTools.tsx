import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Shared staff tools used by both the CRM and the legacy Lead Tracker.
type CrmStatus =
  | "New Lead"
  | "Contacted"
  | "Waiting on Response"
  | "Tour Scheduled"
  | "Tour Completed"
  | "Joined"
  | "Nurture"
  | "Lost Lead";

const CRM_STATUSES: CrmStatus[] = [
  "New Lead",
  "Contacted",
  "Waiting on Response",
  "Tour Scheduled",
  "Tour Completed",
  "Joined",
  "Nurture",
  "Lost Lead",
];
const PRIMARY_GOALS = [
  "Lose Weight",
  "Build Muscle",
  "General Fitness",
  "Athlete Performance",
  "Injury Recovery",
  "Improve Health",
  "Other",
];
export type Referral = {
  id: string;
  referral_code: string;
  referrer_name: string;
  referrer_email: string | null;
  referrer_contact: string | null;
  normalized_referrer_email: string | null;
  friend_name: string;
  friend_email: string | null;
  friend_contact: string | null;
  status: string;
  email_sent: boolean;
  email_sent_at: string | null;
  email_status: "pending" | "sent" | "failed";
  redeemed_at: string | null;
  redeemed_by: string | null;
  created_at: string;
  promo_type?: string | null;
  lead_id?: string | null;
  access_starts_at?: string | null;
  access_ends_at?: string | null;
  referrer_reward_status?: string | null;
};


export function AddLeadModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onCreated: (lead: any) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [primaryGoal, setPrimaryGoal] = useState("");
  const [message, setMessage] = useState("");
  const [crmStatus, setCrmStatus] = useState<CrmStatus>("New Lead");
  const [saving, setSaving] = useState(false);

  const sourceOptions = [
    "Website",
    "Walk-In",
    "Phone Call",
    "Google Business",
    "Facebook",
    "Instagram",
    "Referral",
    "Day Pass",
    "Other",
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!source) {
      toast.error("Lead source is required");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("leads")
      .insert({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        source,
        message: message.trim() || null,
        primary_goal: primaryGoal || null,
        crm_status: crmStatus,
        lead_type: "customer_lead",
        lead_score: 10,
        should_notify: false,
        interest: primaryGoal || null,
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error("Save failed: " + error.message);
      return;
    }
    onCreated(data);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-secondary"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-semibold">Add Lead</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manually log a phone call, walk-in, referral, or social media inquiry.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <AddLeadField label="Name" required>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            />
          </AddLeadField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AddLeadField label="Phone">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              />
            </AddLeadField>
            <AddLeadField label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              />
            </AddLeadField>
          </div>

          <AddLeadField label="Lead Source" required>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">Select a source…</option>
              {sourceOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </AddLeadField>

          <AddLeadField label="Primary Goal">
            <select
              value={primaryGoal}
              onChange={(e) => setPrimaryGoal(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">— None —</option>
              {PRIMARY_GOALS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </AddLeadField>

          <AddLeadField label="Original Inquiry / Notes">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </AddLeadField>

          <AddLeadField label="Status">
            <select
              value={crmStatus}
              onChange={(e) => setCrmStatus(e.target.value as CrmStatus)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              {CRM_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </AddLeadField>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-md border border-border px-4 text-sm hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddLeadField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      {children}
    </label>
  );
}


export function ReferralsView({ referrals }: { referrals: Referral[] | null }) {
  if (referrals === null) return <p className="mt-10 text-muted-foreground">Loading referrals…</p>;

  const total = referrals.length;
  const redeemed = referrals.filter((r) => r.status === "redeemed").length;
  const rate = total === 0 ? 0 : Math.round((redeemed / total) * 100);

  const groups = new Map<string, { name: string; count: number }>();
  for (const r of referrals) {
    if (r.status !== "redeemed") continue;
    const key =
      (r.normalized_referrer_email ?? r.referrer_email ?? "").trim().toLowerCase() ||
      `name:${r.referrer_name.trim().toLowerCase()}`;
    const existing = groups.get(key);
    if (existing) existing.count += 1;
    else groups.set(key, { name: r.referrer_name.trim(), count: 1 });
  }
  const leaderboard = Array.from(groups.values()).sort((a, b) => b.count - a.count);
  const topReferrer = leaderboard[0]?.name ?? "—";

  return (
    <div className="mt-8 space-y-10">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric label="Total Sent" value={String(total)} />
        <Metric label="Total Redeemed" value={String(redeemed)} />
        <Metric label="Redemption Rate" value={`${rate}%`} />
        <Metric label="Top Referrer" value={topReferrer} />
      </div>

      <div>
        <h2 className="text-xs tracking-[0.3em] text-primary">LEADERBOARD</h2>
        <h3 className="mt-2 text-2xl">Top Referrers (redeemed only)</h3>
        {leaderboard.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No redeemed referrals yet.</p>
        ) : (
          <div className="mt-4 rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs uppercase tracking-widest">
                <tr>
                  <th className="text-left px-4 py-3 w-16">#</th>
                  <th className="text-left px-4 py-3">Member</th>
                  <th className="text-right px-4 py-3">Redeemed</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row, i) => (
                  <tr key={row.name} className="border-t border-border">
                    <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold">{row.name}</td>
                    <td className="px-4 py-3 text-right font-bold text-primary">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xs tracking-[0.3em] text-primary">ALL REFERRALS</h2>
        <h3 className="mt-2 text-2xl">Referral History</h3>
        {referrals.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No referrals yet.</p>
        ) : (
          <div className="mt-4 rounded-lg border border-border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs uppercase tracking-widest">
                <tr>
                  <th className="text-left px-4 py-3">Referrer Name</th>
                  <th className="text-left px-4 py-3">Referrer Email</th>
                  <th className="text-left px-4 py-3">Friend Name</th>
                  <th className="text-left px-4 py-3">Friend Email</th>
                  <th className="text-left px-4 py-3">Code</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Email Status</th>
                  <th className="text-left px-4 py-3">Email Sent</th>
                  <th className="text-left px-4 py-3">Created</th>
                  <th className="text-left px-4 py-3">Redeemed</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r) => (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="px-4 py-3 font-semibold">{r.referrer_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.referrer_email ?? r.referrer_contact ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold">{r.friend_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.friend_email ?? r.friend_contact ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono">{r.referral_code}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          "inline-block rounded-full px-3 py-1 text-xs uppercase tracking-widest " +
                          (r.status === "redeemed"
                            ? "bg-primary/15 text-primary"
                            : "bg-secondary text-muted-foreground")
                        }
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <EmailStatusBadge status={r.email_status ?? "pending"} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {r.email_sent
                        ? r.email_sent_at
                          ? new Date(r.email_sent_at).toLocaleString()
                          : "Yes"
                        : "No"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {r.redeemed_at ? new Date(r.redeemed_at).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function EmailStatusBadge({ status }: { status: "pending" | "sent" | "failed" }) {
  const cls =
    status === "sent"
      ? "bg-primary/15 text-primary"
      : status === "failed"
        ? "bg-destructive/15 text-destructive"
        : "bg-secondary text-muted-foreground";
  return (
    <span
      className={"inline-block rounded-full px-3 py-1 text-xs uppercase tracking-widest " + cls}
    >
      {status}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

