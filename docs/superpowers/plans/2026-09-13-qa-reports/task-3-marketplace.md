# Task 3: Marketplace browse, search, filter, card detail

Actor: ash (ashketchum). Read-only task, no purchases/mutations performed.
Browser: playwright-core + cached Chromium, driven via scripts in
`.../scratchpad/pw-check/` (`task3-final.mjs`, `task3-verify-fix.mjs`,
`task3-search-focus.mjs`, `task3-detail-debug.mjs`). DB checks via throwaway
`tsx` scripts per the shared pattern (created and deleted, not left behind).

## Tested

- **POKEMON tab renders real cards.** `/marketplace` default view shows
  listings with images, `S$` prices, and condition badges (15 `<img>`s, 14
  price strings on page 1).
- **RIFTBOUND tab renders real cards.** Switching the game toggle shows
  Riftbound listings (Yasuo, Lee Sin, Darius, Ahri, Jinx, Kai'Sa, etc. from the
  `Origins` set) with images, prices, and condition badges (`DMG`, `MP`, `NM`,
  `HP` pills from `ConditionBadge.tsx`). DB check: `Listing.count({ game:
  "RIFTBOUND", forSale: true })` = **1304**, confirming the "~1300 seeded
  listings" fixture assumption and that the tab isn't just showing a handful
  of rows.
- **Search "Gyarados"** (POKEMON tab): after the browse-index loads and the
  fetch settles, exactly the Gyarados VMAX listings render (6 tiles, "Gyarados"
  mentioned 6 times on the page). DB cross-check: `Listing.count({ forSale:
  true, game: "POKEMON", ownerId: { not: ash }, pokemonCard: { nameEn: {
  contains: "Gyarados" } } })` = **6** — exact match.
- **Search gibberish "zzzxxxqqq123"**: renders the "No cards match your
  filters." empty state (from `MarketPlace.tsx`'s `EmptyState` branch), not a
  crash or infinite spinner, once the fetch/index settle.
- **Combined Set + Rarity filter** (RIFTBOUND, Set=`Unleashed`, Rarity=`Rare`):
  paginated through all "Load more" pages (3 clicks, 4 pages of 24 = 96 raw
  rows fetched) and counted rendered tiles by their per-card watchlist
  bookmark icon. Raw count was 44, but the marketplace intentionally hides
  the viewer's own listings (documented quirk), and the navbar itself has its
  own bookmark/watchlist icon that matched the same selector — accounting for
  both, the true tile count is 44 − 1 (navbar icon) = 43. DB cross-check:
  `Listing.count` with the identical `AND` clause used by
  `getListingsPage`/`listingsQuery.ts` (`forSale: true`, `game: "RIFTBOUND"`,
  `riftboundCard.setLabel in ["Unleashed"]`, `riftboundCard.rarity in
  ["Rare"]`) gives **total 96, ash-owned 53, non-ash 43** — exact match with
  what rendered. Filters compose correctly (AND, not OR) and pagination
  doesn't drop or duplicate rows.
- **Riftbound card detail page** (`/cards/c766d89f-2ef9-4720-a95b-60480c4c2a64`,
  "Fury Rune", tcgPlayerId `706028`, owned by misty, not ash — a genuine
  non-owner view): title, card metadata, per-condition price tiers (only
  "Heavily Played" populated at S$16.43, others "—", matching the one real
  listing), "1 Listing" `AllListings` section with the correct
  condition/price row, and the `CardMarketChart` component all render.
  The price chart correctly falls back to "No price data available for this
  card" — this is expected, not a bug: `/api/pricetracker/[tcgId]` calls the
  external `pokemonpricetracker.com` API, which has no data for Riftbound's
  own tcgPlayerId numbering scheme. No console errors, no 5xx responses
  during any of this (confirmed via `page.on("console"/"response")`
  listeners across the whole run).
- **Console/network check across every step above**: zero console errors,
  zero pageerrors, zero 5xx responses collected by the harness's error
  listener for the entire test run.

## Found & Fixed

**Bug:** The `/marketplace` page subtitle was hardcoded to "Browse and buy
Pokémon cards listed by other collectors." regardless of which game tab
(POKÉMON vs. RIFTBOUND) was selected. With Riftbound now a first-class
marketplace game with ~1300 listings (far more than Pokémon's 28), this copy
was actively misleading on the Riftbound tab — a QA-relevant finding straight
out of this task's remit ("browse the RIFTBOUND tab specifically").

**Root cause:** `src/app/marketplace/MarketplacePageShell.tsx` renders this
subtitle as static text. It's a separate client component from
`MarketPlace.tsx` (split apart deliberately, per the file's own header
comment, so `page.tsx` can stay a Server Component) and has no access to the
`filters.game` state that lives inside `MarketPlace.tsx` — so it can't easily
be made dynamic without new state-lifting/context plumbing, which would be a
bigger change than this bug warrants.

**Fix:** Made the copy itself game-neutral instead of tab-conditional (no new
abstraction, minimal change):

```diff
- Browse and buy Pokémon cards listed by other collectors.
+ Browse and buy Pokémon and Riftbound cards listed by other collectors.
```

File: `src/app/marketplace/MarketplacePageShell.tsx`.

**Verification:**
- `npx tsc --noEmit` — clean, no errors.
- `npx vitest run` — full suite, 432/432 passed (50 files), matching the
  pre-fix baseline (this file has no associated unit test; change is
  copy-only).
- Re-loaded `/marketplace` in a real browser as ash, confirmed the new text
  renders on both the POKÉMON tab and after switching to RIFTBOUND, with zero
  console errors (`task3-verify-fix.mjs`).

No other bugs found in this task's scope. Search, filters (including
composed multi-facet filters), pagination, both game tabs, and the Riftbound
card detail page all matched direct Postgres queries exactly.

## Needs Human Verification

- **Nothing functionally broken was left unverified** in this task's scope.
- **Shared dev server load**: partway through this task, the dev server
  became very slow (a plain `curl` to `/auth/login` took 47s at one point),
  almost certainly from other QA tasks running Stripe checkout/offer/auction
  flows in parallel against the same server. All findings above were
  confirmed with DB cross-checks taken when the server was responsive; if a
  human re-runs these checks while other tasks are still mid-flight, expect
  slow page loads that are environmental, not a regression.
- **Riftbound price history**: confirmed as an expected empty state (external
  pricetracker API doesn't cover Riftbound's tcgPlayerId scheme), not a bug —
  but worth a human glance if Riftbound price charts are ever expected to show
  real data (e.g. if the app later switches to a Riftbound-specific pricing
  source). Nothing to fix today.
