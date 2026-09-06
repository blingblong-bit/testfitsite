import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { RESPONSE_PLAYBOOK, LEAD_ID_PLACEHOLDER } from "@/lib/ai-reply-rules";

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
  const displayPlaybook = RESPONSE_PLAYBOOK.replaceAll(LEAD_ID_PLACEHOLDER, "[lead-id]");

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
        This is the exact response playbook Claude follows when replying to inbound texts. If a
        reply type isn't working, edit the wording here and it will be mirrored into the SMS
        handler.
      </p>

      <div className="mt-8 max-w-3xl rounded-xl border border-border bg-card p-6 shadow-sm">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-card-foreground">
          {displayPlaybook}
        </pre>
      </div>

      <p className="mt-6 max-w-3xl text-xs text-muted-foreground">
        Operational questions (equipment status, cancellations, lost items, etc.) are escalated to
        staff before the AI is ever called. Complaints and frustrated messages are also escalated
        with no auto-reply.
      </p>
    </section>
  );
}
