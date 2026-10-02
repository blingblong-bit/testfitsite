# Why Daryl Dong never got an answer

## What happened (Oct 2, about 4:17 PM Chicago)
1. Daryl filled out the contact form and got the automatic welcome text. It was delivered.
2. 45 seconds later he wrote back: "Any other fees beside the 39 a month?"
3. No reply went out. The system decided a staff member was already texting him by hand, so it held back the automatic answer and sent staff an alert ("You're handling this one").

No staff member had actually texted him. The bug: the system decides "staff is handling this" by looking for any recent text that wasn't written by the AI. The automatic welcome text counts as one of those, so whenever a lead replies within 4 hours of their first text, the auto-reply gets skipped.

So texting itself works fine. Daryl's question just never got answered automatically. **Someone should text him back now.** Note that his fee question should go to staff anyway, since the annual fee and contract details are something staff handle.

Daryl also has two lead records. The first form submission had a phone number that was one digit short (931999535). He submitted again 25 seconds later with the correct number.

## Fix
- Only treat a recent text as "staff is handling this" when a staff member actually sent it by hand from the lead card. Automatic welcome texts and follow-ups won't count.
- Remove the duplicate record with the short phone number, and keep the record with the correct number and the conversation.

## Technical notes
- In `supabase/functions/twilio-inbound-sms/index.ts`, the staff takeover query (around lines 695–703) matches on `direction=outbound` and `from_ai=false`. The initial automated send is logged with `from_ai=false` and `metadata.kind="initial"`. Add a filter for `metadata->>kind = 'manual'` (or `metadata->>sent_by = 'staff'`), then redeploy the function.
- Delete lead `55d1c4cb-a227-4b90-8838-5e68332cf95e`. It has no texts linked to it.
