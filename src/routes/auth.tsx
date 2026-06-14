import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Staff Sign In — FIT Beyond Plus" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/admin/leads" });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/admin/leads` },
        });
        if (error) throw error;
      }
      navigate({ to: "/admin/leads" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="container-page py-20 max-w-md">
      <h1 className="text-3xl">Staff Sign In</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Access the lead inbox. Staff access only.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div>
          <label htmlFor="email" className="block text-xs uppercase tracking-widest mb-2">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-11 rounded-md bg-secondary border border-border px-3 text-sm focus:outline-none focus:border-primary"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-xs uppercase tracking-widest mb-2">Password</label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-11 rounded-md bg-secondary border border-border px-3 text-sm focus:outline-none focus:border-primary"
          />
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-12 items-center rounded-md bg-primary px-6 text-sm font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-60"
          style={{ boxShadow: "var(--shadow-glow)" }}
        >
          {loading ? "Please wait..." : mode === "signin" ? "Sign In" : "Create Account"}
        </button>

        <button
          type="button"
          onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}
          className="block text-sm text-muted-foreground hover:text-primary"
        >
          {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </button>
      </form>

      <p className="mt-8 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-primary">← Back to site</Link>
      </p>
    </section>
  );
}
