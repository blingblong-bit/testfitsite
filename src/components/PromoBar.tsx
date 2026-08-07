import { Link } from "@tanstack/react-router";
import { ArrowRight, Flame } from "lucide-react";

export function PromoBar() {
  return (
    <Link
      to="/claim-free-week"
      className="block border-b border-primary/40 bg-primary/15 text-center transition-colors hover:bg-primary/25"
    >
      <div className="container-page flex h-auto min-h-10 flex-wrap items-center justify-center gap-x-2 gap-y-0.5 py-2 text-[11px] font-semibold uppercase tracking-wide sm:text-xs">
        <Flame className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="text-primary">Free Week</span>
        <span className="hidden text-muted-foreground sm:inline">•</span>
        <span className="text-foreground/90">Refer a Friend &amp; Earn Another Week</span>
        <span className="hidden text-muted-foreground sm:inline">•</span>
        <span className="text-foreground/70">Ends Labor Day</span>
        <span className="inline-flex items-center gap-1 text-primary">
          Claim Yours <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}
