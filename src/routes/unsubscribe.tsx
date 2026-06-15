import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/unsubscribe")({
  component: UnsubscribePage,
});

type State =
  | { kind: "loading" }
  | { kind: "ready"; email: string }
  | { kind: "already" }
  | { kind: "invalid"; message: string }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string };

function UnsubscribePage() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) {
      setState({ kind: "invalid", message: "Missing unsubscribe token." });
      return;
    }
    setToken(t);
    fetch(`/email/unsubscribe?token=${encodeURIComponent(t)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setState({
            kind: "invalid",
            message: body?.error || "Invalid or expired link.",
          });
          return;
        }
        if (body?.used_at) {
          setState({ kind: "already" });
          return;
        }
        setState({ kind: "ready", email: body?.email || "" });
      })
      .catch(() =>
        setState({ kind: "invalid", message: "Could not verify link." }),
      );
  }, []);

  const confirm = async () => {
    if (!token) return;
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setState({
          kind: "error",
          message: body?.error || "Could not unsubscribe.",
        });
        return;
      }
      setState({ kind: "success" });
    } catch {
      setState({ kind: "error", message: "Network error. Please try again." });
    }
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">Unsubscribe</h1>
        {state.kind === "loading" && (
          <p className="mt-4 text-sm text-muted-foreground">Verifying link…</p>
        )}
        {state.kind === "invalid" && (
          <p className="mt-4 text-sm text-destructive">{state.message}</p>
        )}
        {state.kind === "already" && (
          <p className="mt-4 text-sm text-muted-foreground">
            This email is already unsubscribed.
          </p>
        )}
        {state.kind === "ready" && (
          <>
            <p className="mt-4 text-sm text-muted-foreground">
              Unsubscribe {state.email ? <strong>{state.email}</strong> : "this address"} from FIT Beyond Plus emails?
            </p>
            <button
              onClick={confirm}
              className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Confirm unsubscribe
            </button>
          </>
        )}
        {state.kind === "submitting" && (
          <p className="mt-4 text-sm text-muted-foreground">Processing…</p>
        )}
        {state.kind === "success" && (
          <p className="mt-4 text-sm text-foreground">
            You've been unsubscribed. We're sorry to see you go.
          </p>
        )}
        {state.kind === "error" && (
          <p className="mt-4 text-sm text-destructive">{state.message}</p>
        )}
      </div>
    </div>
  );
}
