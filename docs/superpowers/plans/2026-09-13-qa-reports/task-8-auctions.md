# Task 8: Auctions — bid, outbid, buy-out, and win settlement

Fixtures used (per plan, exactly these three `Auction` rows — no plain `Listing`
rows were touched):

- **Blastoise Holo Rare** auction `f496365e-150c-49af-ad22-f7bf36978e97`, owned by
  ash (listing `d10082d1-27e9-47b8-bd56-3608ef2d0953`). Bidders: misty then admin.
- **Gyarados VMAX** auction `befdca8b-37f6-4e6f-ad2d-fca1d30c1040`, owned by misty
  (listing `b84cebbb-3ae6-493d-93fa-2a14471e0422`). Buy-out buyer: ash.
- **Charizard VMAX** auction `31864bb2-aaab-45e6-b690-545583e619a5`, owned by ash
  (listing `c5b2862e-2362-452b-a77f-267608571091`), already past its `endsAt` with
  zero bids before testing began.

Browser automation used `playwright-core` + the cached Chromium binary per Shared
Setup, with real Stripe test-mode card `4242 4242 4242 4242`. DB verification used
throwaway `tsx` scripts against the live Postgres instance, deleted after each use.

## Tested

### 1. Bid + outbid on Blastoise Holo Rare

- As **misty**, opened the card, clicked **Place Bid**, entered **S$65** (above the
  S$60 starting bid), continued to the Stripe card step, and filled
  `4242 4242 4242 4242 / 12/34 / 123 / 123456`. Submitted.
  - The dialog appeared to hang on "Placing bid…" past 15s in my first attempt —
    see **Stripe Link / hCaptcha quirk** below. The mutation had in fact completed
    server-side; a second attempt with the same flow (more patience, ~13s) showed
    the actual success alert and closed the dialog cleanly. No app bug: DB after
    the first attempt already showed a `Bid` row (`amount: 6500`,
    `paymentIntentId: pi_3UEwihAVU8YI57Gn3czL7mbh`), `Auction.currentBid = 6500`,
    `Auction.highestBidderId = misty`.
- As **admin**, attempted the same flow on the same auction — see **Found & Fixed
  #1** below; this initially failed because admin could not even see a "Place Bid"
  button. After the fix, admin bid **S$75**, completed the Stripe card step, and
  the dialog showed *"Bid placed! Funds are authorised and you are the current
  highest bidder."*
  - DB confirms: `Auction.currentBid = 7500`, `highestBidderId` = admin's id,
    misty's prior bid row flipped to `status: "cancelled"`, admin's new bid row
    `status: "active"`.
  - Stripe confirms: misty's PI `pi_3UEwihAVU8YI57Gn3czL7mbh` → `canceled` (hold
    released); admin's PI `pi_3UF1tvAVU8YI57Gn1HVANsnE` → `requires_capture`
    (7500, held, not yet charged).
  - `Notification` row for misty: `type: "outbid"`, *"You've been outbid on
    'Blastoise Holo Rare'"* — confirmed created immediately after admin's bid.

### 2. Buy-out on Gyarados VMAX

- As **ash**, opened the card, clicked **Buy Now S$110.00** (see **Found & Fixed
  #2** for why the buy-out price had to be added first), the amount step was
  pre-filled to the buy-out price, continued through the Stripe card step with the
  same test card, and submitted. Dialog showed *"Buy-out price met! The auction
  has ended and you've won."*
  - DB: `Auction.status = "sold"`, `highestBidderId` = ash, winning `Bid.status =
    "won"`, `amount: 11000`.
  - `Listing` (`b84cebbb-...`): `ownerId` transferred to ash, `inAuction: false`,
    `forSale: false`.
  - `Order` row: `status: "PAID"`, `amount: 11000`, `stripePaymentIntentId:
    pi_3UF1xDAVU8YI57Gn0NyNffPk`, buyer = ash, seller = misty.
  - Notifications: misty (seller) got `bid_received` then `auction_sold`
    (*"'Gyarados VMAX' sold via auction"*); ash (winner) got `auction_won`
    (*"You won 'Gyarados VMAX'!"*).

### 3. Forced settlement of Blastoise (admin as high bidder)

- Blastoise's real `endsAt` had already passed by the time this step ran (see
  timing note below), so no manual push was needed to get it *past* its end —
  the cron was triggered directly:
  `curl -X GET http://localhost:3000/api/cron/expire-auctions -H "Authorization: Bearer $CRON_SECRET"`
  → `{"settled":0,"pendingDecision":1,"expiredNoBids":0,"expiredDecisionTimeout":0,"failed":0}`.
