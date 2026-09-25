# Day pass QR code: "needs a business profile" error

## What we found

The error doesn't come from our website. No page on the site uses the words "business profile," and nothing on the day pass page asks anyone to sign in. That message comes from **Venmo**.

The day pass page shows a Venmo QR code and a "Pay on Venmo: @Philip-Hill-11" link. Both lead to a **personal** Venmo account. Venmo now blocks or flags payments to personal accounts when the payment looks like a purchase from a business, for example when the payer marks it "Goods & Services" or scans from a business setting. The payer then gets a message saying the recipient needs a Venmo business profile. Some phones also make people sign in to Venmo in the browser first, which can show a similar message.

So the page is working. It's the Venmo account that can't take this kind of payment.

## Fix options

1. **Recommended: create a Venmo Business profile for FIT Beyond Plus.** It's free to set up inside the Venmo app and has a small fee per payment. Then send me the new @handle and its QR code, and I'll swap them onto the day pass page and the front desk screen.
2. **Short-term fallback: point guests to the front desk.** Until the business profile exists, the page would make "Pay at the front desk" the main choice and show a note that Venmo is temporarily unavailable. Staff approvals keep working as they do now.
3. Leave it as is and tell guests to send the money as "Friends & Family." This goes against Venmo's rules for businesses, and they can limit the account, so I don't recommend it.

## What I'd change once you pick an option

- Option 1: replace the Venmo QR image, the link, and the "@Philip-Hill-11" text in the day pass payment step. Nothing else changes.
- Option 2: make "Pay at the front desk" the default payment choice and add the note.

## Technical notes

- The Venmo QR image, link, and "@Philip-Hill-11" text all live in `src/components/kiosk-screens.tsx` (around lines 396–415). The same part of the page is used on `/day-pass` and on the front desk screen.
- No changes to the backend or the database.
