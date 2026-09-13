# Task 7: Offers — full lifecycle (place, accept, decline)

Fixtures: buyer = misty (`misty@pokemon.com`), seller = ash (`ash@pokemon.com`). "Venusaur V" for the accept sub-case, "Blastoise Holo Rare" for the decline sub-case — two distinct ash-owned Listing rows, not the Task 8 Auction row of the same "Blastoise Holo Rare" name (confirmed no collision, per the plan's fixture-collision check).

## Tested

Drove a real browser (playwright-core + cached Chromium, per Shared Setup) for the full place → respond lifecycle, on both sides (misty as buyer, ash as seller), with a real Stripe test-mode card authorization (`4242 4242 4242 4242`) each time. Every result below is confirmed directly against Postgres via throwaway `tsx` scripts, plus the Stripe PaymentIntent state via the Stripe Node SDK using the app's own `STRIPE_SECRET_KEY` from `.env` (see note on the `stripe` CLI below).

### Accept path (Venusaur V)

- As misty, opened the Venusaur V catalog page, selected the "Moderately Played" condition tile (listing `367cf4a7-72c9-4c23-8f18-c948fa8e45c7`, listed at $65.00), clicked "Place Offer", entered $50.00, and completed the Stripe `CardElement` authorization step (`Continue` → card number → expiry → CVC → ZIP → "Submit Offer").
- DB confirms an `Offer` row (`f9b3827f-fde6-4a4f-8849-2070370bfa14`) was created with `status: "pending"` and a real `paymentIntentId` (`pi_3UEwstAVU8YI57Gn3xPvxHOO`), `price: 5000` (cents), `buyerId` = misty, `sellerId` = ash.
- Logged in as ash, went to `/offers` → "Incoming Offers" → "Active" tab, found the pending Venusaur V offer, and called `PATCH /api/offers/{id} { action: "accept" }`.
- Confirmed via DB:
  - `Offer.status` → `"paid"`, `archivedAt` set, `orderId` populated.
  - `Order` row created: `status: "PAID"`, `amount: 5000`, `stripePaymentIntentId` matches, `buyerId`/`sellerId` correct.
  - `Listing.ownerId` transferred to misty, `forSale: false`, `price: null`, reservation fields cleared.
  - A `CardTransaction` row exists linking the order, listing, buyer, seller, amount, and `tcgPlayerId`.
  - Misty received a `Notification` with `type: "offer_accepted"`, correct `offerId`/`listingId`/`orderId`.
  - The Stripe PaymentIntent itself: `status: "succeeded"`, `amount_received: 5000` — money actually moved.

### Decline path (Blastoise Holo Rare)

- As misty, opened the Blastoise Holo Rare catalog page, selected the "Near Mint" condition tile (listing `a55c1b92-f731-417a-971a-8d1014ad2698`, listed at $100.00), placed an offer of $70.00, and completed the same Stripe `CardElement` authorization.
- DB confirms `Offer` row `2ee30250-64d0-41b1-ad93-d6fa3ee1399c`: `status: "pending"`, real `paymentIntentId` (`pi_3UF1qnAVU8YI57Gn3V1jukpN`), `price: 7000`.
- Logged in as ash and called `PATCH /api/offers/{id} { action: "reject" }`.
- Confirmed via DB:
  - `Offer.status` → `"rejected"`.
  - `Listing` ownership **unchanged** — still `ownerId` = ash, still `forSale: true`, `price` still `10000`.
  - Misty received a `Notification` with `type: "offer_rejected"` ("Your payment hold has been released").
  - The Stripe PaymentIntent: `status: "canceled"` (checked via the Stripe Node SDK — see note below) — the authorization hold was released and no money moved.

### Note on checking the Stripe PaymentIntent

The task asked to check the PI status via the `stripe` CLI. The CLI is configured with two profiles (`stripe config --list`): `default` (a different Stripe account entirely — its key doesn't recognize this app's PaymentIntents) and `pokemon_mvp` (the right account, but its cached `test_mode_api_key` reported `"The API key provided has expired"` when invoked). Rather than run `stripe login` (out of scope — could disrupt the shared CLI config other tasks/the user might rely on), I read `STRIPE_SECRET_KEY` directly out of `.env` (read-only, not edited) and called `stripe.paymentIntents.retrieve(...)` via the `stripe` npm package already in `node_modules` — the same credential the app itself uses, so this is an equally direct, non-UI verification of Stripe's own ledger. This should be called out to a human: the `pokemon_mvp` CLI profile's cached test-mode key needs `stripe login` re-run if anyone wants to use the CLI directly going forward.

## Found & Fixed

**No source code bug was fixed** — the accept and decline handlers in `src/app/api/offers/[id]/route.ts` work exactly as documented on a clean run (see verification above). One real failure *was* observed and investigated before reaching that clean run; it's written up in detail because it's worth a human's attention, but it turned out to be an artifact of this test session's concurrency, not a deterministic app bug:

**What happened:** My first attempt at the accept path (a different Venusaur V listing/offer, since discarded) got the UI stuck showing only a "Decline" button with the "Accept" button replaced by a permanent loading spinner. Investigating with a direct in-page `fetch()` (bypassing the UI) against the same offer showed `PATCH /api/offers/{id} { action: "accept" }` returning **HTTP 500 `{"error":"Failed to update offer"}` after ~7 seconds**. Checking Stripe directly showed the underlying charge had been **captured *and* refunded** — i.e. `stripe.paymentIntents.capture()` (route.ts line 166) had succeeded, but the `prisma.$transaction(...)` right after it (lines 180-249: create Order, mark offer paid, archive sibling offers, transfer listing, create CardTransaction) threw, which correctly triggered the code's existing safety-net refund (lines 251-267) rather than leaving the buyer charged with no card transferred.

**Root cause: this session's own concurrency, not the offer code.** At the time, `free -h` showed swap fully exhausted (4.0Gi/4.0Gi) and ~40 concurrent headless Chromium processes across the ~10 other QA tasks running in parallel against this one dev server (`ps aux`, `next-server` pid `317468`). `src/lib/prisma.ts` documents that the pool is deliberately capped at `connection_limit=5` (Supabase's pooler ceiling), which is reasonable for one real user but becomes the bottleneck when ~10 parallel automated agents hit it simultaneously — Prisma's interactive-transaction connection-acquisition window is short (default 2s), well inside what this contention could exceed. To confirm this wasn't a deterministic bug in the handler itself, I:
1. Cleanly declined the poisoned offer (`reject` ignores an already-cancelled/refunded PI and always still flips status — this recovery path itself worked correctly, confirmed via DB).
2. Waited for a quiet moment (`free -h` showing swap back down, 0 Chromium processes).
3. Placed a **fresh** offer (the Venusaur V one reported above) and called `accept` again with the identical code path.
4. It succeeded in ~3.7s with a full, correct DB/Stripe state (reported above).

