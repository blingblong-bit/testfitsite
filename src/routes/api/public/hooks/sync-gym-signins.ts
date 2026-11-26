import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Called every 10 minutes by the managed scheduler. Returns only counts.
export const Route = createFileRoute("/api/public/hooks/sync-gym-signins")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runSigninSync } = await import("@/lib/gym/signin-sync.server");
        try {
          const result = await runSigninSync(supabaseAdmin);
          return Response.json({ ok: true, ...result });
        } catch (e) {
          console.error("[sync-gym-signins] failed", e instanceof Error ? e.message : "unknown");
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
