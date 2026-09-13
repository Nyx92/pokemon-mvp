# Comprehensive Real-Data E2E QA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each task is a QA + fix cycle, not a build-from-spec cycle: "test" means drive the real running app with a real browser against real seeded data (not vitest mocks) and cross-check the database directly; "fix" means locate the root cause in the actual source file and correct it, the same way any other bug fix in this codebase is done.

**Goal:** Exercise every user-facing feature of the pokemon-mvp marketplace end-to-end against the live dev server and real seed data, fix every bug found, and leave a written record of what was tested, what broke, what was fixed, and what still needs a human to confirm.

**Architecture:** Each task below is self-contained and assigned its own seed-data fixtures (specific buyer/seller/card-name triples) so tasks can run as independent, parallel subagents without colliding on the same listing, cart, or auction. Every task follows the same loop: (1) drive the flow with Playwright, (2) verify the result against the Postgres database directly via a throwaway `tsx` script (not just what the UI shows), (3) if broken, fix the real source file and re-verify, (4) write findings into its own report file under `docs/superpowers/plans/2026-09-13-qa-reports/`.

**Tech Stack:** Next.js 14 App Router, MUI v7, Prisma 6 + Supabase Postgres, Stripe test-mode Checkout + Elements, NextAuth credentials provider, `playwright-core` driving a real Chromium binary (the MCP Playwright tool is not available in this environment — see Shared Setup below).

**Spec:** No separate spec document — this plan documents its own scope directly, agreed with the user in-conversation.

## Global Constraints

- **Never run `prisma db push --force-reset` or any full-database wipe.** This plan only ever creates/mutates rows through the app's own UI and API routes, the same way a real user would. If seed data runs low for a task, top it up with a normal Prisma insert of one more listing — never reseed.
- **Money is test-mode Stripe only.** Card `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP — this project's `.env` already points at Stripe test mode; nothing here touches real money.
- **Never edit `.env`, `prisma/schema.prisma`, or `package.json`'s scripts** — none of the tasks below require it. If a task believes it needs to, stop and write that finding into its report instead of making the change.
- **One task, one set of fixtures.** Use exactly the buyer/seller/card-name triple assigned to your task (below) so parallel tasks never fight over the same reservation, cart, or auction. If your assigned card name has multiple unreserved listings, use `reservedById: null` filtering to pick any one that's free at the moment you run — another task will never touch your card name.
- **Fix bugs where they actually live.** This is a real codebase with real conventions (see any file you touch for the local style) — match existing patterns, don't introduce new abstractions, don't add speculative error handling for cases that can't happen.
- **Every fix gets `npx tsc --noEmit` and, if you touched anything under `src/lib` or `src/app/api`, `npx vitest run` (full suite) before you consider it done.** A fix that breaks the existing 432 unit tests is not a fix.

---

## Shared Setup (read this before starting any task)

**Dev server:** already running at `http://localhost:3000` (`pnpm dev`, which runs `next dev` + a Stripe webhook forwarder via `script/dev-stripe-listen.sh` — this was fixed earlier tonight and is confirmed working end-to-end; don't touch it). If `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/` doesn't return `200`, stop and write that in your report — don't try to start/stop the dev server yourself.

**Seed accounts:**
| username | email | password | role |
|---|---|---|---|
| admin | admin@pokemon.com | admin | admin |
| ashketchum | ash@pokemon.com | 123 | user |
| misty | misty@pokemon.com | 123 | user |

