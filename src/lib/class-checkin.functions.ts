import { createServerFn } from "@tanstack/react-start";
import { checkMemberMatch } from "@/lib/antaris/client";

type CheckInInput = {
  name: string;
  phone: string;
  class_name: string;
  class_day: string;
  class_time: string;
};

export const submitClassCheckIn = createServerFn({ method: "POST" })
  .inputValidator((data: CheckInInput) => data)
  .handler(async ({ data }) => {
    const name = data.name.trim();
    const phone = data.phone.trim();
    if (!name || !phone) {
      return { ok: false as const, error: "Name and phone are required." };
    }

    const match = await checkMemberMatch(name, "", phone);
    const verified = match.isMember && match.confidence >= 80;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("class_checkins").insert({
      name,
      phone,
      antaris_client_id: match.clientId,
      class_name: data.class_name,
      class_day: data.class_day,
      class_time: data.class_time,
      verified,
      added_manually: false,
    });

    if (error) {
      console.error("[class-checkin] insert failed", error);
      return { ok: false as const, error: "Could not save check-in. Please see the front desk." };
    }

    return { ok: true as const, verified };
  });
