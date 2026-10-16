import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Kanban, ClipboardList, Home, Users, ListTodo, LayoutDashboard, BarChart3, Gift, PhoneMissed, Plus } from "lucide-react";
import { AddLeadModal } from "@/components/crm/LeadTools";
import { ContactDrawer } from "@/components/crm/ContactDrawer";

export const Route = createFileRoute("/_authenticated/crm")({
  validateSearch: (s: Record<string, unknown>): { contact?: string; tab?: string } => ({
    ...(typeof s.contact === "string" && s.contact ? { contact: s.contact } : {}),
    ...(typeof s.tab === "string" ? { tab: s.tab } : {}),
  }),
  head: () => ({
    meta: [
      { title: "FIT CRM — FIT Beyond Plus" },
      { name: "description", content: "FIT Beyond Plus staff sales workspace and contact history." },
      { property: "og:title", content: "FIT CRM — FIT Beyond Plus" },
      { property: "og:description", content: "FIT Beyond Plus staff sales workspace and contact history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CrmLayout,
});

const nav = [
  { to: "/crm/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/crm/tasks", label: "Tasks", icon: ListTodo },
  { to: "/crm/opportunities", label: "Opportunities", icon: Kanban },
  { to: "/crm/contacts", label: "Contacts", icon: Users },
  { to: "/crm/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/crm/referrals", label: "Referrals", icon: Gift },
  { to: "/crm/missed-calls", label: "Missed Calls", icon: PhoneMissed },
] as const;

function CrmLayout() {
  const { contact, tab } = Route.useSearch();
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const [adding, setAdding] = useState(false);
  const qc = useQueryClient();
  return (
    <div className="flex min-h-[80vh] flex-col md:flex-row">
      <aside className="md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-border bg-card/40">
        <div className="hidden md:block px-5 py-6">
          <p className="text-xs tracking-[0.3em] text-primary">FIT CRM</p>
        </div>
        <nav className="flex md:flex-col gap-1 px-2 py-2 md:py-0 overflow-x-auto">
          <button onClick={() => setAdding(true)} className="flex items-center gap-3 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground whitespace-nowrap md:mb-2">
            <Plus className="h-4 w-4" /> Add Contact
          </button>
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
            <ClipboardList className="h-4 w-4" /> Old Lead Tracker (legacy)
          </Link>
          <Link to="/staff-home" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary whitespace-nowrap">
            <Home className="h-4 w-4" /> Staff home
          </Link>
        </nav>
      </aside>
      <section aria-label="CRM workspace" className="flex-1 min-w-0">
        <Outlet />
      </section>
      {adding && (
        <AddLeadModal
          onClose={() => setAdding(false)}
          onCreated={(lead: { id: string }) => {
            setAdding(false);
            toast.success("Contact added");
            qc.invalidateQueries({ queryKey: ["crm"] });
            navigate({ to: pathname, search: (p: Record<string, unknown>) => ({ ...p, contact: lead.id }) });
          }}
        />
      )}
      <ContactDrawer
        contactId={contact ?? null}
        initialTab={tab}
        onClose={() => navigate({ to: pathname, search: (p: Record<string, unknown>) => ({ ...p, contact: undefined, tab: undefined }) })}
      />
    </div>
  );
}
