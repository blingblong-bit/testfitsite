import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import logo from "@/assets/logo.png";

const nav = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/memberships", label: "Memberships" },
  { to: "/personal-training", label: "Personal Training" },
  { to: "/classes", label: "Classes" },
  { to: "/combat-sports", label: "Combat Sports" },
  { to: "/facility", label: "Facility" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container-page flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <img src={logo} alt="FIT Beyond Plus" className="h-10 w-auto" />
        </Link>

        <nav className="hidden lg:flex items-center gap-7">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="text-sm font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
              activeOptions={{ exact: n.to === "/" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          <Link
            to="/contact"
            className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm font-semibold uppercase tracking-wide text-foreground transition-colors hover:bg-secondary"
          >
            Book a Tour
          </Link>
          <Link
            to="/memberships"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold uppercase tracking-wide text-primary-foreground transition-all hover:brightness-110"
            style={{ boxShadow: "var(--shadow-glow)" }}
          >
            Join the Gym
          </Link>
        </div>

        <button
          className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-md border border-border"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden border-t border-border bg-background">
          <div className="container-page py-4 flex flex-col gap-1">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="py-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
                activeProps={{ className: "py-2 text-sm font-semibold uppercase tracking-wide text-foreground" }}
                activeOptions={{ exact: n.to === "/" }}
              >
                {n.label}
              </Link>
            ))}
            <div className="mt-3 flex gap-2">
              <Link
                to="/contact"
                onClick={() => setOpen(false)}
                className="flex-1 inline-flex h-10 items-center justify-center rounded-md border border-border text-sm font-semibold uppercase"
              >
                Book a Tour
              </Link>
              <Link
                to="/memberships"
                onClick={() => setOpen(false)}
                className="flex-1 inline-flex h-10 items-center justify-center rounded-md bg-primary text-sm font-semibold uppercase text-primary-foreground"
              >
                Join the Gym
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