**Browser automation — the MCP Playwright tool is broken in this environment (no system Chrome, and downloading Chromium via the Playwright installer fails on network errors).** Use this working alternative instead, already set up in this session:
- `playwright-core` is already installed at `/tmp/claude-1000/-home-buba-projects/0cc2a3eb-4b77-4109-ad7c-899b4aef5a4f/scratchpad/pw-check/node_modules`. Write your test scripts as `.mjs` files in that same directory so they can `import` from it.
- A cached, working Chromium binary lives at `/home/buba/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`.
- A shared harness already exists at `.../pw-check/harness.mjs` exporting `launch()`, `newPage(browser, opts)`, `login(page, email, password)`, `BASE_URL()`. Reuse it; extend it if you need something new (e.g. a `signup()` helper) rather than duplicating the launch/login boilerplate.
- Known quirks already discovered this session — don't rediscover these the hard way:
  - Use `waitUntil: "load"`, never `"networkidle"` — the app holds open an SSE connection (`/api/notifications/stream`) that keeps the network "busy" forever, so `networkidle` waits can hang or flake.
  - `page.waitForFunction(fn, options)` — the second positional argument is `arg` (passed into `fn`), not `options`. Call it as `page.waitForFunction(fn, null, { timeout })`.
  - The marketplace/my-collection card grid deliberately hides the logged-in user's **own** listings from search/browse results — this is correct, intentional behavior (you can't buy your own card), not a bug. Always check who owns a listing before assuming a missing search result is broken.
  - Stripe's hosted Checkout page's card iframe has title `Secure payment input frame`; locate the number field inside it via `input[placeholder="1234 1234 1234 1234"]`, expiry via `input[placeholder="MM / YY"]`, CVC via `input[placeholder="CVC"]`. It can take several seconds to mount — poll for it (10 attempts × 1.5s) rather than a single fixed wait.
  - The inline Stripe payment-authorization step used by **offers and bids** (not the full Checkout redirect) sometimes shows a real "Card number" / "MM / YY" / "CVC" / "ZIP" set of fields, and sometimes Stripe's Link auto-detection swaps in a "Save with Link" prompt mid-fill, leaving the dialog stuck on "Submitting…" with **no visible error**. If you hit this, screenshot it, try once more with a longer pause between filling the card number and the rest of the fields, and if it still won't complete, say so plainly in your report rather than declaring it broken — this looked like a headless-automation-vs-Stripe-Link quirk, not a confirmed app bug, when investigated earlier tonight.

**Database verification pattern** — run from `/home/buba/projects/pokemon-mvp`, always via a throwaway file (so `node_modules` resolves) that you delete after:
```bash
cd /home/buba/projects/pokemon-mvp
cat > ./_qa_check.mjs <<'EOF'
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
// ... your query ...
await prisma.$disconnect();
EOF
npx tsx ./_qa_check.mjs
rm -f ./_qa_check.mjs
```

**Report format** — write your findings to `docs/superpowers/plans/2026-09-13-qa-reports/task-N-<short-name>.md` with three sections: `## Tested` (what you drove and confirmed working, with the DB evidence), `## Found & Fixed` (bug description, root cause, file changed, how you verified the fix), `## Needs Human Verification` (anything you could not fully automate — be specific about exactly what to click and what "correct" looks like, so the user can check it in two minutes tomorrow).

---

### Task 1: Sign-up flow

**Fixtures:** create one brand-new throwaway account through the real UI form — do not touch admin/ash/misty for this task. Suggested: `qa-signup-test@pokemon.com`.

