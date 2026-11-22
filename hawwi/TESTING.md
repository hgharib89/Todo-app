# Hawwi QA report

Automated end-to-end run with Playwright (Chromium) at a 390×844 viewport, timezone `Asia/Dubai`. The clock was fixed to Saturday 14:00 using `clock.install`, and `fastForward` was used for order timers. Every page was checked for `console.error` and `pageerror`. The whole plan runs once in Arabic and once in English, then a separate robustness suite and a late-night scenario run. The test scripts and screenshots live outside the repo, in a scratch directory.

Final result: **1,197 checks, 0 failures, 0 console errors or page errors.** That is 503 checks in Arabic, 505 in English, 170 for robustness and 19 for late night.

Every screen of the run gets four automatic checks: no untranslated `a.b.c` keys, no `undefined`, `NaN` or `{placeholder}`, no text in the other language, and no element sticking out of the frame. Each screen was also screenshotted in AR and EN and reviewed by eye.

## Checklist

| Area | What was tested | Result |
|---|---|---|
| First run | Splash → onboarding. Next button, dots, mouse drag and touch swipe, in both RTL and LTR directions. The language link, Get started and Skip. Onboarding never shows again after it is finished. | Pass |
| Login / OTP / name | Button stays disabled under 9 digits. Bad UAE prefix shows an error. Leading 0 is stripped and Arabic-Indic digits are normalised. 3 digits do not submit. `0000` shows the error and clears the boxes. Backspace moves to the previous box. Any 4 digits pass. Name and email validation. Return to the intended route after login. A returning phone logs straight in. | Pass |
| Home | Greeting by time of day plus first name. Nearby list sorted open-first, then by rating. Search results. Arabic normalisation (ة/ه). The no-results empty state and Clear filters. Category chips (home and search). Open-now filter and price sort. Emirate and area picker, which persists. The "no businesses" empty state. Carousel dots follow scrolling. Featured and nearby cards open the business. | Pass |
| Business | Open, closed (with next opening) and closing-soon badges, including b03 after midnight. 7-day hours list starting Saturday, with today in bold. Product grid, section chips and sold-out overlay. Reviews with translate. About tab. The `/reviews` deep link. The favourite survives a reload. | Pass |
| Product | Required pill and default choice. Option and add-on deltas update the price live. Add-on max is enforced. Quantity 1–20. Notes counter. Sold-out and closed-business states. Cart badge. Adding from another business shows the new-cart modal (Cancel and Confirm). | Pass |
| Cart | Quantity changes. Trash and stepper-to-0 removal, both with Undo. Pickup vs delivery fee. Delivery minimum blocks checkout. ASAP estimate is prep time + 15 min for delivery. Today slots run from now + prep rounded up to the half hour until close − 30 min. Tomorrow slots. Slot choice survives a reload. Late-night after-midnight slots. Promo codes: invalid, WELCOME15 minimum, FREEDEL delivery-only and its auto-removal, HAWWI10 maths (45 + 10 − 4.50 = 50.50). | Pass |
| Checkout | Address required fields with focus moving to the first invalid field. Cross-emirate warning. Card grouping, Visa detection, Luhn, expiry and CVV checks. `4000…0002` is declined and no order is created. Only last4 is stored. Apple Pay sheet with its check animation. Cash, which is disabled above 500 AED. Order number starts at HW-1085. Cart is cleared after the order. | Pass |
| Tracking | Status goes received → preparing (8 s) → ready (20 s) → completed (15 s), including across reloads. Progress width transition, stripe shimmer, emoji and step-pulse animations are running. Status toast appears when on another screen. Cancel works while received. Rate card leads to a saved review. | Pass |
| Orders / favourites / profile | Active and Past tabs. Seed orders are hidden from the user. Reorder respects the one-business modal and shows a toast for unavailable items. Unfavourite with Undo. Profile edit, addresses sheet, help modal. | Pass |
| Settings | Language switch flips `dir`, `lang` and the title, and every string changes. Dark, light and auto themes (dark also checked on home, business, product and orders). Notifications toggle. Log out keeps orders. Reset keeps only the language and onboarding flag. | Pass |
| Owner mode | Dashboard today count, revenue, pending, rating and 7-day bars match the order data (oldest bar at the start edge). New tab is FIFO. Accept, ready, complete and reject (with reason) show up on the customer tracking screen within 1 s, in the same tab and in a second tab. Masked phone. Product add, edit (with a discard confirm), hide, sold-out and delete (Cancel and Confirm) all show up in the customer view. Shop profile and hours persist after a reload. Badges follow the new hours (closing soon, closed day). After-midnight hint. Equal open and close times are rejected. Paused shop blocks checkout. Owner routes are guarded. | Pass |
| Robustness | localStorage methods throwing, and the `window.localStorage` getter throwing, both fall back to memory. Corrupted JSON and wrong shapes in every key fall back gracefully with a one-time toast and a console warning. Deep link plus reload for every route, with owner mode off and on, plus unknown IDs. Browser back and forward. In-app back with no history. No horizontal overflow at 360 px in AR and EN. Very long business, product, area, user names and notes. HTML in product names, order notes and reject reasons is shown as text and never runs. | Pass |

