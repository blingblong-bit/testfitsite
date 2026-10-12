# Booked tours move the lead into the Tour section

## What happened with Sarah Kate
Her tour is booked and confirmed for Tue Oct 13 at 9:00 AM Chicago, and her reminder texts are set. Her sales card is still in **Attempting Contact**, though. Booking a tour saves the appointment but never moves the card to **Tour or Assessment Booked**, so this will happen to every tour booked in the CRM.

## What changes
1. **Booking moves the card.** When staff book a tour or confirm a website request, the person's open sales card moves to **Tour or Assessment Booked**, and the tour is linked to that card. This also happens when a lead books through their personal link and staff confirm it.
2. **No moving backwards or reopening.** The card moves only from an earlier stage: New Lead, Attempting Contact, Engaged or Long-Term Nurture. Cards already in Trial or Day Pass Active or Decision and Follow-Up stay where they are. Joined and lost cards are never touched.
3. **Rescheduling** keeps the card where it is and updates the link to the new tour.
4. **Canceling or marking completed** does not move the card. Staff decide the next stage, the same as today.
5. **No new texts.** Reminders work exactly as they do now.
6. **Fix Sarah Kate now.** Her card moves to Tour or Assessment Booked and links to her Oct 13 tour. Any other contact with a confirmed upcoming tour and an earlier-stage card gets the same fix. I'll list them for you.

## Technical details
- In `src/lib/appointments.functions.ts`, the staff booking, confirm and reschedule paths call a shared server helper after the appointment write. It uses `supabaseAdmin` and is staff-verified.
- The helper picks the contact's open opportunity, preferring the one whose interest matches the lead (otherwise the most recent). It updates `stage` and `status='open'` together, plus `appointment_id` and `last_activity_at`, so the stage/status trigger is respected. It runs only when the current stage is one of the earlier stages listed above.
- It writes one `contact_activity` entry: "Moved to Tour or Assessment Booked — tour booked", with idempotency key `tour_stage:<appointment_id>`.
- It never creates a new opportunity, and never touches won or lost ones.
- Backfill: a one-time migration for confirmed future tours whose open opportunity is still in an earlier stage. Sarah Kate's is opportunity `7fbea50b…`, appointment `219a8aa4…`.
- Add a test for the stage-eligibility rule to `src/lib/crm`.
