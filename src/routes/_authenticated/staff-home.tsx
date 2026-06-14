import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ClipboardList, LayoutDashboard, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/staff-home")({
  head: () => ({
    meta: [
      { title: "Staff Portal — FIT Beyond Plus" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StaffHome,
});

function StaffHome() {
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/admin/login" });
  }

  return (
    <section className="container-page py-16 min-h-[80vh] flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs tracking-[0.3em] text-primary">STAFF PORTAL</p>
          <h1 className="mt-2 text-3xl md:text-4xl">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">Choose where you want to go.</p>
        </div>
        <button
          onClick={signOut}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm hover:bg-secondary"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>

      <div className="mt-12 grid md:grid-cols-2 gap-6 flex-1">
        <Link
          to="/frontdesk"
          className="group rounded-2xl border border-border bg-card p-10 flex flex-col justify-between min-h-[280px] hover:border-primary transition-colors"
          style={{ boxShadow: "var(--shadow-glow)" }}
        >
          <div>
            <div className="h-14 w-14 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <LayoutDashboard className="h-7 w-7" />
            </div>
            <h2 className="mt-6 text-3xl md:text-4xl">Front Desk</h2>
            <p className="mt-3 text-sm text-muted-foreground max-w-sm">
              iPad-friendly kiosk for the front counter. Pricing, schedule, day pass,
              referrals, and reviews.
            </p>
          </div>
          <span className="mt-8 text-xs uppercase tracking-widest text-primary group-hover:translate-x-1 transition-transform">
            Open Front Desk →
          </span>
        </Link>

        <Link
          to="/admin/leads"
          className="group rounded-2xl border border-border bg-card p-10 flex flex-col justify-between min-h-[280px] hover:border-primary transition-colors"
        >
          <div>
            <div className="h-14 w-14 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <ClipboardList className="h-7 w-7" />
            </div>
            <h2 className="mt-6 text-3xl md:text-4xl">Lead Tracker</h2>
            <p className="mt-3 text-sm text-muted-foreground max-w-sm">
              Private admin dashboard. Website leads, day passes, referrals, and
              membership interest.
            </p>
          </div>
          <span className="mt-8 text-xs uppercase tracking-widest text-primary group-hover:translate-x-1 transition-transform">
            Open Lead Tracker →
          </span>
        </Link>
      </div>
    </section>
  );
}