- **Important, non-bug finding:** this did *not* immediately settle the auction as
  "sold." Because Blastoise has `reservePrice: null`, `src/app/api/cron/expire-auctions/route.ts`
  intentionally routes it to `pending_seller_decision` (see its own inline
  comment: *"Actually: if reservePrice is null, bid still goes to seller
  decision."*) rather than auto-settling — auto-settle only fires when
  `reservePrice !== null && topBid.amount >= reservePrice`. DB confirmed:
  `status: "pending_seller_decision"`, `sellerDecisionDeadline` set to +24h, and
  ash received an `auction_decision_needed` notification (*"Decision needed:
  'Blastoise Holo Rare' ... top bid of S$75.00"*).
  - This is a real discrepancy from the plan's literal expectation ("cron directly
    settles it to sold"), but it is correct, intentional, documented application
    behavior, not a defect — verified by reading `auctionSettlement.ts` and the
    cron route's own comments, and cross-checked against a second, unrelated
    reserve-bearing auction's behavior in the seed data.
  - To reach the actual "win settlement" the task title asks for, I completed the
    natural next step of this flow for real: logged in as **ash** (the seller),
    opened the card (now showing **Accept S$75.00 / Decline**), and clicked
    **Accept**.
  - DB after accept: `Auction.status = "sold"`, `Listing.ownerId` transferred to
    admin, `inAuction: false`, `forSale: false`. New `Order` row: `PAID`,
    `amount: 7500`, buyer = admin, seller = ash. Notifications: admin got
    `auction_won` (*"You won 'Blastoise Holo Rare'!"*), ash got `auction_sold`
    (*"'Blastoise Holo Rare' sold via auction"*).
  - Minor observed UI quirk (not investigated further, see Needs Human
    Verification): immediately after clicking Accept, the card page kept showing
    the Accept/Decline buttons for a few seconds even though the DB write had
    already succeeded — looks like the client doesn't optimistically clear/refetch
    auction state fast enough after `onAuctionDecide` resolves. A manual reload
    shows the correct final state immediately.

### 4. No-bid expiry regression check (Charizard VMAX)

- Confirmed via DB this auction was already `status: "expired"`, `highestBidderId:
  null`, zero `Bid` rows, `Listing.inAuction: false`, ownership unchanged (still
  ash) — the correct terminal state for a zero-bid expiry, and ash already held an
  `auction_expired` notification (*"Auction ended with no bids: 'Charizard
  VMAX'"*). This was produced by an earlier cron run in this same session (before
  a mid-task rate-limit pause — see timing note).
- Confirmed the live UI (as misty, a non-owner viewer) correctly refuses/hides
  bidding: the card renders in standard (non-auction) mode, no "Place Bid" button
  at all, and "Buy Now" reflects the normal not-for-sale state
  (`isForSale: false` → disabled) — no way to interact with this dead auction.
  Screenshot: `task8-charizard-final-ui.png`.

### Timing note (why the DB shows resets)

This task's execution was interrupted mid-run by a session rate limit and resumed
roughly 2 hours later. By resume time, real wall-clock time had passed all three
auctions' seeded `endsAt` values, and — evidently from work done in the pre-pause
portion of this same task — the cron had already been run once, which had already
flipped Blastoise to `pending_seller_decision` and Gyarados/Charizard to `expired`
(zero bids on both at that point). To re-exercise the still-pending bid/outbid and
buy-out sub-cases on the correct, assigned rows, I used the plan's own explicitly
granted allowance ("directly update `endsAt` ... via a throwaway DB script — this
is test setup, not touching seed data meaningfully") symmetrically: pushed
Blastoise's and Gyarados's `endsAt` back into the future (and reset their
`status`/`sellerDecisionDeadline`, and Gyarados's `Listing.inAuction`) so the real
bid/buy-out UI flows could run again, then pushed Blastoise's `endsAt` back to the
past before the final cron trigger. No fixture rows outside the three assigned
auctions (and their linked listings) were touched, and no plain `Listing`-only
rows were touched anywhere.

## Found & Fixed

### 1. Admin could not bid, buy-out, or act as a buyer on ANY auction (or, by the
   same code path, place offers / add to cart / buy-now on any listing they don't
   own)

**Symptom:** Logging in as admin and opening the Blastoise auction (owned by ash,
not admin) showed only an informational *"Auction is live — bids are open."*
banner — no Place Bid / Buy Now buttons at all, even though admin was not the
seller.

**Root cause:** `src/app/cards/[id]/page.tsx` computes
`canManageListing = isOwner || isAdmin` and passes
`mode={canManageListing ? "owner" : "viewer"}` into `BuyBox`. `BuyBox` derives a
single `isOwnerMode = mode === "owner"` flag that gates *both* the standard
Edit/See-Offers vs Buy/Offer button set *and* the auction Accept/Decline vs
Place-Bid/Buy-Now button set. Because `isAdmin` is folded into `canManageListing`
unconditionally, admin is put into "owner" display mode for every single card on
the site, regardless of who actually owns it — so admin can never see the buyer
controls anywhere. Interestingly, the page-level handlers (`onPlaceBid`,
`onBuyOut`) were already correctly gated on `!isOwner` alone (not
`canManageListing`), and other admin-vs-owner distinctions in this same file
already exist (e.g. `onStartAuction={isOwner && !isAdmin && ...}`,
`{!isAdmin && isOwner && (<EditPriceDialog .../>)}`) — this was simply the one
spot in the auction UI that hadn't been given the same treatment.

**Fix:** Added a new, narrowly-scoped `isAuctionSeller?: boolean` prop to
`BuyBox` (`src/app/shared-components/cards/BuyBox.tsx`), defaulting to the
existing `isOwnerMode` when omitted (so behavior is unchanged for any future
caller that doesn't pass it — `BuyBox` currently has exactly one call site).
Introduced `const auctionSellerMode = isAuctionSeller ?? isOwnerMode;` and used it
in place of `isOwnerMode` for the four auction-specific render branches (Place
Bid/Buy Now vs Accept/Decline vs the two informational banners). Left every other
`isOwnerMode` usage (standard-mode buttons, Edit, Add to Cart, Start Auction,
etc.) untouched — those are out of this task's scope (offers/cart are Task 7/5/6's
territory) and carry their own risk if changed without those tasks' context.
`src/app/cards/[id]/page.tsx` now passes `isAuctionSeller={isOwner}` (true
ownership, not `canManageListing`) into `BuyBox`.

**Files changed:**
- `src/app/shared-components/cards/BuyBox.tsx`
- `src/app/cards/[id]/page.tsx`

**Verified:** `npx tsc --noEmit` — clean, no errors. No existing test references
`BuyBox` (`grep -rl BuyBox src/__tests__` — no hits), and this task did not touch
`src/lib` or `src/app/api`, so `npx vitest run` was not required per the task
instructions (skipped to conserve shared-machine resources; every relevant vitest
file is unrelated to this change). Functionally re-verified end-to-end: after the
fix, admin's real Stripe-authorized bid on Blastoise succeeded through the actual
UI (see Tested #1), producing the correct `Bid`/`Auction`/`Notification` rows.

### 2. Gyarados VMAX's assigned auction fixture had no buy-out price

**Symptom:** The "Buy Now" button on the assigned Gyarados VMAX auction was
permanently disabled ("No Buy-out"), so the buy-out sub-case could not be
exercised at all against this fixture.

**Root cause:** Not a bug — `prisma/seed.ts`'s `auctionCard3` (this exact
Gyarados VMAX auction) was deliberately seeded with `startingBid: $50,
reservePrice: $100`, and **no** `buyOutPrice`, as one of several intentionally
varied auction shapes. The QA plan's fixture assignment ("use this auction to test
buy-out") doesn't match what was actually seeded for it.

**Fix:** Not a source-code fix. Per the plan's own allowance for direct,
throwaway test-setup edits, added `buyOutPrice: 11000` (S$110) to this one
`Auction` row via a `tsx` script, then deleted the script. No `Listing` row and no
other `Auction` row was touched.

## Needs Human Verification

- **Stripe Link / hCaptcha UI-stall quirk (same caveat already flagged in the
  plan for offers).** On misty's first Blastoise bid attempt, after filling the
  card, expiry, CVC, and postal code and clicking "Place Bid," Stripe's inline
  Elements card field spontaneously grew a "Save with [Link]" toggle next to the
  CVC field, and the dialog sat on "Placing bid…" for 15+ seconds with no visible
  error. Investigating further (network trace + direct Stripe API query) showed
  this is **not a data-correctness bug**: the underlying `stripe.confirmCardPayment()`
  call and the app's own `POST /api/auctions/[id]/bid` *did* both succeed for real
  (PI `pi_3UEwihAVU8YI57Gn3czL7mbh` reached `requires_capture`, and the `Bid` row
  was written to Postgres) — it just took on the order of ~13 seconds longer than
  my first polling window, seemingly because Stripe's Link auto-detection kicks
  off an invisible hCaptcha verification round-trip
  (`js.stripe.com/v3/hcaptcha-invisible-...`, `newassets.hcaptcha.com/captcha/...`)
  before letting the confirm call resolve. A second attempt with a longer wait
  showed the dialog complete normally end-to-end (success alert, auto-close).
  **What a human should check:** open a real (non-automated) browser, place a bid
  or buy-out on any live auction with a fresh/incognito session, and confirm the
  "Save with Link" prompt either doesn't appear or resolves quickly for a real
  user — if it reliably adds a double-digit-second delay for real traffic too,
  that's worth a follow-up regardless of whether it's "Stripe's behavior" vs
  something tunable in this app's Stripe Elements config (e.g. explicitly
  disabling Link autofill on this specific CardElement).
- **Accept-button UI lag.** After ash clicked "Accept S$75.00" on the
  pending-decision Blastoise auction, the page kept showing the Accept/Decline
  buttons for several seconds even though the DB write (`Auction.status: "sold"`,
  ownership transfer, notifications) had already completed. A manual page reload
  immediately shows the correct final (sold) state. Worth a two-minute manual
  check: accept a bid as a seller in a real browser and see whether the UI ever
  self-corrects without a refresh, or whether it needs a client-side re-fetch
  after `onAuctionDecide` resolves (`src/app/cards/[id]/page.tsx`'s
  `handleAuctionDecide`).
- **Test-setup DB mutations made this task, for the record** (all on the three
  assigned `Auction` rows / their own linked `Listing`s — nothing else): pushed
  Blastoise's and Gyarados's `endsAt` forward then (for Blastoise) back to force
  through the still-open bidding window after real time had already passed the
  original seeded `endsAt`; added `buyOutPrice: 11000` to the Gyarados auction;
  reset Gyarados's `Listing.inAuction` to `true` after an earlier cron run had
  cleared it. All three auctions are now in their genuine final state (Blastoise
  → sold to admin, Gyarados → sold to ash, Charizard → expired with no bids) —
  no further cleanup should be needed.
