import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { Kanban, ClipboardList, Home } from "lucide-react";
import { ContactDrawer } from "@/components/crm/ContactDrawer";

export const Route = createFileRoute("/_authenticated/crm")({
  validateSearch: (s: Record<string, unknown>): { contact?: string } =>
    typeof s.contact === "string" && s.contact ? { contact: s.contact } : {},
  head: () => ({
    meta: [
      { title: "FIT CRM — FIT Beyond Plus" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CrmLayout,
});

const nav = [
  { to: "/crm/opportunities", label: "Opportunities", icon: Kanban },
] as const;

function CrmLayout() {
  const { contact } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[80vh] flex-col md:flex-row">
      <aside className="md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-border bg-card/40">
        <div className="hidden md:block px-5 py-6">
          <p className="text-xs tracking-[0.3em] text-primary">FIT CRM</p>
        </div>
        <nav className="flex md:flex-col gap-1 px-2 py-2 md:py-0 overflow-x-auto">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground whitespace-nowrap"
              activeProps={{ className: "bg-primary/15 text-primary" }}
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
          <div className="hidden md:block my-3 border-t border-border" />
          <Link to="/admin/leads" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary whitespace-nowrap">
            <ClipboardList className="h-4 w-4" /> Lead Tracker
          </Link>
          <Link to="/staff-home" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary whitespace-nowrap">
            <Home className="h-4 w-4" /> Staff home
          </Link>
        </nav>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
      <ContactDrawer
        contactId={contact ?? null}
        onClose={() => navigate({ to: ".", search: (p: Record<string, unknown>) => ({ ...p, contact: undefined }) })}
      />
    </div>
  );
}
