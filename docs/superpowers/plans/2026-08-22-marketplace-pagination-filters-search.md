# Marketplace Pagination, Filters & Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Paginate the marketplace's card listing, add a left-sidebar filter panel (Game/Set/Rarity/Type with live counts), and keep fuzzy name search working across the whole catalog without fetching everything at once.

**Architecture:** `GET /api/cards` gains optional pagination (`page`/`pageSize`, backward-compatible — omitting them preserves today's unpaginated behavior) and filter params (`game`/`setName`/`rarity`/`type`/`ids`). A new lightweight `GET /api/cards/browse-index` endpoint returns `{id, title, setName, rarity, type, game}` for every for-sale listing; the frontend runs the existing `fuse.js`-based search against that in-memory index and computes filter-sidebar facet counts from it client-side (no new server-side aggregation).

**Tech Stack:** Next.js route handlers, Prisma, Vitest, React/MUI (existing stack — no new dependencies).

**Spec:** `docs/superpowers/specs/2026-08-22-marketplace-pagination-filters-search-design.md`

## Global Constraints

- `GET /api/cards` must return identical behavior to today (no limit, every matching row) when `page`/`pageSize` are both omitted — `AllListings.tsx` and any other undiscovered caller must keep working unchanged.
- `orderBy` must be `[{ createdAt: "desc" }, { id: "asc" }]` (not `createdAt` alone) so paginated results are deterministic even when multiple rows share a timestamp (seed scripts' `createMany` calls can produce this).
- Facet filters combine as AND-across-facets, OR-within-a-facet (e.g. `rarity=Rare&rarity=Rare+Holo` matches either; adding `game=POKEMON` narrows further).
- No new npm dependencies, no caching layer, no list virtualization — out of scope per the spec's Non-goals.
- `GET /api/cards` and `GET /api/cards/browse-index` are public (no auth) — matches today's existing no-auth-required pattern for browsing.

---

## File Structure

- **Modify** `src/app/api/cards/route.ts` — `GET` handler gains filters + pagination.
- **Create** `src/__tests__/api/cards/get-cards.test.ts` — new test file for the `GET` handler (mirrors this directory's existing per-verb-file convention: `get-card.test.ts`/`put-card.test.ts` for `[id]`, so `route.test.ts` stays POST-only).
- **Create** `src/app/api/cards/browse-index/route.ts` — new lightweight endpoint.
- **Create** `src/__tests__/api/cards/browse-index.test.ts`.
- **Modify** `src/types/card.ts` — add `CardBrowseIndexItem`.
- **Create** `src/lib/marketplaceFacets.ts` — pure `computeFacets` function.
- **Create** `src/__tests__/lib/marketplaceFacets.test.ts`.
- **Create** `src/app/marketplace/FilterSidebar.tsx` — new sidebar component.
- **Modify** `src/app/marketplace/MarketPlace.tsx` — rewire data-fetching for pagination/filters/search.

---

### Task 1: Filter params on `GET /api/cards` (no pagination yet)

**Files:**
- Create: `src/__tests__/api/cards/get-cards.test.ts`
- Modify: `src/app/api/cards/route.ts:19-65`

**Interfaces:**
- Produces: `GET /api/cards` accepts existing `forSale`, `tcgPlayerId`, plus new repeatable `game`, `setName`, `rarity`, `type`, `ids` query params. Response shape unchanged this task: `{ cards: CardItem[] }`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/__tests__/api/cards/get-cards.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  listing: { findMany: vi.fn(), count: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/cards/route";

function cardsRequest(query: string) {
  return new Request(`http://localhost/api/cards${query}`);
}

const POKEMON_LISTING = {
  id: "listing-1",
  price: 5000,
  game: "POKEMON",
  createdAt: new Date("2026-01-01"),
  pokemonCard: {
    nameEn: "Charizard", rarity: "Rare Holo", setNameEn: "Base Set",
    language: "English", localId: "004", tcgPlayerId: "tcg-1",
  },
  riftboundCard: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.listing.findMany.mockResolvedValue([POKEMON_LISTING]);
  mockPrisma.listing.count.mockResolvedValue(1);
});

describe("GET /api/cards — filters", () => {
  it("applies no filter (AND array empty) when no query params are given", async () => {
    await GET(cardsRequest(""));
    expect(mockPrisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });

  it("keeps the existing forSale=true behavior", async () => {
    await GET(cardsRequest("?forSale=true"));
    const call = mockPrisma.listing.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ AND: [{ forSale: true }] });
  });

  it("keeps the existing tcgPlayerId OR-across-games behavior", async () => {
    await GET(cardsRequest("?tcgPlayerId=tcg-1"));
    const call = mockPrisma.listing.findMany.mock.calls[0][0];
    expect(call.where).toEqual({
      AND: [{
        OR: [
          { pokemonCard: { tcgPlayerId: "tcg-1" } },
          { riftboundCard: { tcgPlayerId: "tcg-1" } },
        ],
      }],
    });
  });

  it("filters by game", async () => {
    await GET(cardsRequest("?game=RIFTBOUND"));
    const call = mockPrisma.listing.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ AND: [{ game: "RIFTBOUND" }] });
  });

  it("ignores an unrecognized game value rather than erroring", async () => {
    await GET(cardsRequest("?game=MAGIC"));
    const call = mockPrisma.listing.findMany.mock.calls[0][0];
    expect(call.where).toEqual({});
  });

  it("filters by one or more setName values, OR'd across both games' set fields", async () => {
    await GET(cardsRequest("?setName=Base+Set&setName=Jungle"));
    const call = mockPrisma.listing.findMany.mock.calls[0][0];
    expect(call.where).toEqual({
      AND: [{
        OR: [
          { pokemonCard: { setNameEn: { in: ["Base Set", "Jungle"] } } },
          { riftboundCard: { setLabel: { in: ["Base Set", "Jungle"] } } },
        ],
      }],
    });
  });

  it("filters by one or more rarity values, OR'd across both games' rarity fields", async () => {
    await GET(cardsRequest("?rarity=Rare&rarity=Rare+Holo"));
    const call = mockPrisma.listing.findMany.mock.calls[0][0];
    expect(call.where).toEqual({
      AND: [{
        OR: [
          { pokemonCard: { rarity: { in: ["Rare", "Rare Holo"] } } },
          { riftboundCard: { rarity: { in: ["Rare", "Rare Holo"] } } },
        ],
      }],
    });
  });

  it("filters by Riftbound type (no Pokemon equivalent, so no OR needed)", async () => {
    await GET(cardsRequest("?type=Unit&type=Legend"));
    const call = mockPrisma.listing.findMany.mock.calls[0][0];
    expect(call.where).toEqual({
      AND: [{ riftboundCard: { type: { in: ["Unit", "Legend"] } } }],
    });
  });

  it("filters by a list of ids", async () => {
    await GET(cardsRequest("?ids=id-1&ids=id-2"));
    const call = mockPrisma.listing.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ AND: [{ id: { in: ["id-1", "id-2"] } }] });
  });

  it("combines multiple facets with AND", async () => {
    await GET(cardsRequest("?forSale=true&game=POKEMON&rarity=Rare"));
    const call = mockPrisma.listing.findMany.mock.calls[0][0];
    expect(call.where).toEqual({
      AND: [
        { forSale: true },
        { game: "POKEMON" },
        {
          OR: [
            { pokemonCard: { rarity: { in: ["Rare"] } } },
            { riftboundCard: { rarity: { in: ["Rare"] } } },
          ],
        },
      ],
    });
  });

  it("orders by createdAt desc with id asc as a deterministic tiebreaker", async () => {
    await GET(cardsRequest(""));
    const call = mockPrisma.listing.findMany.mock.calls[0][0];
    expect(call.orderBy).toEqual([{ createdAt: "desc" }, { id: "asc" }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/__tests__/api/cards/get-cards.test.ts`
Expected: FAIL — `where` currently built without an `AND` wrapper and without `game`/`setName`/`rarity`/`type`/`ids` support; `orderBy` is currently `{ createdAt: "desc" }` (no array, no `id` tiebreaker).

- [ ] **Step 3: Implement the filter-building logic**

In `src/app/api/cards/route.ts`, replace the `GET` handler's `where` construction (currently lines ~21-36) with:

```typescript
import type { Prisma } from "@prisma/client";
// (add alongside the other existing imports at the top of the file)

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const forSaleParam = searchParams.get("forSale");
    const tcgPlayerIdParam = searchParams.get("tcgPlayerId");
    const gameParam = searchParams.get("game");
    const setNames = searchParams.getAll("setName");
    const rarities = searchParams.getAll("rarity");
    const types = searchParams.getAll("type");
    const ids = searchParams.getAll("ids");

    const and: Prisma.ListingWhereInput[] = [];
    if (forSaleParam === "true") and.push({ forSale: true });
    // tcgPlayerId now lives on whichever catalog a listing points to, not on
    // Listing itself — match either catalog relation since the caller has no
    // way to know which game a given tcgPlayerId belongs to.
    if (tcgPlayerIdParam) {
      and.push({
        OR: [
          { pokemonCard: { tcgPlayerId: tcgPlayerIdParam } },
          { riftboundCard: { tcgPlayerId: tcgPlayerIdParam } },
        ],
      });
    }
    if (gameParam === "POKEMON" || gameParam === "RIFTBOUND") {
      and.push({ game: gameParam });
    }
    if (ids.length > 0) and.push({ id: { in: ids } });
    if (setNames.length > 0) {
      and.push({
        OR: [
          { pokemonCard: { setNameEn: { in: setNames } } },
          { riftboundCard: { setLabel: { in: setNames } } },
        ],
      });
    }
    if (rarities.length > 0) {
      and.push({
        OR: [
          { pokemonCard: { rarity: { in: rarities } } },
          { riftboundCard: { rarity: { in: rarities } } },
        ],
      });
    }
    if (types.length > 0) {
      and.push({ riftboundCard: { type: { in: types } } });
    }

    const where: Prisma.ListingWhereInput = and.length > 0 ? { AND: and } : {};

    const listings = await prisma.listing.findMany({
      where,
      include: {
        binder: true,
        owner: { select: { id: true, username: true } },
        ...listingCatalogInclude,
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });

    const cardsForUi = listings.map((listing) => {
      const withDisplay = withListingDisplay(listing);
      return {
        ...withDisplay,
        price: withDisplay.price != null ? centsToDollars(withDisplay.price) : null,
      };
    });
    return NextResponse.json({ cards: cardsForUi });
  } catch (error: any) {
    console.error("❌ Error fetching cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch cards" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/__tests__/api/cards/get-cards.test.ts`
Expected: PASS, all 11 tests.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no new failures.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cards/route.ts src/__tests__/api/cards/get-cards.test.ts
git commit -m "feat: add game/setName/rarity/type/ids filters to GET /api/cards"
```

---

### Task 2: Backward-compatible pagination on `GET /api/cards`

**Files:**
- Modify: `src/__tests__/api/cards/get-cards.test.ts` (append tests)
- Modify: `src/app/api/cards/route.ts` (same `GET` handler, Task 1's version)

**Interfaces:**
- Consumes: the `where`/`orderBy` built in Task 1.
- Produces: response gains `totalCount: number` and `hasMore: boolean` **only when `page`/`pageSize` are both provided**. When neither is provided, response is `{ cards }` exactly as before (no `totalCount`/`hasMore` keys), and every matching row is returned.

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/api/cards/get-cards.test.ts`:

```typescript
describe("GET /api/cards — pagination", () => {
  it("returns every matching row with no totalCount/hasMore when page/pageSize are omitted (backward compatible)", async () => {
    const res = await GET(cardsRequest("?forSale=true"));
    const body = await res.json();

    const call = mockPrisma.listing.findMany.mock.calls[0][0];
    expect(call.skip).toBeUndefined();
    expect(call.take).toBeUndefined();
    expect(mockPrisma.listing.count).not.toHaveBeenCalled();
    expect(body).not.toHaveProperty("totalCount");
    expect(body).not.toHaveProperty("hasMore");
  });

  it("applies skip/take and returns totalCount/hasMore when page/pageSize are given", async () => {
    mockPrisma.listing.count.mockResolvedValue(50);

    const res = await GET(cardsRequest("?page=2&pageSize=24"));
    const body = await res.json();

    const call = mockPrisma.listing.findMany.mock.calls[0][0];
    expect(call.skip).toBe(24);
    expect(call.take).toBe(24);
    expect(body.totalCount).toBe(50);
    expect(body.hasMore).toBe(true); // page 2 of 24 = 48 seen so far, 50 total
  });

  it("reports hasMore: false on the last page", async () => {
    mockPrisma.listing.count.mockResolvedValue(50);

    const res = await GET(cardsRequest("?page=3&pageSize=24"));
    const body = await res.json();

    expect(body.hasMore).toBe(false); // page 3 of 24 = 72 seen, only 50 exist
  });

  it("treats page=1 as the first page (skip 0)", async () => {
    await GET(cardsRequest("?page=1&pageSize=24"));
    const call = mockPrisma.listing.findMany.mock.calls[0][0];
    expect(call.skip).toBe(0);
    expect(call.take).toBe(24);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/__tests__/api/cards/get-cards.test.ts`
Expected: FAIL — no `page`/`pageSize` handling exists yet.

- [ ] **Step 3: Implement pagination**

In `src/app/api/cards/route.ts`, modify the `GET` handler (building on Task 1's version) — replace the single `findMany` call and the response construction:

```typescript
    const where: Prisma.ListingWhereInput = and.length > 0 ? { AND: and } : {};

    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("pageSize");
    const page = pageParam ? parseInt(pageParam, 10) : null;
    const pageSize = pageSizeParam ? parseInt(pageSizeParam, 10) : null;
    const isPaginated =
      page != null && pageSize != null && !Number.isNaN(page) && !Number.isNaN(pageSize);

    const [listings, totalCount] = await Promise.all([
      prisma.listing.findMany({
        where,
        include: {
          binder: true,
          owner: { select: { id: true, username: true } },
          ...listingCatalogInclude,
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        ...(isPaginated ? { skip: (page! - 1) * pageSize!, take: pageSize! } : {}),
      }),
      isPaginated ? prisma.listing.count({ where }) : Promise.resolve(null),
    ]);

    const cardsForUi = listings.map((listing) => {
      const withDisplay = withListingDisplay(listing);
      return {
        ...withDisplay,
        price: withDisplay.price != null ? centsToDollars(withDisplay.price) : null,
      };
    });

    const body: { cards: typeof cardsForUi; totalCount?: number; hasMore?: boolean } = {
      cards: cardsForUi,
    };
    if (isPaginated && totalCount != null) {
      body.totalCount = totalCount;
      body.hasMore = page! * pageSize! < totalCount;
    }
    return NextResponse.json(body);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/__tests__/api/cards/get-cards.test.ts`
Expected: PASS, all 15 tests (11 from Task 1 + 4 new).

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no new failures.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cards/route.ts src/__tests__/api/cards/get-cards.test.ts
git commit -m "feat: add backward-compatible pagination to GET /api/cards"
```

---

### Task 3: `GET /api/cards/browse-index`

**Files:**
- Create: `src/app/api/cards/browse-index/route.ts`
- Create: `src/__tests__/api/cards/browse-index.test.ts`
- Modify: `src/types/card.ts`

**Interfaces:**
- Consumes: `listingCatalogInclude`, `resolveListingDisplay` from `@/lib/listingDisplay` (existing).
- Produces: `GET /api/cards/browse-index` → `{ items: CardBrowseIndexItem[] }`, one entry per `forSale: true` listing, both games. `CardBrowseIndexItem` (new, in `src/types/card.ts`): `{ id: string; title: string; setName: string | null; rarity: string | null; type: string | null; game: "POKEMON" | "RIFTBOUND" }`.

- [ ] **Step 1: Add the type**

In `src/types/card.ts`, append:

```typescript
// Lightweight per-card fields for the marketplace's client-side search
// index and filter-facet computation — deliberately excludes
// price/images/description to keep this endpoint's payload small.
export interface CardBrowseIndexItem {
  id: string;
  title: string;
  setName: string | null;
  rarity: string | null;
  type: string | null;
  game: "POKEMON" | "RIFTBOUND";
}
```

- [ ] **Step 2: Write the failing tests**

```typescript
// src/__tests__/api/cards/browse-index.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  listing: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/cards/browse-index/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/cards/browse-index", () => {
  it("only queries forSale listings", async () => {
    mockPrisma.listing.findMany.mockResolvedValue([]);
    await GET();
    expect(mockPrisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { forSale: true } })
    );
  });

  it("projects a Pokemon listing down to the lightweight fields, with type: null", async () => {
    mockPrisma.listing.findMany.mockResolvedValue([{
      id: "listing-1",
      game: "POKEMON",
      pokemonCard: {
        nameEn: "Charizard", rarity: "Rare Holo", setNameEn: "Base Set",
        language: "English", localId: "004", tcgPlayerId: "tcg-1",
      },
      riftboundCard: null,
    }]);

    const res = await GET();
    const body = await res.json();

    expect(body).toEqual({
      items: [{
        id: "listing-1",
        title: "Charizard",
        setName: "Base Set",
        rarity: "Rare Holo",
        type: null,
        game: "POKEMON",
      }],
    });
  });

  it("projects a Riftbound listing down to the lightweight fields, including type", async () => {
    mockPrisma.listing.findMany.mockResolvedValue([{
      id: "listing-2",
      game: "RIFTBOUND",
      pokemonCard: null,
      riftboundCard: {
        name: "Vi - Peacekeeper", rarity: "Rare", setLabel: "Unleashed",
        collectorNumber: "176", tcgPlayerId: null, type: "Unit", supertype: "Champion",
      },
    }]);

    const res = await GET();
    const body = await res.json();

    expect(body.items[0]).toEqual({
      id: "listing-2",
      title: "Vi - Peacekeeper",
      setName: "Unleashed",
      rarity: "Rare",
      type: "Unit",
      game: "RIFTBOUND",
    });
  });

  it("returns an empty items array when nothing is for sale", async () => {
    mockPrisma.listing.findMany.mockResolvedValue([]);
    const res = await GET();
    const body = await res.json();
    expect(body).toEqual({ items: [] });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/__tests__/api/cards/browse-index.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/cards/browse-index/route'`.

- [ ] **Step 4: Implement the route**

```typescript
// src/app/api/cards/browse-index/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listingCatalogInclude, resolveListingDisplay } from "@/lib/listingDisplay";
import type { CardBrowseIndexItem } from "@/types/card";

// GET /api/cards/browse-index
//
// Lightweight, public (no auth — matches GET /api/cards' existing
// no-auth-required browsing pattern), text-only projection of every
// for-sale listing. Feeds the marketplace's client-side fuzzy search
// (fuse.js, same pattern already used there) and filter-sidebar facet
// counts — deliberately excludes price/images/description to keep this
// small enough to fetch once per page load regardless of catalog size.
export async function GET() {
  try {
    const listings = await prisma.listing.findMany({
      where: { forSale: true },
      include: listingCatalogInclude,
    });

    const items: CardBrowseIndexItem[] = listings.map((listing) => {
      const display = resolveListingDisplay(listing);
      return {
        id: listing.id,
        title: display.title,
        setName: display.setName,
        rarity: display.rarity,
        type: display.type ?? null,
        game: listing.game as "POKEMON" | "RIFTBOUND",
      };
    });

    return NextResponse.json({ items });
  } catch (error: any) {
    console.error("❌ Error building browse index:", error);
    return NextResponse.json(
      { error: "Failed to build browse index" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/__tests__/api/cards/browse-index.test.ts`
Expected: PASS, all 4 tests.

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no new failures.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/cards/browse-index/route.ts src/__tests__/api/cards/browse-index.test.ts src/types/card.ts
git commit -m "feat: add GET /api/cards/browse-index for marketplace search/filters"
```

---

### Task 4: `computeFacets` pure function

**Files:**
- Create: `src/lib/marketplaceFacets.ts`
- Create: `src/__tests__/lib/marketplaceFacets.test.ts`

**Interfaces:**
- Consumes: `CardBrowseIndexItem[]` from `@/types/card` (Task 3).
- Produces: `computeFacets(items: CardBrowseIndexItem[], selectedGame: "POKEMON" | "RIFTBOUND" | null): MarketplaceFacets`, where `MarketplaceFacets = { sets: FacetOption[]; rarities: FacetOption[]; types: FacetOption[] }` and `FacetOption = { value: string; count: number }`, sorted by `count` descending. `types` is only populated when `selectedGame === "RIFTBOUND"` (empty array otherwise).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/__tests__/lib/marketplaceFacets.test.ts
import { describe, it, expect } from "vitest";
import { computeFacets } from "@/lib/marketplaceFacets";
import type { CardBrowseIndexItem } from "@/types/card";

const ITEMS: CardBrowseIndexItem[] = [
  { id: "1", title: "Charizard", setName: "Base Set", rarity: "Rare Holo", type: null, game: "POKEMON" },
  { id: "2", title: "Blastoise", setName: "Base Set", rarity: "Rare Holo", type: null, game: "POKEMON" },
  { id: "3", title: "Pikachu", setName: "Jungle", rarity: "Common", type: null, game: "POKEMON" },
  { id: "4", title: "Vi - Peacekeeper", setName: "Unleashed", rarity: "Rare", type: "Unit", game: "RIFTBOUND" },
  { id: "5", title: "Fury Rune", setName: "Unleashed", rarity: "Common", type: "Rune", game: "RIFTBOUND" },
];

describe("computeFacets", () => {
  it("tallies sets and rarities scoped to the selected game", () => {
    const facets = computeFacets(ITEMS, "POKEMON");
    expect(facets.sets).toEqual([
      { value: "Base Set", count: 2 },
      { value: "Jungle", count: 1 },
    ]);
    expect(facets.rarities).toEqual([
      { value: "Rare Holo", count: 2 },
      { value: "Common", count: 1 },
    ]);
  });

  it("only populates types when the selected game is RIFTBOUND", () => {
    expect(computeFacets(ITEMS, "POKEMON").types).toEqual([]);
    expect(computeFacets(ITEMS, "RIFTBOUND").types).toEqual([
      { value: "Unit", count: 1 },
      { value: "Rune", count: 1 },
    ]);
  });

  it("includes both games when selectedGame is null, with no types", () => {
    const facets = computeFacets(ITEMS, null);
    expect(facets.sets).toEqual([
      { value: "Unleashed", count: 2 },
      { value: "Base Set", count: 2 },
      { value: "Jungle", count: 1 },
    ]);
    expect(facets.types).toEqual([]);
  });

  it("excludes items with a null setName/rarity from those tallies instead of counting a null bucket", () => {
    const withNulls: CardBrowseIndexItem[] = [
      ...ITEMS,
      { id: "6", title: "Mystery Card", setName: null, rarity: null, type: null, game: "POKEMON" },
    ];
    const facets = computeFacets(withNulls, "POKEMON");
    const setTotal = facets.sets.reduce((sum, s) => sum + s.count, 0);
    expect(setTotal).toBe(3); // unaffected by the null-setName item
  });

  it("returns empty facets for an empty item list", () => {
    expect(computeFacets([], "POKEMON")).toEqual({ sets: [], rarities: [], types: [] });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/__tests__/lib/marketplaceFacets.test.ts`
Expected: FAIL — `Cannot find module '@/lib/marketplaceFacets'`.

- [ ] **Step 3: Implement**

```typescript
// src/lib/marketplaceFacets.ts
//
// Computed entirely client-side from the small browse-index payload
// (GET /api/cards/browse-index) rather than a server-side aggregation
// query — Prisma can't groupBy a related model's field directly
// (setNameEn/setLabel live on the catalog relation, not Listing), and at
// this catalog's scale (~1,300-2,000 rows) tallying in-memory is simpler
// and just as fast.

import type { CardBrowseIndexItem } from "@/types/card";

export interface FacetOption {
  value: string;
  count: number;
}

export interface MarketplaceFacets {
  sets: FacetOption[];
  rarities: FacetOption[];
  types: FacetOption[];
}

function tally(
  items: CardBrowseIndexItem[],
  pick: (item: CardBrowseIndexItem) => string | null
): FacetOption[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = pick(item);
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts, ([value, count]) => ({ value, count })).sort(
    (a, b) => b.count - a.count
  );
}

export function computeFacets(
  items: CardBrowseIndexItem[],
  selectedGame: "POKEMON" | "RIFTBOUND" | null
): MarketplaceFacets {
  const scoped = selectedGame ? items.filter((i) => i.game === selectedGame) : items;
  return {
    sets: tally(scoped, (i) => i.setName),
    rarities: tally(scoped, (i) => i.rarity),
    types: selectedGame === "RIFTBOUND" ? tally(scoped, (i) => i.type) : [],
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/__tests__/lib/marketplaceFacets.test.ts`
Expected: PASS, all 5 tests.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no new failures.

- [ ] **Step 6: Commit**

```bash
git add src/lib/marketplaceFacets.ts src/__tests__/lib/marketplaceFacets.test.ts
git commit -m "feat: add computeFacets for marketplace filter sidebar counts"
```

---

### Task 5: `FilterSidebar` component

**Files:**
- Create: `src/app/marketplace/FilterSidebar.tsx`

**Interfaces:**
- Consumes: `MarketplaceFacets`/`FacetOption` from `@/lib/marketplaceFacets` (Task 4).
- Produces: a `FilterSidebar` component consumed by `MarketPlace.tsx` (Task 6):

```typescript
export interface MarketplaceFilterState {
  game: "POKEMON" | "RIFTBOUND" | null; // null = All
  setNames: string[];
  rarities: string[];
  types: string[];
}

export interface FilterSidebarProps {
  facets: MarketplaceFacets;
  filters: MarketplaceFilterState;
  onChange: (filters: MarketplaceFilterState) => void;
}
```

No automated test for this task (no component-test infra in this repo — see the spec's Testing section); covered by Task 7's manual browser check.

- [ ] **Step 1: Implement the component**

```typescript
// src/app/marketplace/FilterSidebar.tsx
"use client";

import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
  Button,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { MarketplaceFacets } from "@/lib/marketplaceFacets";

export interface MarketplaceFilterState {
  game: "POKEMON" | "RIFTBOUND" | null;
  setNames: string[];
  rarities: string[];
  types: string[];
}

export interface FilterSidebarProps {
  facets: MarketplaceFacets;
  filters: MarketplaceFilterState;
  onChange: (filters: MarketplaceFilterState) => void;
}

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function FilterSidebar({ facets, filters, onChange }: FilterSidebarProps) {
  const hasActiveFilters =
    filters.game != null ||
    filters.setNames.length > 0 ||
    filters.rarities.length > 0 ||
    filters.types.length > 0;

  return (
    <Box sx={{ width: 260, flexShrink: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="h6" fontWeight={700}>Filters</Typography>
        {hasActiveFilters && (
          <Button
            size="small"
            onClick={() => onChange({ game: null, setNames: [], rarities: [], types: [] })}
          >
            Clear
          </Button>
        )}
      </Box>

      <Accordion defaultExpanded disableGutters elevation={0} sx={{ borderTop: "1px solid #eee" }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={600}>Game</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <RadioGroup
            value={filters.game ?? "ALL"}
            onChange={(e) => {
              const value = e.target.value;
              const game = value === "ALL" ? null : (value as "POKEMON" | "RIFTBOUND");
              // Set/rarity/type are game-scoped facets — switching game
              // invalidates any previously selected values from the other
              // game's option list.
              onChange({ game, setNames: [], rarities: [], types: [] });
            }}
          >
            <FormControlLabel value="ALL" control={<Radio size="small" />} label="All" />
            <FormControlLabel value="POKEMON" control={<Radio size="small" />} label="Pokémon" />
            <FormControlLabel value="RIFTBOUND" control={<Radio size="small" />} label="Riftbound" />
          </RadioGroup>
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded disableGutters elevation={0} sx={{ borderTop: "1px solid #eee" }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={600}>Set</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ maxHeight: 240, overflowY: "auto" }}>
          {facets.sets.map((opt) => (
            <FormControlLabel
              key={opt.value}
              control={
                <Checkbox
                  size="small"
                  checked={filters.setNames.includes(opt.value)}
                  onChange={() => onChange({ ...filters, setNames: toggleValue(filters.setNames, opt.value) })}
                />
              }
              label={`${opt.value} (${opt.count})`}
            />
          ))}
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded disableGutters elevation={0} sx={{ borderTop: "1px solid #eee" }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={600}>Rarity</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ maxHeight: 240, overflowY: "auto" }}>
          {facets.rarities.map((opt) => (
            <FormControlLabel
              key={opt.value}
              control={
                <Checkbox
                  size="small"
                  checked={filters.rarities.includes(opt.value)}
                  onChange={() => onChange({ ...filters, rarities: toggleValue(filters.rarities, opt.value) })}
                />
              }
              label={`${opt.value} (${opt.count})`}
            />
          ))}
        </AccordionDetails>
      </Accordion>

      {filters.game === "RIFTBOUND" && facets.types.length > 0 && (
        <Accordion defaultExpanded disableGutters elevation={0} sx={{ borderTop: "1px solid #eee", borderBottom: "1px solid #eee" }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={600}>Type</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {facets.types.map((opt) => (
              <FormControlLabel
                key={opt.value}
                control={
                  <Checkbox
                    size="small"
                    checked={filters.types.includes(opt.value)}
                    onChange={() => onChange({ ...filters, types: toggleValue(filters.types, opt.value) })}
                  />
                }
                label={`${opt.value} (${opt.count})`}
              />
            ))}
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/marketplace/FilterSidebar.tsx
git commit -m "feat: add marketplace FilterSidebar component"
```

---

### Task 6: Rewire `MarketPlace.tsx` for pagination, filters, and index-backed search

**Files:**
- Modify: `src/app/marketplace/MarketPlace.tsx`

**Interfaces:**
- Consumes: `FilterSidebar`/`MarketplaceFilterState` (Task 5), `computeFacets` (Task 4), `CardBrowseIndexItem` (Task 3), the extended `GET /api/cards` (Tasks 1-2), `GET /api/cards/browse-index` (Task 3), existing `useFuzzySearch` hook (unchanged).

No automated test for this task (no component-test infra) — covered by Task 7's manual browser check.

- [ ] **Step 1: Read the current file**

Read `src/app/marketplace/MarketPlace.tsx` in full before editing — this task rewrites its data-fetching logic (the current single unpaginated `useEffect` fetch) while keeping its existing rendering (the `CardListItem` grid, `framer-motion` stagger, the "hide my own listings" filter) intact.

- [ ] **Step 2: Replace the data-fetching state and effects**

Replace the existing single fetch-everything `useEffect` and `cards`/`search` state with:

```typescript
const PAGE_SIZE = 24;

const [browseIndex, setBrowseIndex] = useState<CardBrowseIndexItem[]>([]);
const [filters, setFilters] = useState<MarketplaceFilterState>({
  game: null, setNames: [], rarities: [], types: [],
});
const [search, setSearch] = useState("");
const [cards, setCards] = useState<CardItem[]>([]);
const [page, setPage] = useState(1);
const [hasMore, setHasMore] = useState(false);
const [loading, setLoading] = useState(true);
const [loadingMore, setLoadingMore] = useState(false);
const [fetchError, setFetchError] = useState(false);

// Fetch the lightweight browse-index once on mount — feeds search + facets.
useEffect(() => {
  fetch("/api/cards/browse-index")
    .then((r) => r.json())
    .then((data) => setBrowseIndex(data.items ?? []))
    .catch(() => setBrowseIndex([])); // degrade gracefully — search/facets just show nothing
}, []);

const facets = useMemo(() => computeFacets(browseIndex, filters.game), [browseIndex, filters.game]);

// fuse.js over the in-memory index (existing hook, unchanged) — ranked by relevance.
const searchMatches = useFuzzySearch({
  data: browseIndex,
  query: search,
  keys: MARKETPLACE_SEARCH_KEYS,
});
const matchedIds = search ? searchMatches.map((m) => m.id) : null;

function buildQuery(pageNum: number) {
  const params = new URLSearchParams({ forSale: "true", page: String(pageNum), pageSize: String(PAGE_SIZE) });
  if (filters.game) params.set("game", filters.game);
  filters.setNames.forEach((v) => params.append("setName", v));
  filters.rarities.forEach((v) => params.append("rarity", v));
  filters.types.forEach((v) => params.append("type", v));
  if (matchedIds) {
    // Search-mode: paginate the client-side relevance-ranked id list rather
    // than trusting server pagination order, and only send this page's ids
    // (bounded to PAGE_SIZE) to keep the query string short.
    const start = (pageNum - 1) * PAGE_SIZE;
    matchedIds.slice(start, start + PAGE_SIZE).forEach((id) => params.append("ids", id));
  }
  return params.toString();
}

// Refetch page 1 whenever filters or search change.
useEffect(() => {
  setLoading(true);
  setFetchError(false);
  fetch(`/api/cards?${buildQuery(1)}`)
    .then((r) => r.json())
    .then((data) => {
      let fetchedCards: CardItem[] = data.cards ?? [];
      if (matchedIds) {
        // Preserve fuse.js's relevance ranking — Prisma's `id IN (...)`
        // does not guarantee the response is ordered like the input array.
        const order = new Map(matchedIds.map((id, i) => [id, i]));
        fetchedCards = [...fetchedCards].sort(
          (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
        );
        setHasMore(matchedIds.length > PAGE_SIZE);
      } else {
        setHasMore(Boolean(data.hasMore));
      }
      setCards(fetchedCards);
      setPage(1);
    })
    .catch(() => setFetchError(true))
    .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [filters, search, browseIndex]);

function handleLoadMore() {
  const nextPage = page + 1;
  setLoadingMore(true);
  fetch(`/api/cards?${buildQuery(nextPage)}`)
    .then((r) => r.json())
    .then((data) => {
      let nextCards: CardItem[] = data.cards ?? [];
      if (matchedIds) {
        const order = new Map(matchedIds.map((id, i) => [id, i]));
        nextCards = [...nextCards].sort(
          (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
        );
        setHasMore(matchedIds.length > nextPage * PAGE_SIZE);
      } else {
        setHasMore(Boolean(data.hasMore));
      }
      setCards((prev) => [...prev, ...nextCards]);
      setPage(nextPage);
    })
    .finally(() => setLoadingMore(false));
}
```

Required new imports at the top of the file: `useMemo` (alongside the existing `useState`/`useEffect` import), `FilterSidebar` and `MarketplaceFilterState` from `./FilterSidebar`, `computeFacets` from `@/lib/marketplaceFacets`, `CardBrowseIndexItem` from `@/types/card`.

- [ ] **Step 3: Render the sidebar and "Load more" button**

Wrap the existing card grid in a flex layout with `FilterSidebar` alongside it, and add a "Load more" button below the grid:

```tsx
<Box sx={{ display: "flex", gap: 3 }}>
  <FilterSidebar facets={facets} filters={filters} onChange={setFilters} />
  <Box sx={{ flex: 1 }}>
    {/* existing search box + card grid render here, unchanged */}
    {hasMore && (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
        <Button variant="outlined" onClick={handleLoadMore} disabled={loadingMore}>
          {loadingMore ? <CircularProgress size={20} /> : "Load more"}
        </Button>
      </Box>
    )}
  </Box>
</Box>
```

(`CircularProgress` and `Button` — add to the existing MUI import line if not already imported in this file.)

- [ ] **Step 4: Remove now-redundant client-side logic**

Delete the old `useFuzzySearch({ data: cards, ... })` call and its associated full-list fetch — search now runs against `browseIndex`, not `cards`, per Step 2. Keep the existing "exclude the logged-in user's own listings" `.filter()` — apply it to `cards` after it's set, same as today.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. Fix any prop/type mismatches against `FilterSidebarProps`/`MarketplaceFilterState` from Task 5.

- [ ] **Step 6: Commit**

```bash
git add src/app/marketplace/MarketPlace.tsx
git commit -m "feat: paginate marketplace and wire up filter sidebar + index-backed search"
```

---

### Task 7: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Full typecheck and test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all pass, no new failures, count includes the ~24 new tests from Tasks 1-4 (11 + 4 + 4 + 5).

- [ ] **Step 2: Manual browser verification**

Using a running dev server and a real admin/user session (see this session's established constraint: no seeded test-admin credentials exist on the real DB — get credentials from the user, or have the user drive this check themselves per their own earlier preference), verify on `/marketplace`:
- Initial load shows the first page (24 cards) without fetching the full catalog (check Network tab: one `browse-index` call with a small payload, one paginated `?page=1&pageSize=24` call).
- Sidebar renders Set/Rarity checkboxes with counts; Type section only appears when Game = Riftbound.
- Checking a filter refetches and narrows results; "Clear" resets to the unfiltered first page.
- Typing in the search box narrows results via the in-memory index (no per-keystroke network call to `/api/cards/browse-index` — only the debounced/filtered `/api/cards?ids=...` call).
- "Load more" appends a second batch without re-fetching or duplicating the first batch.
- Combining a search term with an active filter narrows correctly (AND semantics).

- [ ] **Step 3: Final commit if any fixes were needed during manual verification**

```bash
git add -A
git commit -m "fix: address issues found during marketplace pagination manual verification"
```

(Skip this commit if Step 2 found nothing to fix.)

---

## Self-Review Notes

- **Spec coverage**: pagination (Tasks 1-2, 6), filters with live counts (Tasks 1, 3, 4, 5, 6), index-backed cross-catalog search (Tasks 3, 6), backward compatibility (Task 2's explicit test), deterministic sort (Task 1's test) — all covered. Caching, virtualization, dedicated search backend, cross-facet dynamic recount, and Supertype filter are explicitly out of scope per the spec's Non-goals, and no task attempts them.
- **Placeholder scan**: none found — every step has real code, not a description of code.
- **Type consistency**: `CardBrowseIndexItem` (Task 3) is the same shape consumed by `computeFacets` (Task 4) and `MarketPlace.tsx` (Task 6). `MarketplaceFilterState`/`FilterSidebarProps` (Task 5) match the `filters`/`onChange` usage in Task 6 exactly. `MarketplaceFacets`/`FacetOption` (Task 4) match `FilterSidebar`'s `facets` prop usage (Task 5).
