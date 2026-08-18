# Lead Tracker cleanup

## What changes

### 1. Remove the two header buttons
"Contacted Today" and "Lead Responded" come off every lead card. The fields they wrote
(last contacted / last response) are still set automatically by the SMS system and are still
shown in the card summary — you just won't have manual buttons for them anymore.

### 2. New Leads tile stops counting members
Right now the tile counts any lead with a live sequence, and clicking it shows the full list
including existing members. After the change, a lead drops out of New Leads as soon as it is
a member of any kind:

- marked as a member (Converted) or status Joined → out, regardless of sequence state
- flagged as an existing Antaris member (the "Member" badge) → never counted, and never shown
  when the tile is clicked
- Lost Lead → out

Everything else that is still being worked (open, contacted, tour scheduled/completed with a
live or pending sequence, or never touched) still counts as a New Lead, as you asked earlier.

Verified in the data: the tile's count already skips existing members, but the list you get
when you click the tile does not — that's the visible bug. Seth Vaughn is a member with a
still-"active" sequence, which is why members can appear to linger.

### 3. Converted moves the lead to the converted tile
The Converted button keeps everything it already does (member flag, Joined status,
start date, welcome text) and additionally ends the sequence so the lead immediately
leaves New Leads. The "Joined This Month" tile is renamed **Converted This Month** so
it reads as the destination for that button, and clicking Converted will switch the
view to that tile so you see the lead land there.

## Technical notes

`src/routes/_authenticated/admin.leads.tsx`:
- delete the `markContactedToday` / `markResponded` functions and their two buttons in the
  card header (~lines 1216–1322).
- `needsFirstTouch` (~line 280): return false when `lead_type === "existing_member"`, when
  `became_member`, or when `crm_status` is Joined / Lost Lead — before the sequence check.
- quick filter `"new"` (~line 789): also exclude `existing_member` rows so the list matches
  the count even when the type filter is "All".
- `markConverted` already sets `sequence_status: "completed"`; after it succeeds, set the
  quick filter to `joined_this_month`.
- rename the `Stat` label "Joined This Month" → "Converted This Month" (~line 874).

No database or automation changes.
