# Task 4: Watchlist and My Collection (binders, filters)

Actor: ash (ashketchum). Fixture card: Riftbound listing `c766d89f-2ef9-4720-a95b-60480c4c2a64`
("Fury Rune"), owned by misty — chosen because ash doesn't own it, avoiding the
"can't watchlist your own card" rule. Driven with `playwright-core` against the
cached Chromium binary per the plan's Shared Setup; verified against Postgres
directly via throwaway `tsx` scripts, not just the UI.

## Tested

- **Watchlist add/remove, full round trip.** Logged in as ash, opened
  `/cards/c766d89f-...`, clicked "Add to watchlist". Confirmed via direct DB
  query (`prisma.cardWatchlist.count`) that a row was created (0 → 1).
  Navigated to `/watchlist` — the card appeared ("Fury Rune"). Clicked
  "Remove from watchlist" on the tile; DB count went back to 1 → 0, and the
  page correctly rendered the empty state ("No cards saved yet" with a
  "Browse cards" CTA). No console errors during any of this.

  Note: while iterating on this, I hit a lot of apparent flakiness (badge
  count not updating, watchlist page briefly showing empty right after an
  add) that turned out to be caused by (a) the shared dev server being under
  heavy load from the other QA tasks running in parallel tonight (one plain
  `curl http://localhost:3000/` took 48s at one point), and (b) my own edits
  triggering webpack Fast Refresh mid-run. Neither was a real app bug —
  confirmed by re-running the same flow once the server settled, with
  DB-state polling instead of fixed timeouts, and getting clean, repeatable
  results every time (see "Found & Fixed" for the one real bug this
  digging did turn up).

- **My Collection lists ash's own cards.** `/api/user/cards` returns every
  `Listing` with `ownerId = ash.id`. UI tile count matched a direct
  `prisma.listing.count({ where: { ownerId } })` query to within 1 (683 UI vs
  684 DB at the moment of comparison) — the 1-off gap is expected, not a bug:
  Tasks 5-8 were actively transferring listing ownership to ash via real
  purchases/offers/auctions in the same shared database at the same time I
  ran this check. Re-querying the DB a few seconds later showed the count
  still climbing (684 → more), confirming it was a live race between
  concurrent tasks, not a stale/incorrect UI fetch.

- **All / For Sale / In Auction / Sold toggle**, cross-checked against direct
  DB queries filtered the same way:
  - All: UI tiles ≈ DB `count({ ownerId })` (see race-condition note above).
  - For Sale: UI tiles = 667, DB `count({ ownerId, forSale: true })` = 667. Exact match.
  - In Auction: UI tiles = 4, DB `count({ ownerId, inAuction: true })` = 4. Exact match.
  - Sold: UI tiles = 0, and correctly renders "No cards match your filters"
    (not an error/crash). This is expected given the data model: `CardItem.status`
    has no backing column on `Listing` (see the deliberate comment block in
    `src/lib/listingsQuery.ts` explaining `status: "available" as const` is a
    fixed default) and `/api/user/cards` never sets `status` on its response at
    all, so `product.status === "sold"` in `MyCollection.tsx` can never be true.
    This is also self-consistent with the ownership model: once a listing is
    actually sold, `ownerId` transfers away from the seller, so it would drop
    out of `/api/user/cards` for that user entirely — there is no real
    DB-queryable definition of "one of my listings that is sold" for this
    schema today. Flagged below under Needs Human Verification since it's a
    pre-existing, documented design limitation rather than something this
    task's fix scope covers.

## Found & Fixed

### Bug 1 (real, functional): "Create Binder" never persisted to Postgres — entirely client-only fake state

**Symptom:** `MyCollection.tsx`'s `handleCreateBinder` only ever did
`setBinders([...binders, { id: slugified-name, name }])` — pure React state,
no `fetch` call anywhere. The binder list shown in the dropdown was also
entirely *derived* from `card.binder` on the already-fetched cards array, so
even a real binder with zero cards could never appear. Net effect: creating a
binder looked like it worked in the UI for the current page load, but no
`Binder` row was ever written to Postgres, the "binder" vanished on reload,
and it could never be assigned to any card since there was no ID any backend
route recognized. There was also no API route anywhere under `src/app/api`
for creating a binder, despite the `Binder` Prisma model already existing
(`schema.prisma:120`) with a real `userId` relation and `Listing.binderId`
already wired up on the read side.

