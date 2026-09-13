# Task 10: Admin upload, edit price, delist

Actor: admin (admin@pokemon.com). Fixtures created entirely fresh (no
ash/misty seed rows touched). Browser: `playwright-core` + cached Chromium,
driven via scripts in `.../scratchpad/pw-check/` (`task10-upload.mjs`,
`task10-full-flow.mjs`, `task10-edit-and-delist.mjs`, `task10-final-check.mjs`,
`task10-verify-search-fix.mjs`, etc.). DB checks via throwaway `tsx` scripts
per the shared pattern (created and deleted each time, not left behind).

## Tested

- **Admin upload with a real image file.** Logged in as admin, went to
  `/upload`, filled the full POKEMON-game form (Game, TCG Player ID, Card
  Title, Set Name, Rarity, Card Number, Language, Price, Condition
  Type+Grade, Select Owner, For Sale?) and attached a real file
  (`public/seed-images/shuckle_psa10.png`) via the hidden `<input
  type="file">`. Submitted. UI showed the real success toast (`✅ Card "..."
  uploaded successfully!`).
  - DB confirms a new `Listing` row (id `884f9456-1a28-4517-b1ef-f3a1688db982`,
    title "QA Task10b Test Card") with `price: 3333` (cents), `condition:
    "Mint"`, `forSale: true`, `ownerId` = admin's id, and `imageUrls` pointing
    at a real Supabase Storage URL.
  - `curl -I` on that exact URL returns `HTTP/2 200`, `content-type:
    image/webp`, real byte length — confirming the upload path's
    `compressCardImage`/`toWebpStoragePath` pipeline (PNG → compressed WebP)
    actually landed in Supabase Storage, not a broken/local path.
- **New listing appears in the marketplace and on the catalog detail page**
  (verified via the first upload of this run, id `d048fa71-...`, title "QA
  Task10 Test Card", before it was later purchased — see below): loading
  `/cards/<id>` as a different, non-owner user rendered the title, image,
  condition, price, and a correct "1 Listing" table row; loading
  `/marketplace` as ash (non-owner) with no search text showed exactly one
  matching tile with the right image/price/condition badge. Confirms the
  admin-upload → catalog-entry → listing → marketplace pipeline all works
  end-to-end, same code path used for both listings created in this task.
- **Edit price (admin's real edit flow).** Per the actual routing in
  `src/app/cards/[id]/page.tsx`, `EditPriceDialog` is only ever mounted for a
  non-admin owner (`!isAdmin && isOwner`); an admin's "Edit" button on the
  BuyBox always routes to the full `/cards/[id]/edit` page (`UploadCard` with
  `initialData`), which is the real admin edit-price path. Drove that: opened
  `/cards/884f9456.../edit`, changed price from `33.33` → `77.77`, submitted,
  got the "updated successfully" message. DB confirms `price: 7777` (cents),
  `forSale` unchanged (`true`), `ownerId` unchanged.
- **Delist.** On the same listing/edit page, changed "For Sale?" from "Yes —
  List for Sale" to "No — Collection Only" (there's no separate "Delist"
  button — this selector plus Save is the real delist mechanism for the
  admin edit form) and submitted. DB confirms `forSale: false`, `price:
  null`, `ownerId` unchanged (still admin) — matches this route's own
  intentional invariant (`price` is cleared whenever `forSale` is false).
  - Confirmed hidden from marketplace: `GET /api/cards?forSale=true` (the
    exact query the marketplace grid uses) does not include this listing;
    loading `/marketplace` as ash with no search shows 0 tiles for its title.
  - Confirmed still visible in admin's own `/myCollection` (1 matching tile,
    labeled "Not for sale").

## Found & Fixed

**Bug (discovered while confirming the new listing showed up in the
marketplace — file is nominally Task 3's assigned area, not Task 10's, but
I was told to make sure any real bug found along the way gets fixed, so I
fixed it in place rather than only reporting it):**

Typing into the marketplace search box (`src/app/marketplace/MarketPlace.tsx`)
had two related, same-root-cause problems, both only visible with realistic
multi-keystroke typing (a single one-shot `.fill("query")` — which is how
Task 3's own search testing exercised it — only ever fires one fetch, so it
never triggered this):

1. **Search results could reflect a stale, earlier keystroke.** The data-fetch
   `useEffect` (keyed on `[filters, search, searchAwaitingIndex]`) fired a new
   `fetch(/api/cards?...)` on every keystroke with no `AbortController` and no
   request-sequencing, so a broader/earlier keystroke's response could resolve
   *after* a later, narrower keystroke's response and clobber it via a plain
   `setCards(...)` replace. Concretely: after typing a full multi-word search,
   the grid could still show the full unfiltered marketplace (matching an
   earlier, near-empty partial query) instead of the actual narrow match.