## Bugs found and fixed

1. **Search bar overflowed the frame.** Once a query was typed, the page was 400 px wide inside a 390 px frame. Fixed: `min-width: 0` on `.search-field`.
2. **Popular searches never appeared for logged-in users.** The emirate dropdown's default (the user's emirate) was treated as an active filter. Fixed: the emirate no longer counts as a filter, and the list below the chips still follows it.
3. **Phone error stayed visible** while the user typed a corrected number. It now clears on input.
4. **The Undo toast could be hidden for up to 4 s** behind an older toast, such as "Added to cart". Fixed: a newer toast now shortens the current one to about 1.2 s. The toast action button is now 44 px tall.
5. **Rejection reasons showed both languages** ("مشغولين حالياً / Too busy") on the tracking and owner screens. Fixed: preset reasons are stored with a key and shown in the current language. Custom text is shown as typed.
6. **Saving a product in the owner form went back to the previous page** (for example the orders page) instead of the product list. Fixed: a new `H.backTo()` returns to the list.
7. **After-midnight slots were missing.** Just after midnight, the remaining slots of last night's opening (for example 16:00–03:00) were not offered as "Today". Fixed: they are now included, and slot `date` is now the real calendar date of the slot.
8. **Corrupted overrides crashed the product page** (`groups.forEach is not a function`). Fixed: business and product overrides, custom products, orders, reviews and cart lines are now shape-checked before use.
9. **Long names broke the layout.** The product grid columns and text overflowed the frame (up to 1,205 px wide), and headings were cut off. Fixed: `minmax(0, 1fr)` grids and `overflow-wrap` on names, notes, links and meta text.
10. **Owner emoji grid overflowed at 360 px.** It was a fixed 8-column grid. It is now `auto-fill`, with 44 px targets.
11. **The product type select was labelled "Group name".** It is now "Choice type" / "نوع الاختيار".
12. **Stale validation errors** stayed visible on the owner product, owner shop and checkout card fields after they were corrected. They now clear on input.
13. **Owner product rows wrapped the delete button** onto its own line. Edit and delete are now grouped together.
14. **Day names in the hours editor** broke mid-word ("Wednesda/y") and the switches were misaligned. The day column now has a minimum width.
15. **English plurals read "1 items" and "1 reviews".** A singular form was added for counts of 1, in AR and EN.
16. **Text in RTL mixed content was reordered.** "#HW-1086" was flipped in Arabic owner toasts, and order notes with Latin text were reordered. Fixed with bidi isolation (LRI/PDI and `<bdi>`).
17. **Closed badge read "opens Today 4:00 PM"** in English. It now reads "opens today 4:00 PM".
18. **Focus ring on route-change headings and stale screen-reader text.** The heading that gets programmatic focus showed a focus ring, and the live region kept the old language after a language switch. Both fixed.
19. **Dark mode: the selected segment** could barely be told apart from the track. It now has a lighter fill.

## Known limitations

- The `<input type="time">` fields in the owner hours editor use the browser's own locale format, so they may show "11:00 AM" in the Arabic UI. The spec asks for this native control, and the rest of the app formats times itself.
- The onboarding and carousel touch swipe relies on native scroll-snap. It was verified with simulated CDP touch events in Chromium only, not on real iOS or Android devices.
- An owner order card's exit animation is a quick fade. The "slide in with highlight" for new incoming orders was not checked automatically.
- `#/category/<unknown>` shows search with no category filter, not a "not found" state. The spec only defines not-found for business, product and order IDs.
- The language-switch link sits at the start edge of onboarding, as in the spec's annotation. The spec's ASCII wireframe draws it at the other edge.
- Only Chromium was tested. Firefox and Safari were not.