**Root cause:** the binder-creation feature was never wired to the backend
at all — no route, no persistence, no server-sourced binder list.

**Fix:**
1. Added `src/app/api/binders/route.ts` — `GET` (list the current user's
   binders, `{ id, name }[]`, ordered by `createdAt`) and `POST` (create a
   new binder for the current user; 400 on missing/empty name; 400 with
   "Binder name already exists" on a case-insensitive duplicate for that
   user, same rule the old client-only code enforced). Follows this
   codebase's existing route conventions exactly (`getServerSession` /
   `authOptions` auth guard, `NextResponse.json`, error-shape matching
   `src/app/api/cart/route.ts` and `src/app/api/watchlist/route.ts`).
2. `src/app/myCollection/MyCollection.tsx`:
   - Added a second `useEffect` that fetches `/api/binders` independently of
     the cards fetch (a fresh, empty binder has no cards to derive it from —
     it needs its own source of truth).
   - Rewrote `handleCreateBinder` to be async and `POST /api/binders`,
     surfacing the server's error message via the existing `alert()`
     convention used elsewhere in this codebase for exactly this class of
     inline error (see `src/app/auth/signup/page.tsx`,
     `src/app/upload/UploadCard.tsx`), and appending the real
     server-returned `{ id, name }` (a UUID, not a client-side slug) to
     state on success.

**Verified:** ran the real flow end to end after the fix — logged in as ash,
opened the binder dropdown, clicked "Create New Binder", typed a unique
name, clicked "Create". Confirmed via direct Postgres query that a `Binder`
row now exists with that exact name and `userId = ash.id`. Confirmed the
dropdown shows the new binder (screenshot:
`task4-C-binder-created.png` in this session's scratchpad). Selected it and
confirmed the grid correctly shows "No cards match your filters" (empty,
no error) rather than crashing — screenshot `task4-D-empty-binder-filter.png`.
Cleaned up the throwaway QA binder row afterward so it doesn't linger in
seed data. `npx tsc --noEmit` — clean. `npx vitest run` — all 432 tests
still pass (50 files).

### Bug 2 (minor, real): `/watchlist` could flash the wrong empty state on load

**Symptom:** while investigating the flakiness described above, found that
`src/app/watchlist/page.tsx` initialized `const [loading, setLoading] =
useState(false)`. Since `cards` also starts as `[]`, there is a real
(if normally sub-frame, easy to miss) window on every mount — right after
the auth gate clears and before the fetch effect's own `setLoading(true)`
takes effect — where the component renders `cards.length === 0 && !loading`
and shows the "No cards saved yet" empty state, even though data hasn't
been fetched yet. Under this session's heavy concurrent server load this
window became long enough to actually observe in a real browser (not just
theoretically), and it's inconsistent with the sibling `MyCollection.tsx`,
which already initializes `loading` to `true` for the exact same
fetch-on-mount pattern.

**Fix:** changed `useState(false)` to `useState(true)` for `loading` in
`src/app/watchlist/page.tsx`, matching `MyCollection.tsx`'s convention, with
a comment explaining why.

**Verified:** `npx tsc --noEmit` clean; `npx vitest run` — all 432 tests
still pass (no existing test covered this page, and none needed to for a
one-line initial-state fix). Re-ran the live add/remove flow afterward
(see "Tested" above) — the empty state now only ever appears once, exactly
when it should (after removal), not spuriously on mount.

## Needs Human Verification

- **The "Sold" toggle in My Collection is currently a permanent no-op** (see
  above) — not a bug introduced or fixed by this task, but worth a human
  decision: does this app want a real "listings I used to own that sold"
  view? That would need an actual sold-history model (e.g. querying
  `CardTransaction` by `sellerId` instead of filtering the current
  `ownerId`-scoped `/api/user/cards` result by a `status` field that has no
  backing column). Out of scope for this QA pass since it's a
  documented, deliberate limitation already called out in
  `src/lib/listingsQuery.ts`'s comments, not a regression.
- No other open items from this task — watchlist add/remove/empty-state,
  My Collection's card listing, binder creation + empty-binder filtering,
  and the All/For Sale/In Auction toggles all verified working against the
  real Postgres database.