2. **A tile could render twice.** The grid's `AnimatePresence` remount was
   keyed on the raw `search` string (`key={search}`), so it unmounted/remounted
   (with a 150ms exit / 300ms enter animation) on every keystroke. Typing
   faster than that animation cycle let one generation's exit animation still
   be mounted when the next generation entered, so a listing matching both
   the outgoing and incoming query briefly rendered as two identical tiles.

I confirmed both live: uploading "QA Task10 Test Card" and then searching
`/marketplace` for it as ash showed the tile rendered **twice**, and the grid
otherwise showed the full unfiltered card list (Psyduck, Gyarados VMAX,
Starmie GX, etc.) regardless of the typed query — not a debounce-timing
issue (there is no debounce in this codebase at all; confirmed via grep).

**Root cause / fix** — `src/app/marketplace/MarketPlace.tsx`:
- Added an `AbortController` around the per-keystroke `fetch`, aborted on the
  next effect run (or unmount) via the effect's cleanup function, and ignored
  `AbortError` in `.catch`/`.finally` so an aborted request neither flips
  `fetchError` nor prematurely clears `loading`. This is the same
  cancel-stale-request idiom already used elsewhere in this codebase (the
  catalog-lookup effect in `src/app/upload/UploadCard.tsx`).
- Replaced `key={search}` with a new `gridKey` counter state that only
  increments when a fetch actually resolves (settles) and its result is
  applied to `cards` — so the AnimatePresence remount/animation-replay now
  happens once per *settled* query, never once per keystroke, eliminating the
  overlapping-generations duplicate-render window.

**Verification:**
- `npx tsc --noEmit` — clean.
- `npx vitest run` — full suite, 432/432 passed (50 files), no regressions.
- Re-tested live in a real browser: typed "Psyduck" character-by-character
  (60ms/keystroke, the exact pattern that used to race) into `/marketplace`'s
  search box as ash. Result: exactly the 3 real Psyduck-family listings
  render, no duplicates, and no unrelated cards (Gyarados VMAX / Starmie GX)
  leak through — confirmed both by screenshot and by a `getByText` count.

**Side effect this bug caused during this very session:** my first
admin-uploaded test listing ("QA Task10 Test Card", id `d048fa71-...`,
$42.50, owned by admin) was legitimately purchased by ash mid-task — real
`Order` (status `PAID`) and `CardTransaction` rows exist for it, with a real
Stripe PaymentIntent. I never drove any "Buy Now"/checkout flow against it
myself. The far more likely explanation is that this search bug's unfiltered/
duplicated grid caused a different concurrently-running QA task's buyer-side
automation (buyer = ash, per this session's fixture assignments) to click the
wrong tile off a search result that should have been narrowly filtered to its
own intended card. I did not undo that purchase (Task 10 doesn't own that
row, and reversing a real completed Stripe-backed sale is out of scope for a
QA sweep) — flagging this clearly below and leaving it as-is.

**Also cleaned up (not a bug, my own testing artifact):** an interrupted
early run of the upload script had the browser closed client-side before the
success response arrived, but the server-side create had already completed —
this silently left a second, orphaned duplicate listing also titled "QA
Task10 Test Card" (id `0ee9e51e-...`, forSale true, $42.50, admin-owned). I
delisted it via the real admin edit UI (same mechanism verified above) so it
doesn't linger in the marketplace as a purchasable phantom for other
concurrent tasks. Final DB state: `forSale: false`, `price: null`.

## Needs Human Verification

- **Cross-task note for whoever owns Task 3 / the marketplace search area:**
  the search race-condition + duplicate-tile fix above lives in
  `src/app/marketplace/MarketPlace.tsx`, which Task 3's report
  (`task-3-marketplace.md`) already covers and marked complete/clean. Task
  3's own testing used single-shot `.fill()` calls, which never exercises the
  multi-request race, so its "no bugs found" conclusion for search isn't
  contradicted by this — but a human (or Task 3, if re-run) may want to
  re-confirm search behavior under realistic fast typing now that this fix is
  in, since I made a code change to a file that task had already signed off
  on.
- **The accidental sale of the `d048fa71-...` "QA Task10 Test Card" listing to
  ash** (see above) is a real, unplanned side effect from this session's
  concurrent parallel-task load interacting with the search bug, not
  something Task 10 caused or can clean up within its own scope (reversing a
  completed paid Stripe order isn't something a QA task should do
  unilaterally). A human may want to glance at `Order` id
  `3d6d3b14-5003-4d84-b0bd-a9cdc1badddf` / PaymentIntent
  `pi_3UEwjtAVU8YI57Gn3niNr7Cq` just to confirm nothing else looks odd about
  it (it looked like an entirely normal, successful test-mode purchase in
  every other respect: `Order.status: PAID`, ownership transferred, a
  `CardTransaction` row created).
- Everything else in this task's own scope (upload with a real image file,
  Supabase Storage delivery, marketplace/detail visibility, price edit,
  delist, and delist's marketplace-vs-My-Collection visibility split) was
  verified directly against Postgres and is working as intended — nothing
  else to flag for manual re-check.
