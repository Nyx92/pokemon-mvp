# Marketplace Pagination, Filters & Search — Design

**Date:** 2026-08-22
**Status:** Draft, pending approval

## Problem

`GET /api/cards?forSale=true` returns every for-sale `Listing` in the database, unpaginated (`src/app/api/cards/route.ts`), and `MarketPlace.tsx` renders every one of them into the DOM at once with no virtualization. At the current data volume (~1,300+ Riftbound listings from the recent bulk seed, plus the existing Pokémon listings), this is slow to load and slow to render. There is also no way to filter by game/set/rarity/type — the search box (`fuse.js`, client-side, over the full in-memory list) is the only way to narrow results.

## Goals

- Paginate the marketplace so the browser never fetches or renders the entire catalog at once.
- Add a left-sidebar filter panel: Game (Pokémon/Riftbound) as the top-level facet, then Set and Rarity (both games), and Type (Riftbound only) beneath it — with live counts from actual current inventory, not a static list that might filter to zero results.
- Keep fuzzy name search working across the *entire* catalog, not just the currently-loaded page, without standing up a dedicated search backend (confirmed appropriate for the current ~1,300–2,000 row scale; revisit if the catalog grows an order of magnitude).
- Let filters and search compose (e.g. search "char" + filter to Rare Holo only).

## Non-goals

