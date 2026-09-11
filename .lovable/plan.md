# Take Down the Free-Week Promotion

## Changes
- Remove the free-week announcement bar from the site header.
- Remove the free-week promotion section from the homepage.
- Disable the public claim page by redirecting visitors to the homepage.
- Keep all promotion files, artwork, claim logic, staff tools, and past records intact for future reuse.

## Technical details
- Remove only the public entry points and imports.
- Preserve the existing free-week route implementation behind a disabled flag so it can be restored quickly.
- Verify the homepage and old promotion URL after the change.
