# Make the CRM the only place staff need to work

## Goal
Everything staff currently open the old Lead Tracker for is reachable directly inside the CRM, so there is no back-and-forth.

## What changes

### 1. See what a lead said, right away
- In the contact panel, add a clear **"What they submitted"** box at the top (above the tabs): their form message, interest, goal/preferred start if given, the form/page it came from, and the submission time (Chicago).
- If they submitted more than once, show each submission newest first (from their activity history), not just the latest.
- On opportunity tiles and the Contacts list, show a one-line preview of their message so staff can scan without opening anything.

### 2. Business Analytics inside the CRM
- New CRM menu item **Analytics** showing the same Business Analytics screen (month selector, sources, campaigns, conversions) — same numbers as today.

### 3. The other Lead Tracker tools inside the CRM
- New CRM menu items: **Referrals**, **Missed Calls**, and **Settings** (admin-only parts stay admin-only), using the same screens as today.
- **Add Contact** button in the CRM (Contacts page and top of the workspace) using the existing add-lead form, so manual leads can be entered without leaving.

### 4. Old Lead Tracker
- Stays available but moves to the bottom of the CRM menu, labeled "Old Lead Tracker (legacy)". Nothing in the CRM will send you there anymore.
- Scan the CRM for any remaining "do this in Lead Tracker" text or links and replace them with the CRM equivalent.

## Not changing
No customer records, stages, texts, automations, or reporting numbers change. Old tracker keeps working.

## Technical details
- Extract `ReferralsView`, `SettingsView`, `AddLeadModal` out of `admin.leads.tsx` into `src/components/` so both pages share them; `AnalyticsView`/`MissedCallsView` are already shared.
- New routes: `crm.analytics.tsx`, `crm.referrals.tsx`, `crm.missed-calls.tsx`, `crm.settings.tsx`, each loading leads/referrals the same way the tracker does (paginated), admin check unchanged.
- Submission history from `contact_activity` form/submission entries plus `leads.message`; message preview added to `boardQuery` and `contactLookupQuery` selects.
- Verify on desktop and phone: open today's new lead from the board and read the message without leaving; analytics totals match the old tracker for the same month.
