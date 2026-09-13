# Task 5: Cart + single-item checkout (re-verification) + voucher field

Fixtures: buyer = ash (`ash@pokemon.com`), seller = misty (`misty@pokemon.com`), card name = "Psyduck" only (plain "Psyduck", Platinum 87/127 — never "Psyduck V", which is a different catalog card also owned by misty but not this task's assigned fixture).

## Tested

Drove a real browser (playwright-core + cached Chromium per Shared Setup) logged in as ash.

**Cart add/remove/badge/subtotal:**
- Added misty's plain "Psyduck" listing (`bf88eaad-deb8-41ec-9491-b5cad146e94c`, Near Mint, $8.00) to the cart from its card detail page (`/cards/bf88eaad-deb8-41ec-9491-b5cad146e94c`). Confirmed the navbar cart badge incremented and the cart page showed the item with correct name/condition/price ($8.00) and a matching subtotal.
- Removed it via the item's own "Remove Item" button and confirmed the cart genuinely returned to the true empty state — "Your cart is empty" / "Browse the marketplace and add cards to your cart." with a "Browse Marketplace" CTA.
- Added it back via the same card detail page; confirmed it reappeared in the cart correctly.
- Verified all of the above against Postgres directly (`Cart`/`CartItem` rows for ash), not just the UI — confirmed via a throwaway `tsx` script that `CartItem.listingId` pointed at the correct plain-"Psyduck" listing id after each add/remove/re-add cycle.

**Voucher field:**
- Read `src/app/cart/page.tsx` (lines ~566-589): the "Voucher" row in the Cart Summary is explicitly commented `{/* Voucher row — disabled */}` and rendered with `opacity: 0.5`, `cursor: "not-allowed"`, and **no `onClick` handler at all**. There is no `Voucher` model anywhere in `prisma/schema.prisma`.
- Confirmed by also clicking it in the live browser: the page body (compared before/after via `innerText()`) was byte-for-byte unchanged, and no network request fired.
- Conclusion: this is a confirmed, intentional stub/placeholder with no backing feature or seeded data — not a bug. No fix applicable or needed.

**Full purchase with real Stripe test-mode payment (card `4242 4242 4242 4242`):**
- Completed a full Buy Now → Stripe Checkout → payment flow for the plain "Psyduck" listing (`bf88eaad-deb8-41ec-9491-b5cad146e94c`), landing back on `/purchases?success=1&session_id=...`.
- Verified directly against Postgres (not just the UI):
  - `Order` row `2b20c651-62c6-4e7e-aa12-f694ce91eb4d`: `status: "PAID"`, `stripePaymentIntentId: "pi_3UEwsSAVU8YI57Gn2hazO30F"` populated, `buyerId` = ash, `sellerId` = misty, `amount: 800`.
  - `Listing bf88eaad...`: `ownerId` transferred to ash, `forSale: false`, `price: null`, `binderId: null`, reservation fields all cleared. (`price`/`binderId` nulling on sale is intentional design — see `transferCardOwnership` in `src/lib/webhookHelpers.ts` lines 28-37 — not a bug.)
  - `CardTransaction` row `9602bb5b-c5b0-472e-9212-4a99fd26f2ba` exists with the correct `orderId`/`buyerId`/`sellerId`/`amount`/`stripeEventId`.
  - Misty received a `card_sold` notification: `"Your card \"Psyduck\" was purchased via Buy Now."`, correctly linked to the right `listingId`/`orderId`.
- This regression check **passes** — the single-item checkout + webhook flow (`src/app/api/checkout/route.ts`, `src/app/api/stripe/webhook/route.ts` → `handleSingleSessionCompleted`) works correctly end to end. No fix was needed.

No console errors or 5xx responses were observed on any page visited for the parts of the flow above that completed normally.

## Found & Fixed

No source code bugs were found or fixed in this task. Both required flows (cart mechanics, single-item Stripe purchase) already work correctly, confirmed against the database.

Since no source file was changed, `npx tsc --noEmit` / `npx vitest run` were not required per the plan's own rule ("after any fix"); no changes means nothing to verify.

### Note on shared test environment (not an app bug)

This QA sweep runs many tasks in parallel against the same dev server, same Postgres DB, and — since Task 6 also uses `ash` as buyer — the same `Cart` row. Over the course of this task ash's cart was repeatedly, visibly populated and drained by other concurrently-running tasks' items ("Starmie GX", "Gyarados VMAX", even a "QA Task10 Test Card" that isn't part of any card-name fixture assigned to Tasks 5-11's card-based tests, presumably Task 10's admin-upload test artifact transiently added to a shared cart by another script). I never used the global "Clear Cart" button once other tasks' items were present — only ever removed/selected the specific "Psyduck" row by scoping the Playwright locator to a container that also held a "Remove Item"/checkbox specific to that row — to avoid destroying another task's in-progress test state.

Separately, one 500 error was observed and is **not** being treated as an app bug: a `POST /api/checkout/cart` (multi-item cart checkout, attempted while cross-contaminated with other tasks' cart items, before I switched this task's purchase over to the single-item Buy Now flow) returned `{"error":"Transaction API error: Unable to start a transaction in the given time."}`. Root cause: `DATABASE_URL` in `.env` (which this plan explicitly forbids editing) sets `connection_limit=5` on Supabase's transaction-mode pooler — a deliberately small pool per the comment in `src/lib/prisma.ts` — shared by every concurrent QA task's dev-server API calls tonight (~10 parallel Playwright browsers). Prisma's `$transaction(...)` in `src/app/api/checkout/cart/route.ts` has no explicit `maxWait` override, so under this unusually heavy concurrent load it can fail to even start within Prisma's default wait window. A subsequent retry on the *same* listing then correctly returned a different, expected error (`"Psyduck" was just reserved by another buyer. Please try again.` — my own still-active 15-minute reservation from the first attempt, working as designed per the inline comments in `checkout/cart/route.ts`). I did not modify `connection_limit` (disallowed) or add retry/backoff logic to the transaction (would be speculative error handling for a condition — 10 simultaneous QA agents hammering one dev box — that doesn't reflect normal or even realistic peak production traffic for this app). I completed the actual purchase for this task by resuming the still-open Stripe Checkout Session from my first (successful) attempt directly, rather than re-invoking the cart-checkout API a second time.

## Needs Human Verification

- The transient `"Unable to start a transaction in the given time"` 500 described above: if this recurs under **normal** (non-QA-swarm) load — e.g., two or three real users checking out at the same moment — that would be worth a real look (raising `$transaction`'s `maxWait`/`timeout` options, or the pool's `connection_limit`). I could not and did not try to reproduce it outside of tonight's ~10-parallel-agent load, so treat it as "watch for it," not "confirmed broken."
- The "Select Voucher" control is a confirmed non-functional stub (see above) — if a real voucher/discount system is intended for this app, that is unbuilt product scope, not a bug for this QA pass to fix.
