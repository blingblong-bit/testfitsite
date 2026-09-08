# Test the new texting rules on all 15 sample messages

Replay the same 15 sample messages through the live texting assistant and report, for each one, both sides: what the customer would receive, and what you would receive.

## How the test runs

- The messages go through the deployed texting logic, not a preview of the rules, so what I report is what a real person would actually get.
- Test runs against a throwaway test contact, not a real lead, so nobody in your tracker gets a text and no real phone rings.
- No actual text is delivered to anyone. The assistant's decision and reply wording are captured, staff alerts are captured as text but not sent.
- Nothing in the tracker is modified: no statuses, no notes, no follow-up dates.

## The 15 samples

1. Membership pricing question
2. Week-pass buyer ("in town for a week")
3. "Do you have showers?"
4. "Can I come in today?"
5. "Can you do a cheaper rate?"
6. Cancellation request
7. Competitor objection ("Planet Fitness is cheaper")
8. Actual loss ("I already joined Planet Fitness")
9. Mixed signal ("Planet Fitness is cheaper but I still want to look")
10. "Is the sauna working today?" (should bypass the assistant entirely)
11. Week pass + showers in one message
12. Student discount request
13. "Can I pay tomorrow?"
14. "Just looking around"
15. "I want the monthly membership"

## What I report back for each

- The exact reply text the customer gets (or "no reply — sent straight to you")
- Whether you get a text, and the wording of it
- Whether it would tag them Ready To Buy, and the short note
- Any price/competitor concern or reason-they-left it would record
- A pass/fail against the rule it is meant to prove

At the end: a short list of anything that answered wrong, quoted a wrong price, escalated when it should have answered, or answered when it should have escalated — before changing anything.

## Technical notes

- Driver script under `/tmp` posts each sample to the deployed `twilio-inbound-sms` webhook shape with a test phone number, capturing the assistant's JSON contract (`reply`, `needs_human`, `reason`, `high_intent`, `high_intent_note`, `high_intent_bucket`, `objections`, `lost_reasons`, `likely_lost`) plus the composed staff alert.
- Test mode suppresses Twilio delivery and staff alert delivery; the test lead row and its `sms_conversation_log` rows are removed after the run.
- Sample 10 must never reach Claude — verified by `classifyInquiry` returning `operational` and `reply: null`.
- Staff-takeover suppression is verified separately: insert an outbound `from_ai = false` row for the test contact, then replay sample 1 and confirm no automated reply.