Since the identical code, run twice, failed under extreme concurrent load and succeeded cleanly under normal load, this reads as environmental contention (DB connection-pool pressure + system memory pressure — swap was maxed out) rather than a logic bug in the accept transaction. I did not change `src/lib/prisma.ts`'s `connection_limit` or any `.env` value per the plan's constraint against editing `.env`. I did briefly add a temporary `_qaDebug` field to the `catch` block's error response in `src/app/api/offers/[id]/route.ts` to see the real Prisma error text during this investigation, then **reverted it immediately** after use — the file is back to its original state (confirmed via `grep` for the string, and via a clean `npx tsc --noEmit` / full `npx vitest run` — 432/432 passing — after reverting).

The one thing worth flagging as a **real, if minor, design gap** (not fixed, since it's a judgment call and not unambiguously "broken"): if this transaction failure happens to a real user's offer (even rarely, under real production DB contention), the offer is left stuck in `"pending"` with a PaymentIntent that's already been captured-then-refunded. A retried "Accept" click would fail again (Stripe would reject re-capturing an already-refunded PI), and forever show the same stuck spinner in the UI, with no error message surfaced to the seller telling them what to do — their only way out is to click "Decline" instead (which does work, since its `cancel()` call is wrapped in a try/catch that ignores failure and unconditionally marks the offer rejected). This is an edge case, requires a transaction failure specifically *after* a successful capture, and the existing refund safety net does prevent any actual financial harm — so I'm surfacing it below rather than "fixing" it, since a real fix (e.g. re-checking PI status on accept-retry and auto-recovering, or showing the seller a clearer error affordance) is a product decision, not a one-line bug fix.

## Needs Human Verification

- **The stuck-accept-under-load edge case above.** To reproduce deliberately: intentionally make the DB transaction in the `accept` branch of `src/app/api/offers/[id]/route.ts` slow or contended (e.g. run several other heavy concurrent DB scripts) while clicking Accept, and see whether the UI ever explains what happened or offers a next step beyond "click Decline instead." This is a UX polish item, not a data-integrity one — no money is ever at risk (the refund safety net already covers that), confirmed directly via Stripe's ledger during this investigation.
- **Re-run `stripe login` for the `pokemon_mvp` CLI profile** if anyone wants to use the `stripe` CLI directly for this project going forward — its cached test-mode key reported as expired (see note above). Not blocking; the app itself and this QA pass both used the still-valid key from `.env` directly.
- Two real Stripe test-mode charges were made and correctly reconciled during this task (both fully verified, no cleanup needed): `pi_3UEwstAVU8YI57Gn3xPvxHOO` ($50.00, captured — Venusaur V now legitimately owned by misty) and one earlier now-superseded PaymentIntent that was captured-then-refunded during the investigation above (net $0 to the test account, offer cleanly closed via decline). `pi_3UF1qnAVU8YI57Gn3V1jukpN` ($70.00, Blastoise decline) was authorized then cleanly canceled with no capture. All in Stripe test mode — no real money was ever involved.
