# Why "New Leads" shows 0

## What I found

The card counts leads whose CRM status is exactly `New Lead`. Right now **no lead in the database has that status** — the only customer-lead statuses present are Contacted (10), Joined (3), Tour Scheduled (1).

Reason: every new lead gets an automatic welcome text the instant it is created, and that automation immediately sets the lead's status to `Contacted`. So a lead is never "New" by the time you look at the tracker. The five most recent leads (Abby Thompson, Saul Antunez, Mackenzie Jones, Alysa Austell Burks, Kim Adcock) all follow this pattern.

A second smaller issue: one path in the free-week referral flow writes the status as `New` instead of `New Lead`, so those leads would not be counted either even if they weren't auto-texted.

## Proposed fix

Redefine the card so it means what staff expect: leads nobody has actually engaged with yet.

1. Rename the card to **Needs First Touch** and count customer leads where:
   - no human/staff contact has happened (`last_contacted_at` is empty), and
   - the lead has never replied (`last_response_at` is empty), and
   - status is not Joined / Lost Lead / Tour Scheduled.

   An automated welcome text alone will no longer disqualify a lead from this bucket.
2. Make the card's click-through filter use the same rule, so the list matches the number.
3. Normalize the stray `New` status to `New Lead` in the referral flow so statuses stay consistent going forward.

Nothing about the automated texting behavior changes — only how the tracker counts and labels this bucket.

## Technical notes

- `src/routes/_authenticated/admin.leads.tsx`: update the `newLeads` stat computation (~line 802), the `quickFilter === "new"` predicate (~line 750), and the `Stat` label (~line 826).
- `src/lib/referrals.ts` line 472: `crm_status: contacted ? "Contacted" : "New"` → `"New Lead"`.
- Optional one-time data cleanup: set existing `New` statuses (if any appear later) to `New Lead`.
