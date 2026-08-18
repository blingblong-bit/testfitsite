# Two fixes: New Leads members, and AI answering questions it shouldn't

## 1. "Member" showing in New Leads

Checked the live data against the current code: the New Leads bucket right now resolves to
exactly three people — Cairo Moore, Emma fulks, Abby Thompson — and none of them is a member
(no Joined status, no member flag, not an existing Antaris member). Luz Sanchez, who is flagged
as an existing member, is already excluded by the current logic.

So the member-in-New-Leads exclusion is working in the code, but the version you're looking at
is almost certainly the older published build — those changes went into the preview and the site
hasn't been republished since. Step one is to publish and re-check the tile. If a lead with the
green "Member" badge still shows up after that, send me the name and I'll trace that specific
record — the badge is driven by status "Joined", so a lead landing in both places would mean a
different cause than the one already fixed.

No code change planned for this item unless it reproduces on the fresh build.

## 2. Luz Sanchez — the AI should never have answered that

Her text: "the tanning bed door was open, but there's a sign that says it is temporarily out of
order… is the sign still in effect?" The AI answered with a soft "I don't have real-time info,
call the front desk" instead of handing it to you.

Two reasons it slipped through:

- She's flagged as an existing member, and the member-facing instructions are much shorter than
  the prospect ones — they have no "escalate when you can't confidently answer" rule at all.
- Even when the system does decide staff are needed, it still sends the AI's text if the AI wrote
  one. That's what produced the reply here.

### What changes

**Hard stop before the AI is even called.** Any inbound text that's asking about real-world,
right-now gym conditions gets no AI reply at all — it goes straight to you as a staff alert and
the lead is marked Waiting on Response. That covers: equipment or amenity status (tanning bed,
sauna, showers, machines), anything "out of order / broken / not working / fixed / open or
closed", class canceled/schedule-today questions, lost items, cleanliness or facility complaints,
and door/access/hours-right-now questions.

**Member conversations get the same escalation rules as prospects** — including "escalate if you
cannot confidently answer", frustration, price negotiation, requests to talk to a person, and
long threads.

**Escalation means silence.** When staff are alerted, the AI's draft is no longer texted to the
person. You reply yourself from the lead tracker. (Today it sends the draft and alerts you, which
is how Luz got a non-answer.)

### Technical notes

`supabase/functions/twilio-inbound-sms/index.ts`:
- add an `OPERATIONAL_PATTERNS` regex check on the inbound `body` before the Claude call; on match:
  update lead to `Waiting on Response` / `sequence_status: paused`, `sendStaffAlert(..., "operations")`
  with reason `operational_question`, log a `system` row with `metadata.kind = "operational_handoff"`,
  and return `twiml()` without sending anything.
- extend `memberPrompt` with the prospect prompt's `needs_human` escalation list and the
  "if your reply promises follow-up, set needs_human" rule.
- in the `needsHuman || promisedHandoff || !aiReply` branch (~line 632), always `return twiml()`
  instead of falling through to the send path; drop the "send it anyway" comment.

Redeploy of the inbound SMS function required. No database or Lead Tracker code changes.