**Test:**
- [ ] Navigate to `/auth/signup`, fill out the full form (all required fields visible in the form — check the actual component at `src/app/auth/signup/page.tsx` for what's required), submit.
- [ ] Confirm the new user actually lands logged-in (or is redirected to login — whichever the app does) and a `User` row exists in Postgres with the right email/username and a bcrypt-hashed password (not plaintext).
- [ ] Try signing up again with the exact same email — confirm the app rejects it with a clear error rather than creating a duplicate row or crashing.
- [ ] Try submitting with an invalid email format and with a too-short/missing password — confirm client-side or server-side validation catches both, with a visible error message (not a silent no-op or a 500).

**If broken:** the signup route is almost certainly `src/app/api/auth/signup/route.ts` or similar — search `src/app/api` for the POST handler the signup form calls. Fix there; re-run all three sub-checks above after.

---

### Task 2: Login, logout, and profile edit

**Fixtures:** use `ashketchum` for login/logout; use `misty` for the profile-edit checks (so Task 1's fresh signup account and this task never touch the same row).

**Test:**
- [ ] Log in as ash with the correct password — confirm success (redirect + navbar shows username).
- [ ] Log out — confirm the navbar reverts to "Sign up / Login" and a protected page (e.g. `/watchlist`) redirects to `/auth/login` when visited while logged out.
- [ ] Attempt login with a wrong password for ash — confirm a visible "invalid email or password" error, not a silent failure or a stack trace.
- [ ] Log in as misty, go to `/profile/edit/general`, change one field (e.g. address or phone number) to a new value, save, reload the page, and confirm the new value persisted (check both the UI and the `User` row in Postgres).

**If broken:** auth lives in `src/lib/auth.ts` (NextAuth config) and `src/app/api/auth/[...nextauth]`; profile edit is `src/app/profile/edit/general/EditProfilePage.tsx` and whatever API route it calls (search for its `fetch(` calls). Fix there.

---

### Task 3: Marketplace browse, search, filter, card detail

**Fixtures:** read-only task — no purchases, no mutations. Use ash as the logged-in viewer.

**Test:**
- [ ] `/marketplace`: confirm the POKÉMON tab and RIFTBOUND tab both load real cards (Riftbound has ~1300 seeded listings — confirm at least one page of them renders with images, prices, and condition badges, not blank/broken tiles).
- [ ] Search: type a real card name that exists (e.g. "Gyarados") and confirm only matching results show; type gibberish (e.g. "zzzxxxqqq123") and confirm the empty state renders (not a crash or infinite spinner).
- [ ] Filters: apply a Set filter and a Rarity filter together; confirm the result set actually narrows and matches what a direct DB query for the same filters returns (don't just trust the UI — count rows matching your filter in Postgres and compare to how many tiles render, accounting for pagination).
- [ ] Open a card detail page for a Riftbound card specifically (not just Pokémon — this session tested Pokémon far more than Riftbound) — confirm price history chart, condition tiers, and "N Listings" section all render without console errors.
- [ ] Check browser console for errors/warnings across all of the above (reuse the `page.on("console", ...)` pattern from earlier this session) — report anything unexpected, even if the page still visually works.

**If broken:** marketplace API is `src/app/api/cards/route.ts` and `src/app/api/cards/browse-index.ts`; filter/search UI is `src/app/marketplace/FilterBar.tsx` and `MarketPlace.tsx`. Fix there.

---

### Task 4: Watchlist and My Collection (binders, filters)

**Fixtures:** use ash as the actor. Pick any Riftbound-catalog card ash doesn't own for the watchlist half (to avoid the "can't watchlist your own card" rule).

**Test:**
- [ ] Add a card to watchlist from the marketplace grid, confirm it appears on `/watchlist`, badge count updates, then remove it and confirm the empty state (with "Browse cards" CTA) renders.
- [ ] `/myCollection` as ash: confirm it lists ash's own cards (should be a large Riftbound-heavy set — check the count roughly matches ash's owned-listing count in Postgres).
- [ ] Create a new binder via the "Create Binder" flow, confirm the new binder appears in the binder dropdown and a `Binder` row exists in Postgres owned by ash.
- [ ] Filter My Collection by that new (empty) binder — confirm it correctly shows zero cards / an appropriate empty state, not an error.
- [ ] Use the All / For Sale / In Auction / Sold toggle at the top of My Collection — confirm each one actually changes the result set to match a direct DB query filtered the same way.

**If broken:** watchlist API is `src/app/api/watchlist/route.ts`; My Collection UI is `src/app/myCollection/MyCollection.tsx`; binder creation route — search `src/app/api` for `binder`.

---

### Task 5: Cart + single-item checkout (re-verification) + voucher field

**Fixtures:** buyer = ash, seller = misty, card name = **"Psyduck"** (misty has multiple unreserved listings of this). Do not use "Starmie GX" or "Gyarados VMAX" — those are reserved for Task 6.

**Test:**
- [ ] Add one "Psyduck" listing to ash's cart, confirm cart badge and subtotal are correct, remove it, confirm cart returns to empty state, add it back.
- [ ] Look at the "Select Voucher" control in the cart summary — click it, see what it actually does (this was never exercised this session). If it's a real, functional feature (e.g. applies a discount), test applying one and confirm the total updates correctly in both the UI and the amount actually charged to Stripe. If it's a stub/placeholder with no real vouchers seeded, say so plainly in the report rather than guessing.
- [ ] Complete a full purchase with Stripe test card `4242 4242 4242 4242`, any future expiry/CVC. Confirm (via direct DB query, not just the UI): the `Order.status` becomes `PAID`, `stripePaymentIntentId` is populated, the `Listing.ownerId` transfers to ash, `forSale` becomes `false`, a `CardTransaction` row exists, and misty (the seller) received a `card_sold` notification. This exact flow was already confirmed working earlier tonight after a webhook config fix — this is a regression check, expected to pass; if it doesn't, something regressed and needs real investigation, not a shrug.

**If broken:** checkout route is `src/app/api/checkout/route.ts` (single item) / `src/app/api/checkout/cart/route.ts`; webhook is `src/app/api/stripe/webhook/route.ts`.

---

### Task 6: Multi-item cart checkout

**Fixtures:** buyer = ash, seller = misty, card names = **"Starmie GX"** AND **"Gyarados VMAX"** (two different listings, one of each, in the same cart, in the same checkout session).

**Test:**
- [ ] Add one "Starmie GX" listing and one "Gyarados VMAX" listing (both misty's) to ash's cart in the same session. Confirm the cart shows 2 items with a correctly-summed subtotal.
- [ ] Complete checkout once with a single Stripe payment covering both items.
- [ ] Verify via direct DB query: **both** underlying `Order` rows exist and are `PAID`, **both** listings transferred ownership to ash, **both** are archived off misty's active offers if any existed, and misty received **two** separate `card_sold` notifications (one per card) — or one combined notification if that's how the code is written; either is fine, but confirm it's not silently only 1-of-2 processed (that would indicate the cart webhook handler's per-order loop is broken for N>1).
- [ ] Confirm the cart is empty afterward and neither purchased listing still shows as available in the marketplace.

**If broken:** this is the multi-order path in `handleCartSessionCompleted` inside `src/app/api/stripe/webhook/route.ts` — read its inline comments carefully (it's already written to loop per-order inside one DB transaction) before concluding something is wrong; confirm with a DB query first, since it's plausible this already works and just wasn't tested tonight.

---

### Task 7: Offers — full lifecycle (place, accept, decline)

**Fixtures:** buyer = misty, seller = ash. Use **"Venusaur V"** for the accept sub-case and **"Blastoise Holo Rare"** for the decline sub-case (two different specific listing rows — ash has 5+ unreserved listings of each; pick any two different ones so this task's two sub-cases don't collide with each other).

**Test — accept path (Venusaur V):**
- [ ] As misty, place an offer below asking price on a "Venusaur V" listing, completing the Stripe authorization step with the real test card (see the Link-UI caveat in Shared Setup — persevere through it once; if it truly cannot be completed, that itself is the finding for this sub-case, written up clearly).
- [ ] Confirm an `Offer` row exists with status pending/awaiting and a real `paymentIntentId`.
- [ ] Log in as ash (the seller), find the offer (likely via a "Seller Offers" dialog on the listing, or an `/offers` received-offers view), accept it.
- [ ] Confirm via DB: the offer's status flips to accepted, an `Order`/`CardTransaction` reflecting the sale exists, the listing ownership transfers to misty, and misty gets an `offer_accepted` notification.

**Test — decline path (Blastoise Holo Rare):**
- [ ] Same as above through offer placement, but ash declines instead of accepting.
- [ ] Confirm via DB: the offer's status flips to declined/rejected, the listing's ownership is unchanged (still ash's), the authorized payment hold is released (check the Stripe PaymentIntent status via `stripe payment_intents retrieve <id>` — should be `canceled`, not still `requires_capture`), and misty gets an `offer_rejected` notification.

**If broken:** offer routes live under `src/app/api/offers/`; seller-side accept/decline UI is `src/app/shared-components/cards/SellerOffersDialog.tsx` (or wherever accept/decline buttons live — grep for it).

---

### Task 8: Auctions — bid, outbid, buy-out, and win settlement

**Fixtures:** three separate auctions, so each sub-case is isolated:
- **Bid + outbid:** the active "Blastoise Holo Rare" auction owned by ash (ends ~21:00 UTC tonight — plenty of time). First bidder = misty, second (outbidding) bidder = admin.
- **Buy-out:** the active "Gyarados VMAX" auction owned by misty (ends ~22:00 UTC tonight). Buyer = ash.
- **No-bid expiry (already-expired edge case):** the "Charizard VMAX" auction owned by ash, which already ended before this plan was written — confirm the app's UI correctly refuses/hides bidding on it (don't try to place a bid there; just confirm the UI reflects it's over), then separately trigger `GET /api/cron/expire-auctions` (Bearer token = `CRON_SECRET` from `.env`) and confirm via DB that it settles to `expired` with no winner (this exact mechanism was already confirmed working earlier tonight — this is a quick regression check).

**Test:**
- [ ] Place a bid as misty on the Blastoise auction, above the starting bid, completing the Stripe authorization step (same caveat as offers). Confirm via DB: a `Bid` row exists, `Auction.currentBid`/`highestBidderId` updated to misty.
- [ ] Place a higher bid as admin on the same auction. Confirm misty receives an `outbid` notification, and the auction's current bid/highest bidder now reflect admin.
- [ ] On the separate Gyarados VMAX auction, use "Buy Now"/buy-out as ash. Confirm the auction immediately settles: status becomes ended/won, ash is `highestBidderId`, ownership of the listing transfers to ash, and misty (seller) gets notified.
- [ ] For the Blastoise auction (now with admin as high bidder, not yet ended): manually trigger `/api/cron/expire-auctions` to force it past its end time only if its real `endsAt` has already passed by the time you get to this step — otherwise, directly update `endsAt` to a past timestamp via a throwaway DB script first (this is test setup, not touching seed data meaningfully), then trigger the cron. Confirm: auction status becomes settled/ended, admin is recorded as the winner, admin gets a "you won" notification, and ash (seller) gets a "your item sold at auction" notification (or whatever the actual notification-type name is — check `prisma/schema.prisma`'s notification type enum/union if one exists).

**If broken:** bidding routes under `src/app/api/auctions/`; settlement cron logic is `src/app/api/cron/expire-auctions/route.ts` and whatever helper it calls (look for `auctionSettlement` — there's already a `src/__tests__/lib/auctionSettlement.test.ts`, so the implementation is probably `src/lib/auctionSettlement.ts`).

---

### Task 9: Notifications — every type, dismiss, mark-read, live update

**Fixtures:** this task is mostly observational — it depends on Tasks 5-8 having actually run and generated real notifications. Run this task **last**, after 5-8 report back, OR generate the notification types directly via one throwaway DB insert per type if you need to verify the UI in isolation before the other tasks finish (both are valid; prefer the real ones from Tasks 5-8 where available since those prove the real trigger code path works, not just the UI).

**Test:**
- [ ] For each notification type that exists in this app (check `prisma/schema.prisma` and `src/lib/notifications.ts` for the full list — expect at least: `card_sold`, `offer_received`, `offer_accepted`, `offer_rejected`, `outbid`, `bid_received`, `auction_won`, `auction_decision_needed`, `auction_expired`), confirm at least one real instance was generated by Tasks 5-8's actions and that it renders correctly on `/notifications` with the right icon/color per `notifications/page.tsx`'s type-to-icon mapping.
- [ ] Dismiss one notification — confirm it's removed from the list and from Postgres.
- [ ] "Mark all read" — confirm the unread badge count drops to 0 and every notification's `read` field flips to `true` in Postgres.
- [ ] With two browser contexts open simultaneously (one performing an action that generates a notification for the other user, e.g. ash outbidding misty), confirm the notification badge on misty's already-open page updates live via the `/api/notifications/stream` SSE connection, without a manual page refresh. If it does NOT update live and only appears after a refresh, that's a real finding — write it up (many apps get this wrong; confirm which this one does).

**If broken:** `src/lib/notifications.ts` (creation), `src/app/api/notifications/` (dismiss/mark-read/stream routes), `src/app/notifications/page.tsx` (UI).

---

### Task 10: Admin upload, edit price, delist

**Fixtures:** admin account for upload; then hand the newly-created listing to a throwaway edit/delist cycle so it doesn't touch ash/misty's seed data at all.

**Test:**
- [ ] Log in as admin, go to `/upload`, fill out the full form for a brand-new card (pick a real TCG Player ID from `prisma/riftbound_cards_index.json` or just any Pokémon catalog entry already in the DB) including an actual image file upload (use any file under `public/seed-images/` as the upload source). Submit.
- [ ] Confirm via DB: a new `Listing` row exists with the right price/condition, and its `imageUrls` points at a real Supabase Storage URL (not a broken/local path) — fetch that URL directly with `curl -I` and confirm it 200s.
- [ ] Confirm the new listing actually appears in the marketplace / on the catalog card's detail page.
- [ ] Edit the price on this same listing (as admin, since admin owns it) via whatever "Edit Price" UI exists (`EditPriceDialog` component) — confirm the new price persists in Postgres and updates in the UI.
- [ ] Delist it (toggle `forSale` off, or whatever the real UI control is called) — confirm it disappears from marketplace browse/search while still appearing in admin's own My Collection.

**If broken:** upload route/page — search `src/app/upload/`; edit price — `src/app/shared-components/cards/EditPriceDialog.tsx` and its API route.

---

### Task 11: Cross-cutting — responsiveness, empty/error states, footer

**Fixtures:** read-only, any account.

**Test:**
- [ ] Resize the Playwright viewport to a phone width (390×844) and re-visit `/`, `/marketplace`, a card detail page, and `/cart`. Confirm no horizontal overflow/clipped content and that the navbar's mobile behavior (from earlier tonight's responsive-navbar fix) actually holds up — wordmark hidden, no cramped overlap.
- [ ] Trigger at least one real error state deliberately: e.g. request a card detail page with a made-up UUID (`/cards/00000000-0000-0000-0000-000000000000`) and confirm it shows a proper "not found" state, not a raw stack trace or infinite spinner.
- [ ] Open the footer's "Terms of Use" modal — confirm it opens, has real content, and closes cleanly (both via its close button and via clicking outside/Escape if that's supported).
- [ ] Re-scan console errors/warnings across all pages visited in every task so far (grep each task's report for anything logged) and consolidate any new ones not already known (the pre-existing 3 minor issues were already fixed earlier tonight — this checks for anything *new*).

**If broken:** fix in place; this task's bugs could be anywhere, so document the file you end up in.

---

## Self-Review

**Spec coverage:** every feature area named in this conversation tonight — signup, login/logout/profile, marketplace browse/search/filter/card-detail, watchlist, my-collection/binders, cart, single-item checkout, multi-item checkout, offers (accept + decline), auctions (bid + outbid + buy-out + settlement + expiry), every notification type + dismiss/read/live-update, admin upload + edit price + delist, and cross-cutting responsiveness/error-states — has an assigned task above. Email sending (Resend) is deliberately **not** a task: there is no way to inspect actual email delivery from this environment (no inbox access), so it stays a permanent "needs human verification" item rather than a task that would just restate that limitation.

**Placeholder scan:** every task above names its exact fixtures (specific card names, specific buyer/seller pairs) and the exact file areas to fix if something breaks — no task says "similar to Task N" or leaves a TODO.

**Fixture collision check:** Task 5 uses "Psyduck"; Task 6 uses "Starmie GX" + "Gyarados VMAX" (misty→ash); Task 7 uses "Venusaur V" + "Blastoise Holo Rare" (ash→misty, offers); Task 8 uses "Blastoise Holo Rare" (ash's *auction*, a completely separate row from Task 7's *listing* of the same card name — confirmed no overlap since one is an `Auction` and the other a plain `Listing`) + "Gyarados VMAX" (misty's *auction* — separate row from Task 6's *listing* of the same name) + "Charizard VMAX" (ash's already-expired auction, untouched by any other task). No two tasks mutate the same database row.
