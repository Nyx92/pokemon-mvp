# Marketplace First-Load Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the time between navigating to `/marketplace` and seeing the first row of cards, and make the wait feel shorter for whatever time remains.

**Architecture:** `/marketplace` is currently 100% client-rendered: the server sends an empty shell, the browser downloads ~250KB of JS, React mounts, *then* two `fetch()` calls go out, and only once those resolve does a single card appear. This plan moves the first page of cards to a server-side fetch (Next.js Server Component) so they're already in the HTML the server returns — removing the "download JS → mount → fetch → wait" round trip from the critical path entirely — and adds a route-level skeleton (`loading.tsx`) so navigation shows structure instantly instead of a blank page. All existing client-side behavior (search, filters, "Load more", watchlist icons) is preserved unchanged; it now starts from server-provided data instead of an empty array.

**Tech Stack:** Next.js 14 App Router (Server Components + Route Handlers), Prisma, Vitest (node environment; jsdom only per-file via `// @vitest-environment jsdom` where the codebase already does this).

**Spec:** No separate spec doc — this plan is self-contained, based on a live investigation of `/marketplace`'s request waterfall (recorded in conversation, not a separate file).

## Global Constraints

- Do not change the `/api/cards` HTTP contract (query params in, `{cards, totalCount?, hasMore?}` shape out) — `src/__tests__/api/cards/get-cards.test.ts` and `src/__tests__/api/cards/route.test.ts` must keep passing unmodified.
- Do not change any visible marketplace behavior (search, filters, pagination, watchlist, card click-through) — only where the first page of data comes from and how the wait is displayed.
- Follow the existing test style: plain Vitest in the default `"node"` environment for logic/route tests; jsdom only per-file via the `// @vitest-environment jsdom` directive already used in `src/__tests__/lib/useFuzzySearch.test.ts`, and only if a task truly needs it.
- No new dependencies — `@mui/material`'s `Skeleton` (already installed) covers the loading UI.

---

### Task 1: Extract the listings query into a reusable server function

**Files:**
- Create: `src/lib/listingsQuery.ts`
- Modify: `src/app/api/cards/route.ts:28-146` (the `GET` handler)
- Test: `src/__tests__/lib/listingsQuery.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/prisma`; `listingCatalogInclude`, `withListingDisplay` from `@/lib/listingDisplay`; `centsToDollars` from `@/lib/money`; `Prisma` types from `@prisma/client`.
- Produces: `getListingsPage(params: ListingsQueryParams): Promise<ListingsPageResult>` — used by both the API route (Task 1) and the new Server Component (Task 3).

