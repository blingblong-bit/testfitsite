# Split converted members out of the working lead list

## What I found

All six names you listed are already closed out in the data:

- Seth Vaughn, Saul Antunez, Alysa Austell Burks, Kim Adcock, Adam Mariano, Haleigh Woodcox — all marked as members with status Joined
- Haleigh V — spam, status Lost Lead

None of them are counted by the New Leads tile, and none of them show up when you click it. What you're seeing is the **main lead list** below the tiles, which mixes everyone together — converted members sit right alongside leads you still need to work. That's the part to fix.

## What changes

The lead list gets split into sections, in this order:

1. **Working leads** — everything still in play (open, contacted, tour scheduled/completed). Sorted exactly as it is today.
2. **Converted members** — anyone marked as a member or status Joined. Collapsed by default with a count in the header ("Converted Members (6)"), click to expand.
3. **Closed / not a fit** — Lost Lead, spam, vendor solicitations. Also collapsed by default.

Existing members detected from Antaris continue to live behind their own filter chip, unchanged.

Behavior kept intact:

- Search still searches everyone; a match inside a collapsed section auto-expands it so you can find Seth by name.
- Clicking a stat tile (New Leads, Converted This Month, etc.) shows a single flat list for that tile as it does now — no sectioning, since the tile already defines the bucket.
- All tile counts, sorting, and card actions stay the same.

## Technical notes

`src/routes/_authenticated/admin.leads.tsx`:

- Add a `listGroup(lead)` helper returning `working` | `converted` | `closed`, derived from the same predicates already in use (`became_member` / `crm_status === "Joined"` → converted; `Lost Lead`, `lead_type` of `spam`/`vendor_solicitation` → closed; else working).
- After the existing `sorted` memo, partition it into the three groups (order within each group preserved).
- Render each non-empty group under a collapsible section header; local `useState` per section for open/closed, defaulting converted and closed to collapsed. Force-open when `query` is non-empty or a `quickFilter` is active (in the quick-filter case, render the flat list as today).

No database, automation, or SMS changes.
