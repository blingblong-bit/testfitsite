import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ClipboardList, LayoutDashboard, LogOut, CalendarCheck, Receipt, Newspaper } from "lucide-react";
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

      <div className="mt-12 grid md:grid-cols-3 gap-6 flex-1">
        <Link
          to="/frontdesk"
          className="group rounded-2xl border border-border bg-card p-8 flex flex-col justify-between min-h-[240px] hover:border-primary transition-colors"
          style={{ boxShadow: "var(--shadow-glow)" }}
        >
          <div>
            <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <LayoutDashboard className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-2xl">Front Desk</h2>
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
          className="group rounded-2xl border border-border bg-card p-8 flex flex-col justify-between min-h-[240px] hover:border-primary transition-colors"
        >
          <div>
            <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <ClipboardList className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-2xl">Lead Tracker</h2>
            <p className="mt-3 text-sm text-muted-foreground max-w-sm">
              Private admin dashboard. Website leads, day passes, referrals, and
              membership interest.
            </p>
          </div>
          <span className="mt-8 text-xs uppercase tracking-widest text-primary group-hover:translate-x-1 transition-transform">
            Open Lead Tracker →
          </span>
        </Link>

        <Link
          to="/admin/class-checkins"
          className="group rounded-2xl border border-border bg-card p-8 flex flex-col justify-between min-h-[240px] hover:border-primary transition-colors"
        >
          <div>
            <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <CalendarCheck className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-2xl">Class Check-Ins</h2>
            <p className="mt-3 text-sm text-muted-foreground max-w-sm">
              Today's class attendance, manual add, and cancellation management.
            </p>
          </div>
          <span className="mt-8 text-xs uppercase tracking-widest text-primary group-hover:translate-x-1 transition-transform">
            Open Class Check-Ins →
          </span>
        </Link>

        <Link
          to="/admin/day-pass-approvals"
          className="group rounded-2xl border border-border bg-card p-8 flex flex-col justify-between min-h-[240px] hover:border-primary transition-colors"
        >
          <div>
            <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <Receipt className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-2xl">Day Pass Approvals</h2>
            <p className="mt-3 text-sm text-muted-foreground max-w-sm">
              Confirm or decline "paid at desk" day pass requests waiting on staff.
            </p>
          </div>
          <span className="mt-8 text-xs uppercase tracking-widest text-primary group-hover:translate-x-1 transition-transform">
            Open Day Pass Approvals →
          </span>
        </Link>

        <Link
          to="/admin/blog"
          className="group rounded-2xl border border-border bg-card p-8 flex flex-col justify-between min-h-[240px] hover:border-primary transition-colors"
        >
          <div>
            <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <Newspaper className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-2xl">Blog</h2>
            <p className="mt-3 text-sm text-muted-foreground max-w-sm">
              Write, edit, and publish blog posts for the website.
            </p>
          </div>
          <span className="mt-8 text-xs uppercase tracking-widest text-primary group-hover:translate-x-1 transition-transform">
            Open Blog →
          </span>
        </Link>
      </div>
    </section>
  );
}
