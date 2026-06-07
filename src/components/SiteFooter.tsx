import { Link } from "@tanstack/react-router";
import { Instagram, Facebook, MapPin, Phone, Mail } from "lucide-react";
import logo from "@/assets/logo.png";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container-page py-14 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <img src={logo} alt="FIT Beyond Plus" className="h-12 w-auto" />
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            More than a gym. A serious training environment in Tullahoma, Tennessee — built for athletes, lifters, and anyone ready to put in the work.
          </p>
          <div className="mt-5 flex gap-3">
            <a href="#" aria-label="Instagram" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border hover:text-primary"><Instagram className="h-4 w-4" /></a>
            <a href="#" aria-label="Facebook" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border hover:text-primary"><Facebook className="h-4 w-4" /></a>
          </div>
        </div>

        <div>
          <h4 className="text-sm tracking-widest text-foreground">Explore</h4>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/about" className="hover:text-foreground">About</Link></li>
            <li><Link to="/memberships" className="hover:text-foreground">Memberships</Link></li>
            <li><Link to="/personal-training" className="hover:text-foreground">Personal Training</Link></li>
            <li><Link to="/classes" className="hover:text-foreground">Classes</Link></li>
            <li><Link to="/facility" className="hover:text-foreground">Facility</Link></li>
            <li><Link to="/contact" className="hover:text-foreground">Contact</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm tracking-widest text-foreground">Visit</h4>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2"><MapPin className="h-4 w-4 mt-0.5 text-primary" /> Tullahoma, Tennessee</li>
            <li className="flex gap-2"><Phone className="h-4 w-4 mt-0.5 text-primary" /> (931) 555-0123</li>
            <li className="flex gap-2"><Mail className="h-4 w-4 mt-0.5 text-primary" /> hello@fitbeyondplus.com</li>
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">Open daily · 24/7 member access</p>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container-page py-5 text-xs text-muted-foreground flex flex-col sm:flex-row justify-between gap-2">
          <span>© {new Date().getFullYear()} FIT Beyond Plus. All rights reserved.</span>
          <span>More Than A Gym.</span>
        </div>
      </div>
    </footer>
  );
}
