# Marketing Attribution: Website → Lead → CRM → Analytics

## What I found (verified by reading the code)

**Source tracking today.** Every lead-creating path passes a hard-coded `source` string into `submitLead` / `insertOrUpdateLead`: `general_contact`, `combat_sports`, `schedule_visit`, `free_week_referrer`, `referral_free_week`, `referral_day_pass`, `day_pass_walkin`, `missed_call`, `calendly`, `MCP`, plus whatever staff type in the Add Lead form. `src/lib/analytics.ts` `classifySource()` maps those strings by keyword into the 8 display buckets (Website, Walk-In, Phone Call, Google Business, Social Media, Referral, Day Pass, Other). There is **no UTM capture anywhere** — nothing reads `window.location.search`, and `leads` has no UTM/landing-page columns. So "Google Business" and "Social Media" can only ever match if someone hand-types those words into the source field.

**Analytics boxes using real data:** Website / Walk-In / Phone Call / Referral leads, Day Passes Sold, Tours Scheduled, Tours Completed, New Members Joined, Membership Conversion, MoM changes, funnel, source breakdown, first-contact timings, referral leaderboard.

**Placeholders (`notTracked`):** Google Business Leads, Social Media Leads, PT Referrals → Gym, Gym Referrals → PT, Google Reviews Received. The first two are placeholders only because the data does not exist yet — this plan makes them real.

**Day Pass:** a real intake exists. `/day-pass` renders `DayPassScreen`, and `processDayPassCheckin` creates/updates a lead with `source: "day_pass_walkin"`, price, payment method and status. Nothing new needs building — it just needs attribution passed through, and it must not overwrite an earlier first touch.

**PT → Gym / Gym → PT:** nothing exists. `leads` has no business-line field and `referrals` has no notion of which side of the business the referrer/friend belongs to. These stay Not Yet Tracked; smallest future fix noted below.

**Schema changes required:** yes — new attribution columns on `leads` (nothing existing is changed or dropped).

## What gets built

### 1. Attribution capture (browser, first-touch, persistent)

A small `src/lib/attribution.ts`:
- On every page load, read `utm_source/medium/campaign/content/term` from the URL. If any exist **and no first touch is stored yet**, store a record in `localStorage` (key `fbp_first_touch`) with the UTMs, `landing_page` (pathname only), `initial_referrer` (`document.referrer` hostname only), and a timestamp.
- If no UTMs are present and no first touch is stored, record landing page + referrer host **only** — no channel is inferred, nothing is labeled "organic". Channel derivation then falls back entirely to existing source logic. A channel is only asserted when there is positive evidence (UTMs, or a flow whose source already means something specific like referral/walk-in/day pass).
- Once written, it is **never overwritten** — later tagged visits, referral links, and tour bookings all leave it alone.
- Only these fields are stored; no PII, no full URLs with query strings, no cookies.
- A tiny `useFirstTouch()` / `getFirstTouch()` accessor used by forms.

### 2. Channel derivation (one shared definition)

`deriveChannel(firstTouch, source)` in `src/lib/analytics.ts` — the single source of truth, used by both CRM cards and analytics:

| Signal | Channel |
| --- | --- |
| `utm_medium` contains `paid_social` / `cpc` / `paid` | Paid Social (platform from `utm_source`: Facebook, Instagram, TikTok) |
| `utm_medium` contains `organic_social` | Organic Social (+ platform) |
| `utm_source` = `google_business` (any medium) | Google Business |
| other UTMs present | Website (campaign retained) |
| no UTMs | no channel asserted — fall back to existing `classifySource(source)`, unchanged behavior |

Existing bucket names and filters keep working; Paid Social / Organic Social are added as refinements of Social Media, and legacy leads keep their current bucket.

### 3. Attribution attaches to the lead

`LeadInput` gains an optional `attribution` object. `submitLead` reads first touch from the browser and passes it through; the contact form, combat form, schedule-visit, free-week claim, and the day-pass screen all flow through this. Referral/free-week server paths accept the same optional object.

`insertOrUpdateLead` writes attribution **only on INSERT**. On the update branch (repeat submitter) attribution columns are left untouched — that plus a DB-level `COALESCE`-style guard means first touch can never be overwritten by a later form, a referral event, a day pass, or a tour booking. Referral data stays in its own existing `referrals` table and `referral_code`/`referred_by` columns, fully separate from acquisition.

