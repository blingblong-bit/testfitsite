import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { SALES_RULEBOOK, LEAD_ID_PLACEHOLDER } from "@/lib/ai-reply-rules";
import { buildApprovedContext } from "@/lib/gym-facts";

export const Route = createFileRoute("/_authenticated/admin/ai-reply-rules")({
  head: () => ({
    meta: [
      { title: "AI Reply Rules — FIT Beyond Plus" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AiReplyRulesPage,
  errorComponent: () => (
    <div className="container-page py-16">Something went wrong loading this page.</div>
  ),
  notFoundComponent: () => <div className="container-page py-16">Not found.</div>,
});

function AiReplyRulesPage() {
  const displayRulebook = SALES_RULEBOOK.replaceAll(LEAD_ID_PLACEHOLDER, "[lead-id]");
  const approvedContext = buildApprovedContext();

  return (
    <section className="container-page py-12">
      <Link
        to="/staff-home"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Staff Portal
      </Link>

      <h1 className="mt-6 text-3xl">AI SMS Reply Rules</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        These are the exact instructions and the exact facts and prices the texting assistant
        receives before it answers anyone. Nothing outside the approved list below can be stated to a
        customer — anything else gets handed to a real person.
      </p>

      <h2 className="mt-10 text-xl">Approved facts &amp; pricing</h2>
      <div className="mt-3 max-w-3xl rounded-xl border border-border bg-card p-6 shadow-sm">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-card-foreground">
          {approvedContext}
        </pre>
      </div>

      <h2 className="mt-10 text-xl">Rulebook</h2>
      <div className="mt-3 max-w-3xl rounded-xl border border-border bg-card p-6 shadow-sm">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-card-foreground">
          {displayRulebook}
        </pre>
      </div>

      <p className="mt-6 max-w-3xl text-xs text-muted-foreground">
        Right-now questions about the gym itself (broken equipment, canceled class, lost item,
        cleanliness, "are you open") go straight to staff with no automated reply. So do complaints.
        After a staff member texts a lead, the assistant stays quiet on that conversation for several
        hours so you can handle it yourself.
      </p>
    </section>
  );
}
