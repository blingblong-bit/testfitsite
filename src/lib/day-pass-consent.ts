import { z } from "zod";

export const DayPassConsentSchema = z.object({
  waiver_accepted: z.literal(true, { error: "Please accept the liability waiver to continue." }),
  sms_consent: z.boolean({ error: "Please choose whether you would like to receive texts." }),
});

// A public check-in must never undo an existing STOP/opt-out.
export function dayPassTextPreferences(consent: boolean, alreadyOptedOut = false) {
  const optedOut = !consent || alreadyOptedOut;
  return {
    sms_opted_out: optedOut,
    ...(optedOut ? { sequence_status: "opted_out" } : {}),
  };
}