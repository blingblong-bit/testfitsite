# Free-week Antaris check: findings + one cleanup

## What I found

Both weeks are activated correctly in the app:

- **Seth Vaughn** — code AWAULNM5EW, checked in online, staff-confirmed 8/10 12:47pm CDT, access through 8/17.
- **AJ Valentin** — code 3CFFKX4H6U, staff-confirmed 8/10 8:25pm CDT, access through 8/18.

Neither is marked as a member, which is right.

**The Antaris free-week price check is working — and it is correct.** Seth's lead has four notes, one per sync run:

```text
Antaris record detected as free-week trial (not a paying conversion) — payment: $0.01, note: ''
```

So Seth does exist in Antaris as an Active membership record priced at **$0.01**, and the guard caught it: the sync refused to flip him to "Joined" and only left a note. The check treats any agreement with an initial or recurring amount of $0.01 or less, **or** a buyer note containing "free week", as a trial. Seth matched on the $0.01 price; his buyer note is empty. That is the correct behavior — a $0.01 agreement is the front-desk way of entering a free week, not a paying conversion.

AJ has **no** Antaris note yet. He was confirmed at 8:25pm CDT and the sync runs every 2 hours (last run 7:00pm CDT), so he simply hasn't been checked yet — or he hasn't been entered in Antaris. He'll be evaluated on the next run; if he was also entered at $0.01 he'll get the same trial note and stay unconverted.

## One thing worth fixing

The trial note is re-appended on **every** sync run, so Seth already has four identical lines and will keep collecting one every 2 hours for the whole week. That will bury his real history in the Lead Tracker.

Change: in the free-week branch of the sync, only write the note when the lead's notes don't already contain a free-week-trial line for the same detected amount. Everything else about the detection — the $0.01 threshold, the "free week" buyer-note match, skipping conversion — stays exactly as is.

## Technical notes

- File: `supabase/functions/antaris-member-sync/index.ts`, the `if (freeWeek)` block (~line 321). Add a guard comparing against the existing `lead.notes` before building the update, and skip the update entirely when a matching line is already present.
- No schema change, no change to conversion logic, rewards, or nudges.
- Optional: I can also strip the three duplicate lines already on Seth's record so his history reads cleanly.
