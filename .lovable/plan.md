# Beat the Holidays page update

Applies the uploaded changes to `/beat-the-holidays` only. Other pages, the CRM and texting setup stay the same.

## Changes
1. **Opening section:** remove the price. Keep the copy about the goal, coaching, personal support and starting before January. Change the main button to "Find my best fit" so it jumps to the form. Under the button, add: "Tell us your goal and what you're looking for. We'll help you choose the right way to get started." Below that, add a smaller link: "Looking for gym access or classes instead? Explore memberships and classes." It goes to the existing Memberships and Classes pages.
2. **Every main button** on the page changes to "Find my best fit" and leads to the form.
3. **New package section, placed just before the form:** the title "Beat the Holidays", the tagline "Your coach. Your plan. Support through the holidays.", the six included items, "$549 for the complete program", and a "Find my best fit" button.
4. **Price:** every mention of the price, including the page's search and share text, will read $549. Right now it says $550.
5. **Copy swaps:**
   - The line about limited spots and coach availability becomes "Send the short form below. A FIT team member will reach out…"
   - "No crash diets and no promised results" becomes "Practical training, realistic nutrition guidance, and personal support built around your goals and everyday life."
6. **Form:** remove "Best times to train". The form will ask for:
   - Name
   - Phone
   - Email (optional)
   - Main goal
   - "What kind of support interests you?" (optional). The choices are Coaching and accountability, Gym access, Classes or combat sports, and Help me decide.

   The text-message consent and privacy links stay as they are.

## Technical details
- All edits are in `src/routes/beat-the-holidays.tsx`.
- The submission still goes through the shared lead-form path with source `beat_the_holidays`, and the standard staff alert still fires.
- The support choice and goal are added to the submission message, so staff see them in the CRM. Interest stays "Personal Training" (the package is the main offer). The lead-form check recomputes the classification on the server, so these answers can't change it.
- Checks: the build passes and the page renders on desktop and phone. No real form will be submitted, so no text alerts go out.
