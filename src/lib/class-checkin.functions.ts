import { createServerFn } from "@tanstack/react-start";
import { checkMemberMatch } from "@/lib/antaris/client";

type CheckInInput = {
  name: string;
  phone: string;
  class_name: string;
  class_day: string;
  class_time: string;
};

function last10(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

function todayISOChicago(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export const submitClassCheckIn = createServerFn({ method: "POST" })
  .inputValidator((data: CheckInInput) => data)
  .handler(async ({ data }) => {
    const name = data.name.trim();
    const phone = data.phone.trim();
    if (!name || !phone) {
      return { ok: false as const, error: "Name and phone are required." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Prevent the same person from checking into the same class twice today.
    // We compare the last 10 digits of phone (normalized) against today's
    // check-ins for this class, rather than relying on a DB-level unique
    // constraint, since phone formatting can vary between submissions.
    const target = last10(phone);
    const today = todayISOChicago();
    const { data: existing, error: lookupError } = await supabaseAdmin
      .from("class_checkins")
      .select("phone, checked_in_at")
      .eq("class_name", data.class_name)
      .eq("class_day", data.class_day);

    if (lookupError) {
      console.error("[class-checkin] duplicate lookup failed", lookupError);
      // Fail open on the lookup itself (don't block a real check-in over a
      // read error) but still proceed to the normal insert below.
    } else if (existing) {
      const alreadyCheckedInToday = existing.some((row) => {
        if (last10(row.phone ?? "") !== target) return false;
        const rowDateChicago = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Chicago",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(row.checked_in_at));
        return rowDateChicago === today;
      });
      if (alreadyCheckedInToday) {
        return {
          ok: false as const,
          error: "You're already checked in for this class.",
        };
      }
    }

    const match = await checkMemberMatch(name, "", phone);
    const verified = match.isMember && match.confidence >= 80;

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
