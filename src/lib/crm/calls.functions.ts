import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ contactId: z.string().uuid(), opportunityId: z.string().uuid().nullish() });

export const startCrmCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const [{ data: admin }, { data: staff }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "staff" }),
    ]);
    if (!admin && !staff) return { ok: false as const, error: "forbidden", message: "Only staff can place calls." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { startCallCore } = await import("./calls.server");
    return startCallCore(
      {
        db: supabaseAdmin, fetch,
        env: { sid: process.env.TWILIO_ACCOUNT_SID, token: process.env.TWILIO_AUTH_TOKEN, from: process.env.TWILIO_FROM_NUMBER, staff: process.env.LEAD_ALERT_PHONE },
      },
      { contactId: data.contactId, opportunityId: data.opportunityId ?? null, userId: context.userId },
    );
  });