```ts
// ListingsQueryParams / ListingsPageResult shapes this task defines:
export interface ListingsQueryParams {
  forSale?: boolean;
  tcgPlayerId?: string | null;
  game?: "POKEMON" | "RIFTBOUND" | null;
  setNames?: string[];
  rarities?: string[];
  types?: string[];
  languages?: string[];
  conditions?: string[];
  ids?: string[];
  page?: number | null;
  pageSize?: number | null;
}

export interface ListingsPageResult {
  cards: Array<Record<string, unknown>>; // withListingDisplay(listing) shape, price in dollars
  totalCount?: number;
  hasMore?: boolean;
}
```

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/listingsQuery.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  listing: { findMany: vi.fn(), count: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { getListingsPage } from "@/lib/listingsQuery";

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

describe("getListingsPage", () => {
  it("returns cards with price converted to dollars", async () => {
    const result = await getListingsPage({ forSale: true, game: "POKEMON", page: 1, pageSize: 24 });

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]).toMatchObject({ id: "listing-1", title: "Charizard", price: 50 });
  });

  it("passes forSale/game into the Prisma where clause", async () => {
    await getListingsPage({ forSale: true, game: "POKEMON", page: 1, pageSize: 24 });

    const call = mockPrisma.listing.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ AND: [{ forSale: true }, { game: "POKEMON" }] });
  });

  it("computes hasMore from totalCount when paginated", async () => {
    mockPrisma.listing.count.mockResolvedValue(50);
    const result = await getListingsPage({ forSale: true, page: 1, pageSize: 24 });

    expect(result.totalCount).toBe(50);
    expect(result.hasMore).toBe(true);
  });

  it("does not paginate or count when page/pageSize are omitted", async () => {
    const result = await getListingsPage({ forSale: true });

    expect(mockPrisma.listing.count).not.toHaveBeenCalled();
    expect(result.hasMore).toBeUndefined();
    expect(mockPrisma.listing.findMany.mock.calls[0][0].skip).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/listingsQuery.test.ts`
Expected: FAIL — `Cannot find module '@/lib/listingsQuery'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/listingsQuery.ts` — this is `GET`'s current body (`src/app/api/cards/route.ts:30-137`) moved verbatim into a standalone function, params destructured from an object instead of `URLSearchParams`:

```ts
// src/lib/listingsQuery.ts
//
// Shared by GET /api/cards (client-side search/filter/pagination) and the
// /marketplace Server Component (initial page-1 fetch at request time) so
// the where-clause-building logic exists in exactly one place.

import { prisma } from "@/lib/prisma";
import { centsToDollars } from "@/lib/money";
import { listingCatalogInclude, withListingDisplay } from "@/lib/listingDisplay";
import type { Prisma } from "@prisma/client";

export const MAX_PAGE_SIZE = 100;

export interface ListingsQueryParams {
  forSale?: boolean;
  tcgPlayerId?: string | null;
  game?: "POKEMON" | "RIFTBOUND" | null;
  setNames?: string[];
  rarities?: string[];
  types?: string[];
  languages?: string[];
  conditions?: string[];
  ids?: string[];
  page?: number | null;
  pageSize?: number | null;
}

// withListingDisplay<T extends ListingWithCatalog> requires this exact
// shape as T — ListingWithCatalog itself isn't exported from
// listingDisplay.ts, so it's reconstructed here from the same
// listingCatalogInclude both files already share (can't drift out of sync
// with it, since it's the identical `include` value, not a re-typed copy).
type ListingWithCatalog = Prisma.ListingGetPayload<{ include: typeof listingCatalogInclude }>;

export interface ListingsPageResult {
  cards: ReturnType<typeof mapListing>[];
  totalCount?: number;
  hasMore?: boolean;
}

function mapListing(listing: ListingWithCatalog) {
  const withDisplay = withListingDisplay(listing);
  return {
    ...withDisplay,
    price: withDisplay.price != null ? centsToDollars(withDisplay.price) : null,
  };
}

export async function getListingsPage(params: ListingsQueryParams): Promise<ListingsPageResult> {
  const {
    forSale, tcgPlayerId, game,
    setNames = [], rarities = [], types = [], languages = [], conditions = [], ids = [],
    page = null, pageSize = null,
  } = params;

  const and: Prisma.ListingWhereInput[] = [];
  if (forSale === true) and.push({ forSale: true });
  if (tcgPlayerId) {
    and.push({
      OR: [
        { pokemonCard: { tcgPlayerId } },
        { riftboundCard: { tcgPlayerId } },
      ],
    });
  }
  if (game === "POKEMON" || game === "RIFTBOUND") and.push({ game });
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
  if (types.length > 0) and.push({ riftboundCard: { type: { in: types } } });
  if (conditions.length > 0) and.push({ condition: { in: conditions } });
  if (languages.length > 0) {
    and.push({
      OR: [
        { pokemonCard: { language: { in: languages } } },
        ...(languages.includes("English") ? [{ game: "RIFTBOUND" as const }] : []),
      ],
    });
  }

  const where: Prisma.ListingWhereInput = and.length > 0 ? { AND: and } : {};

  const isPaginated = page != null && pageSize != null;
  const clampedPage = isPaginated ? Math.max(1, page!) : null;
  const clampedPageSize = isPaginated ? Math.min(MAX_PAGE_SIZE, Math.max(1, pageSize!)) : null;

  const [listings, totalCount] = await Promise.all([
    prisma.listing.findMany({
      where,
      include: {
        binder: true,
        owner: { select: { id: true, username: true } },
        ...listingCatalogInclude,
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      ...(isPaginated ? { skip: (clampedPage! - 1) * clampedPageSize!, take: clampedPageSize! } : {}),
    }),
    isPaginated ? prisma.listing.count({ where }) : Promise.resolve(null),
  ]);

  const cards = listings.map(mapListing);
  const result: ListingsPageResult = { cards };
  if (isPaginated && totalCount != null) {
    result.totalCount = totalCount;
    result.hasMore = clampedPage! * clampedPageSize! < totalCount;
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/lib/listingsQuery.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Wire `GET /api/cards` to call it, keeping the HTTP contract identical**

Replace `src/app/api/cards/route.ts:1-146` (imports + the `GET` function only — leave `POST` and everything below untouched):

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";
import { dollarsToCents } from "@/lib/money";
import {
  listingCatalogInclude,
  withListingDisplay,
  findOrCreatePokemonCatalogEntry,
  findOrCreateRiftboundCatalogEntry,
} from "@/lib/listingDisplay";
import { isValidRiftboundType, isValidRiftboundSupertype } from "@/lib/riftboundCatalog";
import { compressCardImage, toWebpStoragePath } from "@/lib/imageProcessing";
import { getListingsPage } from "@/lib/listingsQuery";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// This is a public, unauthenticated endpoint — bounds how much untrusted
// numeric/list input from a caller can inflate a single query.
const MAX_IDS = 200;

// GET /api/cards?forSale=true
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("pageSize");
    const rawPage = pageParam ? parseInt(pageParam, 10) : null;
    const rawPageSize = pageSizeParam ? parseInt(pageSizeParam, 10) : null;
    const isPaginated =
      rawPage != null && rawPageSize != null && !Number.isNaN(rawPage) && !Number.isNaN(rawPageSize);

    const body = await getListingsPage({
      forSale: searchParams.get("forSale") === "true",
      tcgPlayerId: searchParams.get("tcgPlayerId"),
      game: searchParams.get("game") as "POKEMON" | "RIFTBOUND" | null,
      setNames: searchParams.getAll("setName"),
      rarities: searchParams.getAll("rarity"),
      types: searchParams.getAll("type"),
      languages: searchParams.getAll("language"),
      conditions: searchParams.getAll("condition"),
      ids: searchParams.getAll("ids").slice(0, MAX_IDS),
      page: isPaginated ? rawPage : null,
      pageSize: isPaginated ? rawPageSize : null,
    });

    return NextResponse.json(body);
  } catch (error: any) {
    console.error("❌ Error fetching cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch cards" },
      { status: 500 }
    );
  }
}
```

Note: `MAX_PAGE_SIZE` (the local `const MAX_PAGE_SIZE = 100` this file used to declare) is deleted entirely here — the clamping it fed now happens inside `getListingsPage` itself (`src/lib/listingsQuery.ts`, which exports its own `MAX_PAGE_SIZE`). Nothing left in `route.ts` after this change references it, so don't import it — an unused import would fail lint.

- [ ] **Step 6: Run the full existing cards test suite to confirm no regression**

Run: `npx vitest run src/__tests__/api/cards`
Expected: PASS — `get-cards.test.ts`, `get-card.test.ts`, `put-card.test.ts`, `route.test.ts` all still green, unmodified.

- [ ] **Step 7: Commit**

```bash
git add src/lib/listingsQuery.ts src/__tests__/lib/listingsQuery.test.ts src/app/api/cards/route.ts
git commit -m "refactor: extract listings query into reusable getListingsPage"
```

---

### Task 2: Add a pure helper to detect the marketplace's default (no filter, no search) view

**Files:**
- Create: `src/app/marketplace/isDefaultMarketplaceView.ts`
- Test: `src/__tests__/app/marketplace/isDefaultMarketplaceView.test.ts`

**Interfaces:**
- Consumes: `MarketplaceFilterState` type from `./FilterBar` (already defined there).
- Produces: `isDefaultMarketplaceView(filters: MarketplaceFilterState, search: string): boolean` — used by Task 4 to decide whether `MarketPlace.tsx` can skip its own initial client-side fetch (because the Server Component already fetched exactly this default view).

Kept in its own tiny file (not inside `MarketPlace.tsx`) so the test can import it without pulling in React/MUI/framer-motion.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/app/marketplace/isDefaultMarketplaceView.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isDefaultMarketplaceView } from "@/app/marketplace/isDefaultMarketplaceView";
import type { MarketplaceFilterState } from "@/app/marketplace/FilterBar";

const DEFAULT: MarketplaceFilterState = {
  game: "POKEMON",
  setNames: [],
  rarities: [],
  types: [],
  languages: [],
  conditions: [],
};

describe("isDefaultMarketplaceView", () => {
  it("is true for the default filters and empty search", () => {
    expect(isDefaultMarketplaceView(DEFAULT, "")).toBe(true);
  });

  it("is false once a search query is typed", () => {
    expect(isDefaultMarketplaceView(DEFAULT, "charizard")).toBe(false);
  });

  it("is false once any filter facet is selected", () => {
    expect(isDefaultMarketplaceView({ ...DEFAULT, rarities: ["Rare Holo"] }, "")).toBe(false);
  });

  it("is false when the game tab is switched to RIFTBOUND", () => {
    expect(isDefaultMarketplaceView({ ...DEFAULT, game: "RIFTBOUND" }, "")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/app/marketplace/isDefaultMarketplaceView.test.ts`
Expected: FAIL — `Cannot find module '@/app/marketplace/isDefaultMarketplaceView'`.

- [ ] **Step 3: Write the implementation**

Create `src/app/marketplace/isDefaultMarketplaceView.ts`:

```ts
// src/app/marketplace/isDefaultMarketplaceView.ts
//
// True only for the exact view the /marketplace Server Component
// pre-fetches (page 1, forSale=true, game=POKEMON, no facets, no search).
// MarketPlace.tsx uses this to skip its own redundant initial fetch on
// mount — every other combination still fetches client-side as before.

import type { MarketplaceFilterState } from "./FilterBar";

export function isDefaultMarketplaceView(
  filters: MarketplaceFilterState,
  search: string
): boolean {
  return (
    search === "" &&
    filters.game === "POKEMON" &&
    filters.setNames.length === 0 &&
    filters.rarities.length === 0 &&
    filters.types.length === 0 &&
    filters.languages.length === 0 &&
    filters.conditions.length === 0
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/app/marketplace/isDefaultMarketplaceView.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/marketplace/isDefaultMarketplaceView.ts src/__tests__/app/marketplace/isDefaultMarketplaceView.test.ts
git commit -m "feat: add isDefaultMarketplaceView helper for skipping redundant initial fetch"
```

---

### Task 3: Split the Tabs bar into its own client component; make `page.tsx` an async Server Component

**Files:**
- Create: `src/app/marketplace/MarketplaceTabs.tsx`
- Modify: `src/app/marketplace/page.tsx` (full rewrite)

**Interfaces:**
- Consumes: `getListingsPage` from `@/lib/listingsQuery` (Task 1); `Marketplace` from `./MarketPlace` (Task 4 adds the `initialCards`/`initialHasMore` props it needs here).
- Produces: `<MarketplaceTabs />` (no props) — the tab bar, unchanged in appearance/behavior, just relocated.

- [ ] **Step 1: Create `MarketplaceTabs.tsx`** — this is `page.tsx`'s current Tabs block (lines 30–77) plus the two hooks it needs, moved verbatim into its own client component:

```tsx
"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/app/hooks/useAuth";
import { Box, Tab, Tabs } from "@mui/material";
import CollectionsIcon from "@mui/icons-material/Collections";
import GavelIcon from "@mui/icons-material/Gavel";
import StorefrontIcon from "@mui/icons-material/Storefront";
import UploadIcon from "@mui/icons-material/Upload";
import { frostedTabsSx } from "@/app/utils/navChrome";

export default function MarketplaceTabs() {
  const pathname = usePathname();
  const { isLoggedIn, isAdmin } = useAuth();

  return (
    <Box sx={{ display: "flex", justifyContent: "center" }}>
      <Tabs
        value={pathname}
        textColor="primary"
        indicatorColor="primary"
        variant="scrollable"
        scrollButtons="auto"
        sx={frostedTabsSx}
      >
        {isLoggedIn && (
          <Tab
            component={Link}
            href="/myCollection"
            icon={<CollectionsIcon />}
            label="My Collection"
            iconPosition="start"
            value="/myCollection"
          />
        )}
        <Tab
          component={Link}
          href="/marketplace"
          icon={<StorefrontIcon />}
          label="Marketplace"
          iconPosition="start"
          value="/marketplace"
        />
        <Tab
          component={Link}
          href="/auctions"
          icon={<GavelIcon />}
          label="Auctions"
          iconPosition="start"
          value="/auctions"
        />
        {isAdmin && (
          <Tab
            component={Link}
            href="/upload"
            icon={<UploadIcon />}
            label="Upload Card"
            iconPosition="start"
            value="/upload"
          />
        )}
      </Tabs>
    </Box>
  );
}
```

- [ ] **Step 2: Rewrite `page.tsx` as an async Server Component**

Replace the full contents of `src/app/marketplace/page.tsx`:

```tsx
import { Box, Typography } from "@mui/material";
import { motion } from "framer-motion";
import MarketplaceTabs from "./MarketplaceTabs";
import Marketplace from "./MarketPlace";
import { getListingsPage } from "@/lib/listingsQuery";
import { pageBackgroundSx } from "@/app/utils/pageBackground";
import { NAVBAR_HEIGHT } from "@/app/utils/navChrome";

// Matches MarketPlace.tsx's own PAGE_SIZE/DEFAULT_FILTERS — page 1 of the
// no-filter, no-search POKEMON view. Fetched here (server-side, at request
// time) so the first row of cards is already in the HTML the browser gets,
// instead of appearing only after the client bundle loads and fetches it.
const INITIAL_PAGE_SIZE = 24;

export default async function MarketplacePage() {
  const initial = await getListingsPage({
    forSale: true,
    game: "POKEMON",
    page: 1,
    pageSize: INITIAL_PAGE_SIZE,
  });

  return (
    <Box
      component="main"
      sx={{
        ...pageBackgroundSx("/collateral/Riftbound_BG_Market.jpg"),
        mt: `-${NAVBAR_HEIGHT}px`,
        pt: { xs: "88px", md: "112px" },
        minHeight: "100vh",
      }}
    >
      <Box sx={{ mt: 4, px: { xs: 2, md: 4 } }}>
        <MarketplaceTabs />

        <Box sx={{ mt: 4 }}>
          {/* Page header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <Box sx={{ mb: 4 }}>
              <Typography sx={{ fontSize: { xs: 22, md: 28 }, fontWeight: 800, lineHeight: 1.1, color: "#fff" }}>
                Marketplace
              </Typography>
              <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.6)", mt: 0.25 }}>
                Browse and buy Pokémon cards listed by other collectors.
              </Typography>
            </Box>
          </motion.div>

          <Marketplace initialCards={initial.cards as any} initialHasMore={initial.hasMore ?? false} />
        </Box>
      </Box>
    </Box>
  );
}
```

The `as any` on `initial.cards` is temporary — Task 4's Step 1 replaces it with the real `CardItem[]` type once `Marketplace` declares its prop types, so don't skip Task 4.

- [ ] **Step 3: Verify the build still typechecks (Task 4 hasn't added the props yet, so this step is expected to show a prop-mismatch error — just confirm it's *only* that error)**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: One error, in `page.tsx`, about `initialCards`/`initialHasMore` not existing on `Marketplace`'s props — that's the expected, temporary state until Task 4. Any other error means something in this task's rewrite is wrong; fix before continuing.

- [ ] **Step 4: Commit**

```bash
git add src/app/marketplace/MarketplaceTabs.tsx src/app/marketplace/page.tsx
git commit -m "refactor: make marketplace page.tsx an async Server Component"
```

(This commit intentionally leaves the build red — Task 4 is the very next task and fixes it. If your workflow requires every commit to build clean, squash Tasks 3 and 4 into one commit instead.)

---

### Task 4: Feed server-fetched data into `MarketPlace.tsx` and skip the redundant initial client fetch

**Files:**
- Modify: `src/app/marketplace/MarketPlace.tsx`

**Interfaces:**
- Consumes: `isDefaultMarketplaceView` from `./isDefaultMarketplaceView` (Task 2); receives `initialCards: CardItem[]`, `initialHasMore: boolean` props from `page.tsx` (Task 3).
- Produces: `<Marketplace initialCards={...} initialHasMore={...} />` — the final prop contract `page.tsx` already assumes.

- [ ] **Step 1: Add the props and seed initial state from them**

In `src/app/marketplace/MarketPlace.tsx`, add the import and change the component signature + initial state (around lines 55–69):

```tsx
import { isDefaultMarketplaceView } from "./isDefaultMarketplaceView";
```

```tsx
interface MarketplaceProps {
  initialCards: CardItem[];
  initialHasMore: boolean;
}

export default function Marketplace({ initialCards, initialHasMore }: MarketplaceProps) {
  const { userId } = useAuth();
  const router = useRouter();
  const watchlistedIds = useWatchlistIds();

  const [browseIndex, setBrowseIndex] = useState<CardBrowseIndexItem[]>([]);
  const [browseIndexReady, setBrowseIndexReady] = useState(false);
  const [filters, setFilters] = useState<MarketplaceFilterState>(DEFAULT_FILTERS);
  const [search, setSearch] = useState("");
  const [cards, setCards] = useState<CardItem[]>(initialCards);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const skippedInitialFetch = useRef(false);
```

Add `useRef` to the existing `react` import at the top of the file:

```tsx
import React, { useState, useEffect, useMemo, useRef } from "react";
```

- [ ] **Step 2: Skip the redundant fetch on first mount when the view is still the server-fetched default**

Replace the data-fetching `useEffect` (currently lines ~142–172):

```tsx
  useEffect(() => {
    // The Server Component in page.tsx already fetched exactly this view
    // (page 1, forSale=true, game=POKEMON, no filters, no search) before
    // this component ever mounted — skip re-fetching it once on mount so
    // the user doesn't see a loading spinner replace data that's already
    // on screen. Any later change to filters/search runs this effect
    // normally, since skippedInitialFetch is only ever set once.
    if (!skippedInitialFetch.current) {
      skippedInitialFetch.current = true;
      if (isDefaultMarketplaceView(filters, search)) {
        return;
      }
    }

    if (searchAwaitingIndex) {
      setLoading(true);
      return;
    }

    if (matchedIds && matchedIds.length === 0) {
      setCards([]);
      setHasMore(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setFetchError(false);
    fetch(`/api/cards?${buildQuery(1)}`)
      .then((r) => r.json())
      .then((data) => {
        setCards(reorderToMatchSearch(data.cards ?? []));
        setHasMore(matchedIds ? matchedIds.length > PAGE_SIZE : Boolean(data.hasMore));
        setPage(1);
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, search, searchAwaitingIndex]);
```

Note on React Strict Mode: in dev mode, React double-invokes effects on mount to surface cleanup bugs; since `skippedInitialFetch` is a ref (not reset between that synthetic double-invoke), the first invocation flips it to `true` and skips, and the second invocation then falls through and fires one real `/api/cards` request. This is a dev-only artifact of Strict Mode — production builds invoke effects once, so real users never see the extra request. If you see one redundant fetch in dev tools while testing this locally with `pnpm dev`, that's why; verify the actual fix (Step 5 below) against a production build (`pnpm build && next start`), not `pnpm dev`.

- [ ] **Step 3: Run the type checker to confirm `page.tsx`'s temporary `as any` is now provably correct**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 0 errors. If this passes, go back to `page.tsx` (Task 3) and remove the `as any`:

```tsx
<Marketplace initialCards={initial.cards} initialHasMore={initial.hasMore ?? false} />
```

Run `npx tsc --noEmit -p tsconfig.json` again — still 0 errors.

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: All existing tests pass (this component has no existing dedicated test file — Task 2's `isDefaultMarketplaceView` test already covers the new logic's decision-making in isolation).

- [ ] **Step 5: Manual verification (this is the part a unit test can't cover — an actual mount)**

```bash
pnpm build && npx next start -p 3001 &
timeout 30 bash -c 'until curl -sf http://localhost:3001 >/dev/null; do sleep 1; done'
```

Open `http://localhost:3001/marketplace` in a browser with devtools Network tab open:
- Confirm cards are visible in the initial HTML response (View Source, or Network tab's first `marketplace` document request — the response body should already contain card titles).
- Confirm `/api/cards?...` does **not** fire on load (only `/api/cards/browse-index` should — that one is unchanged and still needed for search/facets).
- Change any filter (e.g. a rarity checkbox) and confirm `/api/cards?...` **does** now fire, and results update.
- Type in the search box and confirm search still works.

Stop the server: `lsof -ti:3001 -sTCP:LISTEN | xargs -r kill`

- [ ] **Step 6: Commit**

```bash
git add src/app/marketplace/MarketPlace.tsx src/app/marketplace/page.tsx
git commit -m "feat: seed marketplace from server-fetched initial cards, skip redundant client fetch"
```

---

### Task 5: Add a route-level loading skeleton

**Files:**
- Create: `src/app/marketplace/loading.tsx`

**Interfaces:**
- Consumes: nothing — Next.js renders this automatically (via React Suspense) while `page.tsx`'s async body (Task 3) is awaiting `getListingsPage`.
- Produces: nothing consumed elsewhere — this is a leaf UI file.

- [ ] **Step 1: Create the skeleton**

```tsx
// src/app/marketplace/loading.tsx
//
// Shown automatically by Next.js (via Suspense) while page.tsx's async
// getListingsPage() call is in flight — replaces the old client-only
// PoroLoader spinner, which couldn't appear until the JS bundle had
// already loaded. Card-tile dimensions match CardListItem.tsx (280x220)
// so there's no layout shift when real cards replace these.
import { Box, Skeleton } from "@mui/material";
import { pageBackgroundSx } from "@/app/utils/pageBackground";
import { NAVBAR_HEIGHT } from "@/app/utils/navChrome";

const SKELETON_COUNT = 8;

export default function MarketplaceLoading() {
  return (
    <Box
      component="main"
      sx={{
        ...pageBackgroundSx("/collateral/Riftbound_BG_Market.jpg"),
        mt: `-${NAVBAR_HEIGHT}px`,
        pt: { xs: "88px", md: "112px" },
        minHeight: "100vh",
      }}
    >
      <Box sx={{ mt: 4, px: { xs: 2, md: 4 } }}>
        <Box sx={{ display: "flex", justifyContent: "center", mb: 4 }}>
          <Skeleton variant="rounded" width={200} height={40} sx={{ bgcolor: "rgba(255,255,255,0.12)" }} />
        </Box>

        <Box sx={{ mt: 4 }}>
          <Box sx={{ mb: 4 }}>
            <Skeleton variant="text" width={220} height={36} sx={{ bgcolor: "rgba(255,255,255,0.12)" }} />
            <Skeleton variant="text" width={340} height={20} sx={{ bgcolor: "rgba(255,255,255,0.08)" }} />
          </Box>

          <Box sx={{ display: "flex", flexWrap: "wrap", gap: "16px", justifyContent: "center" }}>
            {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <Skeleton
                key={i}
                variant="rounded"
                width={280}
                height={220}
                sx={{ bgcolor: "rgba(255,255,255,0.10)" }}
              />
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Manual verification**

With the production server running (Task 4 Step 5's `pnpm build && next start`), throttle the network in devtools (Slow 3G) and navigate to `/marketplace` — confirm the skeleton grid appears immediately (not a blank page), then is replaced by real cards once the server response arrives.

- [ ] **Step 3: Commit**

```bash
git add src/app/marketplace/loading.tsx
git commit -m "feat: add marketplace loading skeleton"
```

---

### Task 6 (optional, lower priority): Cache the browse-index endpoint

The browse-index fetch (`GET /api/cards/browse-index`) re-queries and re-serializes all ~1,300 for-sale listings on every single marketplace page view, purely to feed client-side search/facets. It doesn't block the first paint (Task 3–4 already fixed that), but it does add avoidable database load on every visit, and shares the same small Postgres connection pool (`connection_limit=5` in `DATABASE_URL`) that the actual cards query uses. This task is separable from Tasks 1–5 and can be skipped without affecting the primary goal.

**Files:**
- Modify: `src/app/api/cards/browse-index/route.ts`

- [ ] **Step 1: Add route-level revalidation**

At the top of `src/app/api/cards/browse-index/route.ts`, add:

```ts
// Search/facet data doesn't need to be real-time-fresh — a new listing
// shows up in search within 60s instead of instantly. Cuts this from
// "re-query + re-serialize ~1,300 rows on every marketplace visit" to
// "once per 60 seconds", easing pressure on the shared connection pool.
export const revalidate = 60;
```

- [ ] **Step 2: Manual verification**

```bash
pnpm build && npx next start -p 3001 &
timeout 30 bash -c 'until curl -sf http://localhost:3001 >/dev/null; do sleep 1; done'
curl -s -D - http://localhost:3001/api/cards/browse-index -o /dev/null | grep -i "x-nextjs-cache\|cache-control"
curl -s -D - http://localhost:3001/api/cards/browse-index -o /dev/null | grep -i "x-nextjs-cache\|cache-control"
lsof -ti:3001 -sTCP:LISTEN | xargs -r kill
```

Expected: the second request's `x-nextjs-cache` header reads `HIT` (first is `MISS` or absent).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cards/browse-index/route.ts
git commit -m "perf: cache browse-index response for 60s to reduce DB load on every marketplace visit"
```

---

### Task 7: Final verification

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: all tests pass, including the new `listingsQuery.test.ts` and `isDefaultMarketplaceView.test.ts`.

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx next lint`
Expected: 0 errors.

- [ ] **Step 3: Before/after timing comparison**

Using the same Playwright measurement approach used during investigation (fresh browser context, cache disabled, `waitForSelector('img')` timed from `page.goto`), compare `git stash` (before) against the working tree (after) against a `pnpm build && next start` production server. Expect the "time to first card image" to drop by roughly the time it previously took to download+parse the marketplace JS bundle and complete one client round trip (this was ~150-300ms in local testing against a warm connection; the effect will be larger over a real network with real latency, which is the actual reported complaint).

- [ ] **Step 4: Visual check**

Screenshot `/marketplace` before and after — grid layout, card content, and the "Load more" button must look identical. Only the loading skeleton (new) and the absence of a flash-of-empty-page should differ.

## Self-Review Notes

- **Spec coverage:** "split it up" → Task 1 (extracted query fn) + Task 3/4 (server vs. client split). "optimize on page load" → Tasks 1–4 (removes a full round trip). "user dont see the loading as much as possible" → Task 5 (skeleton) + Task 6 (less DB contention, snappier subsequent loads).
- **No placeholders:** every step has runnable code; the one `as any` is explicitly flagged as temporary and removed by the end of Task 4.
- **Type consistency:** `ListingsQueryParams`/`ListingsPageResult` (Task 1) are the same shape used in Task 3's `page.tsx`; `isDefaultMarketplaceView(filters, search)` (Task 2) signature matches its call site in Task 4; `initialCards`/`initialHasMore` prop names match between Task 3's `<Marketplace>` call and Task 4's `MarketplaceProps`.