### 4. CRM lead card

Expanded card only: an `ACQUISITION` block showing First Touch (channel), Platform, Campaign, Creative, Landing Page — rendered only when attribution exists, with Title-Cased labels (`free_week_aug2026` → "Free Week Aug 2026"). Collapsed card is unchanged. Leads without attribution show their existing source exactly as today.

### 5. Business Analytics

- "Google Business Leads" and "Social Media Leads" become real counts from derived channels (Social Media split into Paid / Organic sub-counts).
- New **Acquisition by Channel** table: Website, Google Business, Paid Social, Organic Social, Referral, Walk-In, Phone Call, Day Pass, Other — each with Leads, Tours Scheduled, Tours Completed, Members Joined, Lead → Member %. Paid Social and Organic Social rows expand to Platform → Campaign → Creative.
- New **Campaign Performance** table keyed on `utm_campaign`: Leads, Tours Scheduled, Tours Completed, Members, Conversion %, expandable by `utm_content` creative. No cost, revenue, ROAS, CAC or profitability anywhere.
- Rows with only legacy source data are labeled as general attribution so they are never confused with measured campaign data.
- PT → Gym, Gym → PT, Google Reviews stay `Not Yet Tracked`.

### 6. Not changed

Lead Tracker behavior, automated/manual SMS, sequences, appointments, free-week claim + referrals + rewards, re-engagement, conversion tracking, source filters, staff notifications, manual Add Lead (never requires UTMs).

## Technical notes

Migration on `public.leads`, all nullable, no defaults, no backfill:
`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `landing_page`, `initial_referrer`, `attribution_channel`, `first_touch_at`. Existing INSERT RLS policy keeps working (it constrains other columns only); update the anon insert policy to bound the new text lengths. Index on `(utm_campaign)` for the campaign table.

Historical leads get nothing — no guessing. `attribution_channel` is stored at insert time as the derived channel so analytics stays stable even if derivation rules evolve.

## Edge cases found

- Repeat submitter hits the update branch → attribution intentionally skipped (first touch wins).
- Free-week "refer a friend" creates two leads (referrer + friend); each gets its own first touch from its own browser, so a friend arriving by SMS link is Referral while the referrer keeps Meta Paid.
- `checkExistingMemberSubmission` short-circuits before `insertOrUpdateLead` for known members — attribution is passed there too so member re-inquiries still record it.
- Server-created leads (missed call, Calendly webhook, MCP, staff manual) have no browser context → no UTMs, existing source classification applies.
- Facebook/Instagram in-app browsers can wipe `localStorage` between sessions; first touch is captured on the landing hit, so the ad → form flow is safe.
- `utm_medium=organic` + `utm_source=google_business` must resolve to Google Business, not Organic Social — handled by checking source before medium.

## Smallest future work (documented, not built)

- **PT ↔ Gym referrals:** add a `business_line` (`gym` | `pt`) to `leads` and a `referrer_business_line` to `referrals`; the two placeholder counts then become simple cross-line queries.
- **Google Reviews:** needs a Google Business Profile API pull or a manual monthly entry.
- **Ad spend / ROAS:** needs a campaign-cost table plus real membership revenue, which lives in Anteris today.

## Test plan (after implementation)

- **A — Paid Meta:** `/claim-free-week?utm_source=facebook&utm_medium=paid_social&utm_campaign=free_week_aug2026&utm_content=still_image_v1`, submit → card shows Paid Social / Facebook / Free Week Aug 2026 / Still Image V1 / `/claim-free-week`; analytics counts under Paid Social → Facebook → campaign → creative.
- **B — Google Business:** `utm_source=google_business&utm_medium=organic` → Google Business channel, campaign retained, Google Business Leads count increments.
- **C — Organic Instagram:** `utm_source=instagram&utm_medium=organic_social` → Organic Social / Instagram, not Paid.
- **D — Direct:** no UTMs → Website, no campaign or creative shown.
- **E — Persistence:** tagged entry, browse two pages, submit from `/contact` → original first touch and original landing page intact.
- **F — Referral:** Meta-acquired lead refers a friend → referrer stays Paid Social, friend records separately, referral rows/rewards unaffected.
- **Regression:** submit contact form (SMS + emails fire), claim a free week (code sent), day-pass check-in, staff Add Lead with Walk-In, and confirm existing analytics numbers are unchanged for months with no attribution data.
