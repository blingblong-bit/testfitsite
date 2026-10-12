import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PhoneOutgoing, Phone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { startCrmCall } from "@/lib/crm/calls.functions";

const COOLDOWN_MS = 20_000;

export function CallFromFitButton({ contactId, opportunityId, phone, compact }: { contactId: string; opportunityId?: string | null; phone?: string | null; compact?: boolean }) {
  const start = useServerFn(startCrmCall);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const lock = useRef(false);

  async function call() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const r = await start({ data: { contactId, opportunityId: opportunityId ?? null } });
      if (r.ok) {
        const msg = `Calling your phone now — answer to connect with ${r.firstName}.`;
        setNotice(msg);
        toast.success(msg);
      } else {
        toast.error(r.message);
      }
    } catch {
      toast.error("Couldn't start the call. Try again or call personally.");
    }
    setTimeout(() => { lock.current = false; setBusy(false); setNotice(null); }, COOLDOWN_MS);
  }

  if (!phone) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Button size={compact ? "sm" : "default"} onClick={call} disabled={busy} aria-label="Call from FIT" title="Rings your phone, then connects using the FIT number" className={compact ? "h-8 px-2 text-xs" : "h-9"}>
        <PhoneOutgoing className="h-4 w-4" /> {busy ? "Calling…" : "Call from FIT"}
      </Button>
      <a href={`tel:${phone}`} title="Call personally from this device" aria-label="Call personally" className={`inline-flex items-center gap-1 rounded-md border border-border px-2 text-xs hover:bg-secondary ${compact ? "h-8" : "h-9"}`}>
        <Phone className="h-3.5 w-3.5" /> {compact ? "" : "Call personally"}
      </a>
      {notice && !compact && <span role="status" className="w-full text-xs text-primary">{notice}</span>}
    </span>
  );
}