- Any caching layer (HTTP cache headers, stale-while-revalidate, etc.) — explicitly deferred; revisit after seeing real performance with pagination alone.
- A dedicated search backend (Postgres `pg_trgm`, Elasticsearch, Algolia, etc.) — not justified at this data volume.
- List virtualization (`react-window` etc.) — pagination directly bounds how many DOM nodes exist at once, making this unnecessary for now.
- Cross-facet dynamic recount (e.g. selecting a rarity narrowing the Set list's counts further) — facets recompute when the Game selection changes, not on every other filter change. Real marketplaces do this, but it's meaningfully more backend work for a small catalog.
- A Supertype filter — Type alone covers the requested "main breakdowns"; the client-side facet computation (below) would make adding Supertype later trivial if wanted.
- Changing `MyCollection.tsx`'s search, or any other consumer of `GET /api/cards` (e.g. `AllListings.tsx`) — see Compatibility below.

## Design

### Key refinement over the earlier discussion: one lightweight endpoint, not two

Originally discussed as two separate pieces (a text-only "search index" for `fuse.js`, and a server-computed "facets" endpoint with counts). In practice both need nearly the same underlying data — every for-sale listing's `{id, title, setName, rarity, type, game}` — so they're now **one new endpoint**, and facet counts are computed **client-side** from that same array (a trivial `reduce` over ~1,300–2,000 small objects), not via a separate server-side aggregation query. This avoids Prisma's awkwardness grouping by a related model's field (`setNameEn`/`setLabel` live on the catalog relation, not `Listing` itself) and avoids fetching the same rows twice.

### Data flow

1. **On marketplace page load**, two requests fire in parallel:
   - `GET /api/cards/browse-index` (new) — the full for-sale catalog's lightweight fields, all games. Small payload (no images/price/description).
   - `GET /api/cards?forSale=true&page=1&pageSize=24` (extended) — the first page of full card data to actually render.
2. The page renders: sidebar filters (computed client-side from the browse-index, scoped to whichever game is selected), search box (ready), first page of cards.
3. **Search**: `fuse.js` runs against the in-memory browse-index (unchanged from today's pattern) → a ranked array of matching ids. The client slices this into pages of `pageSize` and requests `GET /api/cards?...&ids=<page's ids>` for full details of just that page's matches, then re-orders the response to match the original relevance ranking (Postgres does not preserve `id IN (...)` input order).
4. **Filter change** (game/set/rarity/type): re-request page 1 of `GET /api/cards` with the new filter params (and the current search's `ids` page, if search is active).
5. **"Load more"**: request the next `page` with the same filters/search active, append to what's shown.

### API changes

**`GET /api/cards/browse-index`** (new, public, no auth — matches `GET /api/cards`'s existing no-auth-required pattern for browsing)
Returns `{ items: [{ id, title, setName, rarity, type, game }] }` for every `forSale: true` listing across both games (`type` is `null`/absent for Pokémon rows). Built the same way `withListingDisplay` already resolves `title`/`setName`/`rarity`, projected down to just these fields before serializing.

**`GET /api/cards`** (extended)
New optional params, all backward-compatible (see Compatibility below):
- `game`: `"POKEMON" | "RIFTBOUND"`
- `setName`, `rarity`, `type`: repeatable (`?rarity=Rare&rarity=Rare+Holo`) — OR'd within a facet, AND'd across facets
- `ids`: repeatable — restricts to specific listing ids (used for search-result pages)
- `page` (default unset), `pageSize` (default unset)

Filter construction (avoids Prisma's `where.OR` overwrite problem when multiple facets are active):
```ts
const and: Prisma.ListingWhereInput[] = [];
if (forSale) and.push({ forSale: true });
if (game) and.push({ game });
if (ids.length) and.push({ id: { in: ids } });
if (setNames.length) and.push({
  OR: [
    { pokemonCard: { setNameEn: { in: setNames } } },
    { riftboundCard: { setLabel: { in: setNames } } },
  ],
});
if (rarities.length) and.push({
  OR: [
    { pokemonCard: { rarity: { in: rarities } } },
    { riftboundCard: { rarity: { in: rarities } } },
  ],
});
if (types.length) and.push({ riftboundCard: { type: { in: types } } });
const where = and.length ? { AND: and } : {};
```
`orderBy` becomes `[{ createdAt: "desc" }, { id: "asc" }]` — the current `createdAt`-only sort has no tiebreaker, and this app's bulk seed scripts (`createMany`) can produce rows with identical timestamps, which would make paginated results non-deterministic (a row could appear twice or be skipped across pages) without a fully unique sort key.

Response gains `totalCount` and `hasMore` fields alongside the existing `cards` array, computed only when `page`/`pageSize` are provided.

### Compatibility

`page`/`pageSize` are optional. **When neither is provided, behavior is unchanged from today — no limit, every matching row returned.** This is a deliberate compatibility guarantee for existing callers that don't opt into pagination: `AllListings.tsx` (`?tcgPlayerId=...&forSale=true`, naturally small result sets — every seller of one specific card) keeps working exactly as today. Only the rewritten `MarketPlace.tsx` will pass `page`/`pageSize` explicitly.

### Frontend changes

- **`src/lib/marketplaceFacets.ts`** (new, unit-tested): a pure function `computeFacets(items, selectedGame)` — groups the browse-index by set/rarity/(type if Riftbound), scoped to `selectedGame`, returns `{ sets: [{value, count}], rarities: [...], types: [...] }` sorted by count descending. No component-test infra needed since this is plain data transformation, consistent with how other pure logic was extracted and tested this session.
- **`src/app/marketplace/FilterSidebar.tsx`** (new): collapsible sections — Game (radio: Pokémon/Riftbound/All), Set (checkboxes w/ counts), Rarity (checkboxes w/ counts), Type (checkboxes w/ counts, shown only when Game = Riftbound). "Clear filters" control.
- **`MarketPlace.tsx`** (rewritten data-fetching): holds `browseIndex`, `filters` (game/setNames/rarities/types), `searchQuery`, `page`, `cards`, `hasMore`. Fetches browse-index once; fetches/refetches `GET /api/cards` page 1 whenever filters or search change; "Load more" fetches the next page and appends. Search-mode pagination slices the client-side matched-id array rather than relying on server `totalCount`/`hasMore` (already known from the array length).

### Error handling

- `browse-index` fetch failure: search and filter counts degrade gracefully (sidebar shows a small inline "filters unavailable" notice, search box disabled) — the main paginated browse list is a separate fetch and keeps working regardless.
- `GET /api/cards` fetch failure: unchanged from today's existing error-state handling in `MarketPlace.tsx`.

### Testing

- Backend (TDD, matching this session's established pattern): the `GET /api/cards` filter-building logic (AND/OR composition across facets, `ids` filtering, deterministic `orderBy`, pagination math, backward-compatible no-page-params behavior) and the new `browse-index` route.
- Frontend: `computeFacets` unit-tested directly (pure function, no DOM needed). `MarketPlace.tsx`/`FilterSidebar.tsx` themselves: backend TDD + manual browser check, per this session's established decision (no component-test infra exists in this repo yet).
