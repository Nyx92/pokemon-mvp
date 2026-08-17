# Listing API Rewiring (Plan 2a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every backend API route still calling `prisma.card`/`cardId` (the pre-rename model), which is why the dev server crashes on `/api/home/featured` and every other card-touching route. Bring them onto the `Listing` model and the new `PokemonCardCatalog`/`RiftboundCardCatalog` tables introduced by the prior schema-migration plan.

**Architecture:** Introduce one small resolver module, `src/lib/listingDisplay.ts`, that computes flat display fields (`title`, `rarity`, `setName`, `language`, `cardNumber`, `tcgPlayerId`) from whichever catalog relation (`pokemonCard`/`riftboundCard`) is populated on a `Listing`. Every route maps its Prisma query results through this resolver before returning JSON, so the external response shape — and therefore `src/types/card.ts`, `src/types/auction.ts`, `src/types/cart.ts`, and every frontend component consuming them — is completely unchanged. No frontend files are touched by this plan. The admin upload/edit form also keeps submitting the same flat fields it always has (`title`, `setName`, `rarity`, `tcgPlayerId`, `language`, `cardNumber`) — the routes now look up or create a matching `PokemonCardCatalog` row (matched by `tcgPlayerId`, the closest thing this app already had to a per-card key) behind the scenes instead of storing those fields directly on the listing.

**Tech Stack:** Next.js 14 App Router route handlers, Prisma 6, Vitest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-08-17-riftbound-card-schema-design.md` (the schema this plan wires up to) — no new spec was written for this plan; it is a mechanical-but-nontrivial consequence of that spec's rename, scoped and reviewed inline per the `writing-plans` bounded-vs-architectural guidance (this is the direct, previously-agreed-to "Plan 2a" continuation of that architectural work, not a new design).

## Global Constraints

- **Schema is already migrated.** `PokemonCardCatalog`, `RiftboundCardCatalog`, and `Listing` (renamed from `Card`) already exist in `prisma/schema.prisma` and the dev database. This plan makes **no schema changes** — it only rewires application code that still references the old `Card` model/field names.
- **Post-rename names, exactly:** `Card` → `Listing`; every model's `card`/`cardId` → `listing`/`listingId` (this includes `Order`, `Offer`, `CardTransaction`, `CardWatchlist`, `CartItem`, `Auction`). `CardWatchlist`'s compound unique key is `@@unique([listingId, userId])`, so its Prisma-generated compound-key name is `listingId_userId` (not `cardId_userId`).
- **Prices are cents in the DB.** Convert with `dollarsToCents`/`centsToDollars` from `@/lib/money`, exactly where the current code already does.
- **Public/anonymous-reachable endpoints must never expose an owner's email.** Every `owner` include/select in this plan uses `owner: { select: { id: true, username: true } }` — never a bare `owner: true`.
- **`src/types/card.ts`, `src/types/auction.ts`, `src/types/cart.ts` are NOT modified by this plan.** The listing-display resolver's job is to keep every route's JSON response shape identical to what these types already declare.
- **`CardTransaction.tcgPlayerId` is a real, already-existing column** (`String?`, confirmed in `prisma/schema.prisma`) — it does not need to be reached through a join to `Listing`/`Card`.
- **The admin listing-upload/edit form is out of scope for changes in this plan.** It keeps sending the same `FormData` fields it always has. The routes handle the translation to the new catalog-based schema server-side.
- **This plan only creates `game: "POKEMON"` listings via the admin upload form.** Riftbound listings are seed-data only for now (per the schema spec's non-goals) — the admin form has no Riftbound fields, and adding that UX is out of scope here.
- Test files use this codebase's existing mock pattern: `vi.hoisted(() => ({...}))` to build the mock object, `vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))` to register it, then `import` the route under test. Follow this pattern exactly in every rewritten test file — don't introduce a different mocking style.

---

### Task 1: `src/lib/listingDisplay.ts` — the catalog-resolution helper

**Files:**
- Create: `src/lib/listingDisplay.ts`
- Test: `src/__tests__/lib/listingDisplay.test.ts`

**Interfaces:**
- Produces (used by every later task):
  - `listingCatalogInclude: { pokemonCard: true, riftboundCard: true }` — a Prisma include fragment. Spread it into any `include` object on a `Listing`/`CardWatchlist`/`Auction` query that needs display fields resolved.
  - `resolveListingDisplay(listing): { title: string; rarity: string | null; setName: string | null; language: string; cardNumber: string | null; tcgPlayerId: string }` — throws if neither catalog relation is populated.
  - `withListingDisplay(listing): <rest of listing fields> & display fields` — spreads the listing (minus the raw `pokemonCard`/`riftboundCard` relation objects) merged with `resolveListingDisplay`'s output.
  - `findOrCreatePokemonCatalogEntry(prismaOrTx, fields): Promise<PokemonCardCatalog>` — looks up a `PokemonCardCatalog` row by `tcgPlayerId`; creates one if none exists. `fields` is `{ title, setName, rarity, tcgPlayerId, language, cardNumber }` (all `string`).

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/listingDisplay.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import {
  listingCatalogInclude,
  resolveListingDisplay,
  withListingDisplay,
  findOrCreatePokemonCatalogEntry,
} from "@/lib/listingDisplay";

const POKEMON_LISTING = {
  id: "listing-1",
  price: 5000,
  game: "POKEMON",
  pokemonCardId: "pkc-1",
  riftboundCardId: null,
  pokemonCard: {
    id: "pkc-1",
    nameEn: "Charizard",
    rarity: "Rare Holo",
    setNameEn: "Base Set",
    language: "English",
    localId: "004",
    tcgPlayerId: "tcg-1",
  },
  riftboundCard: null,
};

const RIFTBOUND_LISTING = {
  id: "listing-2",
  price: 2500,
  game: "RIFTBOUND",
  pokemonCardId: null,
  riftboundCardId: "rbc-1",
  pokemonCard: null,
  riftboundCard: {
    id: "rbc-1",
    name: "Vi - Peacekeeper",
    rarity: "Rare",
    setLabel: "Unleashed",
    collectorNumber: "176",
    tcgPlayerId: null,
  },
};

describe("resolveListingDisplay", () => {
  it("resolves display fields from pokemonCard when set", () => {
    expect(resolveListingDisplay(POKEMON_LISTING as any)).toEqual({
      title: "Charizard",
      rarity: "Rare Holo",
      setName: "Base Set",
      language: "English",
      cardNumber: "004",
      tcgPlayerId: "tcg-1",
    });
  });

  it("resolves display fields from riftboundCard when set, defaulting language to English", () => {
    expect(resolveListingDisplay(RIFTBOUND_LISTING as any)).toEqual({
      title: "Vi - Peacekeeper",
      rarity: "Rare",
      setName: "Unleashed",
      language: "English",
      cardNumber: "176",
      tcgPlayerId: "",
    });
  });

  it("throws when neither catalog relation is populated", () => {
    const broken = { ...POKEMON_LISTING, pokemonCard: null, riftboundCard: null };
    expect(() => resolveListingDisplay(broken as any)).toThrow(
      /has no catalog reference/
    );
  });
});

describe("withListingDisplay", () => {
  it("merges resolved display fields and strips the raw catalog relations", () => {
    const result = withListingDisplay(POKEMON_LISTING as any);
    expect(result).toMatchObject({
      id: "listing-1",
      price: 5000,
      title: "Charizard",
      rarity: "Rare Holo",
      setName: "Base Set",
      language: "English",
      cardNumber: "004",
      tcgPlayerId: "tcg-1",
    });
    expect(result).not.toHaveProperty("pokemonCard");
    expect(result).not.toHaveProperty("riftboundCard");
  });
});

describe("listingCatalogInclude", () => {
  it("includes both catalog relations", () => {
    expect(listingCatalogInclude).toEqual({ pokemonCard: true, riftboundCard: true });
  });
});

describe("findOrCreatePokemonCatalogEntry", () => {
  const fields = {
    title: "Pikachu",
    setName: "Jungle",
    rarity: "Common",
    tcgPlayerId: "tcg-99",
    language: "English",
    cardNumber: "60",
  };

  it("reuses an existing catalog row matched by tcgPlayerId", async () => {
    const existing = { id: "pkc-existing", tcgPlayerId: "tcg-99" };
    const tx = {
      pokemonCardCatalog: {
        findFirst: vi.fn().mockResolvedValue(existing),
        create: vi.fn(),
      },
    };

    const result = await findOrCreatePokemonCatalogEntry(tx as any, fields);

    expect(result).toBe(existing);
    expect(tx.pokemonCardCatalog.findFirst).toHaveBeenCalledWith({
      where: { tcgPlayerId: "tcg-99" },
    });
    expect(tx.pokemonCardCatalog.create).not.toHaveBeenCalled();
  });

  it("creates a new catalog row when no match exists", async () => {
    const created = { id: "pkc-new" };
    const tx = {
      pokemonCardCatalog: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(created),
      },
    };

    const result = await findOrCreatePokemonCatalogEntry(tx as any, fields);

    expect(result).toBe(created);
    expect(tx.pokemonCardCatalog.create).toHaveBeenCalledWith({
      data: {
        externalId: "manual-tcg-99",
        nameEn: "Pikachu",
        setNameEn: "Jungle",
        rarity: "Common",
        language: "English",
        localId: "60",
        tcgPlayerId: "tcg-99",
        setId: "tcg-99",
      },
    });
  });

  it("stores a null localId when cardNumber is empty", async () => {
    const tx = {
      pokemonCardCatalog: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "pkc-new" }),
      },
    };

    await findOrCreatePokemonCatalogEntry(tx as any, { ...fields, cardNumber: "" });

    expect(tx.pokemonCardCatalog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ localId: null }) })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/listingDisplay.test.ts`
Expected: FAIL — `Cannot find module '@/lib/listingDisplay'` (the module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/listingDisplay.ts`:

```ts
// src/lib/listingDisplay.ts
//
// Card identity (title, rarity, set, etc.) now lives on PokemonCardCatalog/
// RiftboundCardCatalog, reached through a Listing's pokemonCard/riftboundCard
// relation, not as flat columns on Listing itself. Every API route that used
// to read these fields directly off a Card row now needs to (a) include the
// right catalog relation in its Prisma query and (b) resolve the display
// fields through this helper — keeping the external JSON shape (CardItem's
// flat title/rarity/setName/language/cardNumber/tcgPlayerId fields) exactly
// as the frontend already expects, so no frontend changes are needed here.

import type { Prisma } from "@prisma/client";

export const listingCatalogInclude = {
  pokemonCard: true,
  riftboundCard: true,
} satisfies Prisma.ListingInclude;

type ListingWithCatalog = Prisma.ListingGetPayload<{
  include: typeof listingCatalogInclude;
}>;

export interface ListingDisplayFields {
  title: string;
  rarity: string | null;
  setName: string | null;
  language: string;
  cardNumber: string | null;
  tcgPlayerId: string;
}

// Resolves the flat display fields for a listing, regardless of which game
// it belongs to. Pokemon and Riftbound catalogs don't share a rarity/set
// naming scheme (setNameEn vs setLabel, localId vs collectorNumber) — this
// is the one place that difference is flattened away for API consumers.
export function resolveListingDisplay(
  listing: ListingWithCatalog
): ListingDisplayFields {
  if (listing.pokemonCard) {
    const p = listing.pokemonCard;
    return {
      title: p.nameEn,
      rarity: p.rarity,
      setName: p.setNameEn,
      language: p.language,
      cardNumber: p.localId,
      tcgPlayerId: p.tcgPlayerId ?? "",
    };
  }
  if (listing.riftboundCard) {
    const r = listing.riftboundCard;
    return {
      title: r.name,
      rarity: r.rarity,
      setName: r.setLabel,
      language: "English",
      cardNumber: r.collectorNumber,
      tcgPlayerId: r.tcgPlayerId ?? "",
    };
  }
  throw new Error(
    `Listing ${listing.id} has no catalog reference (neither pokemonCard nor riftboundCard is set).`
  );
}

// Merges a listing's resolved display fields into its own object, dropping
// the raw pokemonCard/riftboundCard relation objects from the result (the
// frontend doesn't consume those — it reads the flat fields this spreads
// in, same names/types the old Card model had).
export function withListingDisplay<T extends ListingWithCatalog>(
  listing: T
): Omit<T, "pokemonCard" | "riftboundCard"> & ListingDisplayFields {
  const { pokemonCard, riftboundCard, ...rest } = listing;
  return { ...rest, ...resolveListingDisplay(listing) };
}

// Admin upload/edit (POST/PUT /api/cards) still accepts flat identity fields
// via FormData, matching the pre-catalog form contract — no frontend changes
// needed. This finds an existing PokemonCardCatalog row by tcgPlayerId (the
// closest thing this app already had to a natural per-card key — see
// BestSeller.tcgPlayerId) or creates one, so repeated uploads of "the same"
// card reuse one catalog row instead of creating a new one every time.
//
// setId has no natural source in this manual-entry path (the form only
// collects a display-friendly setName, not a real set code) — tcgPlayerId
// is reused as a stand-in, matching the accepted pattern from the seed-data
// task in the schema-migration plan, which faced the same gap.
export async function findOrCreatePokemonCatalogEntry(
  prismaOrTx: Prisma.TransactionClient,
  fields: {
    title: string;
    setName: string;
    rarity: string;
    tcgPlayerId: string;
    language: string;
    cardNumber: string;
  }
) {
  const existing = await prismaOrTx.pokemonCardCatalog.findFirst({
    where: { tcgPlayerId: fields.tcgPlayerId },
  });
  if (existing) return existing;

  return prismaOrTx.pokemonCardCatalog.create({
    data: {
      externalId: `manual-${fields.tcgPlayerId}`,
      nameEn: fields.title,
      setNameEn: fields.setName,
      rarity: fields.rarity,
      language: fields.language,
      localId: fields.cardNumber || null,
      tcgPlayerId: fields.tcgPlayerId,
      setId: fields.tcgPlayerId,
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/lib/listingDisplay.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/listingDisplay.ts src/__tests__/lib/listingDisplay.test.ts
git commit -m "feat: add listingDisplay helper to resolve catalog fields onto Listing rows"
```

---

### Task 2: `src/app/api/cards/route.ts` — GET (list) and POST (admin create)

**Files:**
- Modify: `src/app/api/cards/route.ts`
- Modify: `src/__tests__/api/cards/route.test.ts`

**Interfaces:**
- Consumes: `listingCatalogInclude`, `withListingDisplay`, `findOrCreatePokemonCatalogEntry` from `@/lib/listingDisplay` (Task 1).

- [ ] **Step 1: Update the failing test**

Replace the full contents of `src/__tests__/api/cards/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * POST /api/cards
 *
 * Lets an admin create a card and assign it to ANY user (an admin tool for
 * listing cards on behalf of sellers — the `ownerId` field is deliberately
 * client-supplied so an admin can pick any user from a dropdown). Because
 * ownerId is trusted input, this route must be restricted to admins only.
 *
 * The route now creates a Listing pointed at a PokemonCardCatalog row
 * (found-or-created by tcgPlayerId) instead of storing identity fields
 * directly on the card row.
 *
 * Tests cover:
 *   - 401 unauthenticated
 *   - 403 authenticated but not an admin
 *   - 201 admin can still create a card (happy path, proves the auth gate
 *     doesn't break the legitimate flow), reusing an existing catalog row
 *   - creates a new catalog row when no existing one matches
 */

// ── STEP 1: Create the mock objects ──────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  listing: { create: vi.fn() },
  pokemonCardCatalog: { findFirst: vi.fn(), create: vi.fn() },
}));

const mockSupabaseInstance = vi.hoisted(() => ({
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({ data: { path: "cards/1-test.png" }, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "https://example.com/cards/1-test.png" } }),
    })),
  },
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

// ── STEP 2: Register the fakes ────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabaseInstance),
}));

// ── STEP 3: Import the code under test ───────────────────────────────────────

import { POST } from "@/app/api/cards/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildFormData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("title", "Charizard");
  fd.set("condition", "NM");
  fd.set("ownerId", "target-user-1");
  fd.set("tcgPlayerId", "tcg-1");
  fd.set("language", "English");
  fd.set("forSale", "true");
  fd.set("price", "50.00");
  fd.append("images", new File(["fake"], "card.png", { type: "image/png" }));
  Object.entries(overrides).forEach(([k, v]) => fd.set(k, v));
  return fd;
}

function postRequest(formData: FormData) {
  return new NextRequest("http://localhost/api/cards", {
    method: "POST",
    body: formData,
  });
}

const ADMIN_SESSION = { user: { id: "admin-1", role: "admin" } };
const USER_SESSION = { user: { id: "user-1", role: "user" } };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/cards", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(postRequest(buildFormData()));
    expect(res.status).toBe(401);
    expect(mockPrisma.listing.create).not.toHaveBeenCalled();
  });

  it("returns 403 when authenticated but not an admin", async () => {
    mockGetServerSession.mockResolvedValue(USER_SESSION);
    const res = await POST(postRequest(buildFormData()));
    expect(res.status).toBe(403);
    expect(mockPrisma.listing.create).not.toHaveBeenCalled();
  });

  it("lets an admin create a card owned by a different user, reusing an existing catalog row", async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION);
    mockPrisma.pokemonCardCatalog.findFirst.mockResolvedValue({ id: "catalog-1", tcgPlayerId: "tcg-1" });
    mockPrisma.listing.create.mockResolvedValue({
      id: "listing-1",
      ownerId: "target-user-1",
    });

    const res = await POST(postRequest(buildFormData()));
    expect(res.status).toBe(200);

    expect(mockPrisma.pokemonCardCatalog.findFirst).toHaveBeenCalledWith({
      where: { tcgPlayerId: "tcg-1" },
    });
    expect(mockPrisma.pokemonCardCatalog.create).not.toHaveBeenCalled();

    // The admin's own id must NOT silently override the chosen ownerId —
    // this route intentionally lets an admin assign the card to anyone.
    expect(mockPrisma.listing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          game: "POKEMON",
          pokemonCardId: "catalog-1",
          owner: { connect: { id: "target-user-1" } },
        }),
      })
    );
  });

  it("creates a new catalog row when no existing one matches the submitted tcgPlayerId", async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION);
    mockPrisma.pokemonCardCatalog.findFirst.mockResolvedValue(null);
    mockPrisma.pokemonCardCatalog.create.mockResolvedValue({ id: "catalog-new" });
    mockPrisma.listing.create.mockResolvedValue({ id: "listing-1", ownerId: "target-user-1" });

    const res = await POST(postRequest(buildFormData()));
    expect(res.status).toBe(200);

    expect(mockPrisma.pokemonCardCatalog.create).toHaveBeenCalled();
    expect(mockPrisma.listing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pokemonCardId: "catalog-new" }),
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/api/cards/route.test.ts`
Expected: FAIL — the route still calls `prisma.card.create`, which doesn't exist on `mockPrisma`.

- [ ] **Step 3: Rewrite the route**

Replace the full contents of `src/app/api/cards/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";
import { dollarsToCents, centsToDollars } from "@/lib/money";
import {
  listingCatalogInclude,
  withListingDisplay,
  findOrCreatePokemonCatalogEntry,
} from "@/lib/listingDisplay";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/cards?forSale=true
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const forSaleParam = searchParams.get("forSale");
    const tcgPlayerIdParam = searchParams.get("tcgPlayerId");

    const where: Record<string, unknown> = {};
    if (forSaleParam === "true") where.forSale = true;
    // tcgPlayerId now lives on whichever catalog a listing points to, not on
    // Listing itself — match either catalog relation since the caller has no
    // way to know which game a given tcgPlayerId belongs to.
    if (tcgPlayerIdParam) {
      where.OR = [
        { pokemonCard: { tcgPlayerId: tcgPlayerIdParam } },
        { riftboundCard: { tcgPlayerId: tcgPlayerIdParam } },
      ];
    }

    const listings = await prisma.listing.findMany({
      where,
      include: {
        binder: true,
        // Public listing — email is deliberately excluded (nothing in the
        // frontend reads it here, and card owners' emails shouldn't be
        // exposed to anonymous marketplace visitors).
        owner: { select: { id: true, username: true } },
        ...listingCatalogInclude,
      },
      orderBy: { createdAt: "desc" },
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

// POST /api/cards
export async function POST(req: Request) {
  try {
    // This endpoint lets the caller assign the new card to ANY user (see
    // ownerId below) — it's an admin tool for listing cards on behalf of
    // sellers, not a self-service upload. The `isAdmin` gate on the /upload
    // page only hides the UI; without a server-side check here, anyone
    // could call this route directly and create a card owned by anyone.
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await req.formData();

    const title = formData.get("title") as string | null;
    const condition = formData.get("condition") as string | null;
    const description = (formData.get("description") as string | null) || "";
    const ownerId = formData.get("ownerId") as string | null;
    const setName = (formData.get("setName") as string | null) || "";
    const rarity = (formData.get("rarity") as string | null) || "";
    const forSale = formData.get("forSale") === "true";
    const tcgPlayerId = formData.get("tcgPlayerId") as string | null;
    const language = formData.get("language") as string | null;
    const cardNumber = (formData.get("cardNumber") as string | null) || "";

    // Price logic (may be omitted when NOT for sale)
    const priceRaw = formData.get("price");
    let price: number | null = null;

    if (typeof priceRaw === "string" && priceRaw.trim() !== "") {
      const dollars = parseFloat(priceRaw);
      if (!Number.isNaN(dollars)) price = dollarsToCents(dollars);
    }

    const priceRequiredButMissing =
      forSale && (price === null || Number.isNaN(price));

    const images = formData
      .getAll("images")
      .filter((v): v is File => v instanceof File);

    if (
      !title ||
      !condition ||
      !ownerId ||
      !tcgPlayerId ||
      !language ||
      images.length === 0 ||
      priceRequiredButMissing
    ) {
      console.error("❌ Missing required fields", {
        title,
        condition,
        ownerId,
        forSale,
        price,
        imagesCount: images.length,
        formKeys: Array.from(formData.keys()),
      });

      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const imageUrls: string[] = [];

    for (const image of images) {
      const arrayBuffer = await image.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const filename = `cards/${Date.now()}-${image.name}`;

      const { data, error } = await supabase.storage
        .from("card-images")
        .upload(filename, buffer, {
          contentType: image.type,
          upsert: true,
        });

      if (error) {
        console.error("❌ Supabase upload error:", error);
        throw error;
      }

      const { data: publicUrlData } = supabase.storage
        .from("card-images")
        .getPublicUrl(data.path);

      imageUrls.push(publicUrlData.publicUrl);
    }

    // The admin upload form only collects flat card-identity fields — it
    // doesn't know about the PokemonCardCatalog table. Reuse a catalog row
    // for repeated uploads of "the same" card (matched by tcgPlayerId), or
    // create one, instead of creating an orphaned catalog-less listing.
    const catalogEntry = await findOrCreatePokemonCatalogEntry(prisma, {
      title,
      setName,
      rarity,
      tcgPlayerId,
      language,
      cardNumber,
    });

    const listing = await prisma.listing.create({
      data: {
        game: "POKEMON",
        pokemonCardId: catalogEntry.id,
        price,
        condition,
        description,
        imageUrls,
        forSale,
        owner: { connect: { id: ownerId } },
      },
    });

    return NextResponse.json({ card: listing });
  } catch (error: any) {
    console.error("❌ Error creating card:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create card" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/api/cards/route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cards/route.ts src/__tests__/api/cards/route.test.ts
git commit -m "fix: rewire GET/POST /api/cards onto Listing + catalog tables"
```

---

### Task 3: `src/app/api/cards/[id]/route.ts` — GET (detail) and PUT (owner/admin update)

**Files:**
- Modify: `src/app/api/cards/[id]/route.ts`
- Modify: `src/__tests__/api/cards/get-card.test.ts`
- Modify: `src/__tests__/api/cards/put-card.test.ts`

**Interfaces:**
- Consumes: `listingCatalogInclude`, `withListingDisplay`, `findOrCreatePokemonCatalogEntry` from `@/lib/listingDisplay` (Task 1).

- [ ] **Step 1: Update the failing tests**

Replace the full contents of `src/__tests__/api/cards/get-card.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/cards/[id]
 *
 * Public card detail lookup + per-viewer watchlist flag. The card lookup and
 * the watchlist lookup are independent of each other and are fetched
 * concurrently via Promise.all. Card identity (title/rarity/etc.) is now
 * resolved from whichever catalog relation (pokemonCard/riftboundCard) is
 * populated on the Listing row.
 */

const mockPrisma = vi.hoisted(() => ({
  listing: { findUnique: vi.fn() },
  cardWatchlist: { findUnique: vi.fn() },
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
// The route module creates a Supabase client at module scope (used by PUT,
// not GET) — mock it out so importing the module doesn't require real
// SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY env vars, matching the pattern in
// route.test.ts and put-card.test.ts for this same route file.
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({})),
}));

import { GET } from "@/app/api/cards/[id]/route";

const LISTING = {
  id: "card-1",
  price: 5000,
  binder: null,
  owner: { id: "owner-1", username: "Ash" },
  _count: { watchlist: 3 },
  pokemonCard: {
    nameEn: "Charizard",
    rarity: "Rare Holo",
    setNameEn: "Base Set",
    language: "English",
    localId: "004",
    tcgPlayerId: "tcg-1",
  },
  riftboundCard: null,
};

describe("GET /api/cards/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.listing.findUnique.mockResolvedValue(LISTING);
    mockPrisma.cardWatchlist.findUnique.mockResolvedValue(null);
  });

  it("returns 404 when the card doesn't exist", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockPrisma.listing.findUnique.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/cards/card-1"), { params: { id: "card-1" } });
    expect(res.status).toBe(404);
  });

  it("returns watchlistedByUser: false and skips the watchlist query for an anonymous viewer", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/cards/card-1"), { params: { id: "card-1" } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.card.watchlistedByUser).toBe(false);
    expect(body.card.watchlistCount).toBe(3);
    expect(body.card.price).toBe(50); // cents → dollars
    expect(body.card.title).toBe("Charizard"); // resolved via pokemonCard
    expect(mockPrisma.cardWatchlist.findUnique).not.toHaveBeenCalled();
  });

  it("returns watchlistedByUser: true when the logged-in viewer has watchlisted this card", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "viewer-1" } });
    mockPrisma.cardWatchlist.findUnique.mockResolvedValue({ listingId: "card-1", userId: "viewer-1" });

    const res = await GET(new Request("http://localhost/api/cards/card-1"), { params: { id: "card-1" } });
    const body = await res.json();

    expect(body.card.watchlistedByUser).toBe(true);
    expect(mockPrisma.cardWatchlist.findUnique).toHaveBeenCalledWith({
      where: { listingId_userId: { listingId: "card-1", userId: "viewer-1" } },
    });
  });
});
```

Replace the full contents of `src/__tests__/api/cards/put-card.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * PUT /api/cards/[id]
 *
 * Owner-only update path: a card owner can toggle forSale/price on their own
 * card. Tests here cover the guard that blocks re-listing a card for sale
 * while it's locked in an active auction (POST /api/auctions sets
 * inAuction: true and forSale: false — this route must not let the owner
 * silently undo that via a separate PUT while bids are live).
 */

const mockPrisma = vi.hoisted(() => ({
  listing: { findUnique: vi.fn(), update: vi.fn() },
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    authOptions: {},
  };
});
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ storage: { from: vi.fn() } })),
}));

import { PUT } from "@/app/api/cards/[id]/route";

const OWNER_SESSION = { user: { id: "owner-1", role: "user" } };

function putRequest(fields: Record<string, string>) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.append(k, v);
  return new Request("http://localhost/api/cards/card-1", { method: "PUT", body });
}

const LISTING = {
  id: "card-1",
  ownerId: "owner-1",
  price: 1000,
  forSale: true,
  inAuction: false,
};

describe("PUT /api/cards/[id] — owner update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(OWNER_SESSION);
    mockPrisma.listing.findUnique.mockResolvedValue(LISTING);
    mockPrisma.listing.update.mockResolvedValue({ ...LISTING, price: 1500, forSale: true });
  });

  it("returns 409 when the owner tries to list a card for sale while it's in an active auction", async () => {
    mockPrisma.listing.findUnique.mockResolvedValue({ ...LISTING, inAuction: true, forSale: false });

    const res = await PUT(putRequest({ price: "15", forSale: "true" }), { params: { id: "card-1" } });

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      error: "Cannot list a card for sale while it is in an active auction",
    });
    expect(mockPrisma.listing.update).not.toHaveBeenCalled();
  });

  it("allows unlisting (forSale: false) even while in an active auction", async () => {
    mockPrisma.listing.findUnique.mockResolvedValue({ ...LISTING, inAuction: true, forSale: false });

    const res = await PUT(putRequest({ price: "", forSale: "false" }), { params: { id: "card-1" } });

    expect(res.status).toBe(200);
    expect(mockPrisma.listing.update).toHaveBeenCalled();
  });

  it("allows the normal price/forSale update when not in an auction", async () => {
    const res = await PUT(putRequest({ price: "15", forSale: "true" }), { params: { id: "card-1" } });

    expect(res.status).toBe(200);
    expect(mockPrisma.listing.update).toHaveBeenCalledWith({
      where: { id: "card-1" },
      data: { price: 1500, forSale: true },
    });
  });

  it("returns 400 when forSale is true and price is zero", async () => {
    const res = await PUT(putRequest({ price: "0", forSale: "true" }), { params: { id: "card-1" } });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: "Price must be greater than $0 when listing a card for sale",
    });
    expect(mockPrisma.listing.update).not.toHaveBeenCalled();
  });

  it("returns 400 when forSale is true and price is negative", async () => {
    const res = await PUT(putRequest({ price: "-5", forSale: "true" }), { params: { id: "card-1" } });
    expect(res.status).toBe(400);
    expect(mockPrisma.listing.update).not.toHaveBeenCalled();
  });
});

describe("PUT /api/cards/[id] — admin update with shared guard", () => {
  const ADMIN_SESSION = { user: { id: "admin-1", role: "admin" } };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION);
    mockPrisma.listing.findUnique.mockResolvedValue(LISTING);
  });

  it("returns 409 when the admin tries to list a card for sale while it's in an active auction", async () => {
    mockPrisma.listing.findUnique.mockResolvedValue({ ...LISTING, inAuction: true, forSale: false });

    // Admin request with full fields (title, condition, ownerId, etc.) — the
    // guard runs before admin-specific validation, so it should 409 before
    // image validation or catalog lookup matter, but we construct a
    // realistic request anyway.
    const adminFields = {
      title: "Charizard Holo",
      condition: "Mint",
      ownerId: "owner-1",
      tcgPlayerId: "base1-4",
      language: "English",
      forSale: "true",
      price: "100",
    };

    const res = await PUT(putRequest(adminFields), { params: { id: "card-1" } });

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      error: "Cannot list a card for sale while it is in an active auction",
    });
    expect(mockPrisma.listing.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/api/cards/get-card.test.ts src/__tests__/api/cards/put-card.test.ts`
Expected: FAIL — the route still calls `prisma.card.*`.

- [ ] **Step 3: Rewrite the route**

Replace the full contents of `src/app/api/cards/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions, isAdminOrOwner } from "@/lib/auth";
import { dollarsToCents, centsToDollars } from "@/lib/money";
import {
  listingCatalogInclude,
  withListingDisplay,
  findOrCreatePokemonCatalogEntry,
} from "@/lib/listingDisplay";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    const [listing, watchlistEntry] = await Promise.all([
      prisma.listing.findUnique({
        where: { id: params.id },
        include: {
          binder: true,
          // Public card detail page — email deliberately excluded (nothing in
          // the frontend reads it here, and card owners' emails shouldn't be
          // exposed to anonymous visitors).
          owner: { select: { id: true, username: true } },
          _count: { select: { watchlist: true } },
          ...listingCatalogInclude,
        },
      }),
      session?.user?.id
        ? prisma.cardWatchlist.findUnique({
            where: {
              listingId_userId: { listingId: params.id, userId: session.user.id },
            },
          })
        : Promise.resolve(null),
    ]);

    if (!listing) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    // Check if the requesting user has this card watchlisted
    const watchlistedByUser = !!watchlistEntry;

    const { _count, ...rest } = withListingDisplay(listing);
    return NextResponse.json({
      card: {
        ...rest,
        price: rest.price != null ? centsToDollars(rest.price) : null,
        watchlistCount: _count.watchlist,
        watchlistedByUser,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching card:", error);
    return NextResponse.json(
      { error: "Failed to fetch card" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const listing = await prisma.listing.findUnique({ where: { id: params.id } });
    if (!listing) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const isAdmin = session.user.role === "admin";

    if (!isAdminOrOwner(session, listing.ownerId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await req.formData();

    const forSale = formData.get("forSale") === "true";
    const priceRaw = formData.get("price");
    let price: number | null = null;
    if (typeof priceRaw === "string" && priceRaw.trim() !== "") {
      const dollars = parseFloat(priceRaw);
      if (!Number.isNaN(dollars)) price = dollarsToCents(dollars);
    }

    // A card mid-auction must not be re-listed for sale through this path —
    // POST /api/auctions already set forSale: false and inAuction: true to
    // lock it. Allowing forSale: true here would let Buy Now/offers run
    // concurrently with live bids (the same double-sale class of bug fixed
    // in the offer-accept and auction-creation guards).
    if (forSale && listing.inAuction) {
      return NextResponse.json(
        { error: "Cannot list a card for sale while it is in an active auction" },
        { status: 409 }
      );
    }

    if (forSale && (price == null || price <= 0)) {
      return NextResponse.json(
        { error: "Price must be greater than $0 when listing a card for sale" },
        { status: 400 }
      );
    }

    // Owner: only price + forSale
    if (!isAdmin) {
      const updated = await prisma.listing.update({
        where: { id: params.id },
        data: { price, forSale },
      });
      return NextResponse.json({
        card: {
          ...updated,
          price: updated.price != null ? centsToDollars(updated.price) : null,
        },
      });
    }

    // Admin: full update — same find-or-create catalog reuse as POST
    // /api/cards, since the admin edit form still submits flat identity
    // fields rather than a catalog id.
    const title = formData.get("title") as string;
    const condition = formData.get("condition") as string;
    const description = (formData.get("description") as string) || "";
    const ownerId = formData.get("ownerId") as string;
    const setName = (formData.get("setName") as string) || "";
    const rarity = (formData.get("rarity") as string) || "";
    const tcgPlayerId = formData.get("tcgPlayerId") as string;
    const language = formData.get("language") as string;
    const cardNumber = (formData.get("cardNumber") as string) || "";

    // Existing image URLs the client wants to keep
    const keepRaw = formData.get("keepImageUrls") as string | null;
    const keepImageUrls: string[] = keepRaw ? JSON.parse(keepRaw) : [];

    // Upload any new images
    const newImages = formData
      .getAll("images")
      .filter((v): v is File => v instanceof File);
    const newImageUrls: string[] = [];

    for (const image of newImages) {
      const buffer = Buffer.from(await image.arrayBuffer());
      const filename = `cards/${Date.now()}-${image.name}`;
      const { data, error } = await supabase.storage
        .from("card-images")
        .upload(filename, buffer, { contentType: image.type, upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage
        .from("card-images")
        .getPublicUrl(data.path);
      newImageUrls.push(pub.publicUrl);
    }

    const imageUrls = [...keepImageUrls, ...newImageUrls];
    if (imageUrls.length === 0) {
      return NextResponse.json(
        { error: "At least one image is required" },
        { status: 400 }
      );
    }

    const catalogEntry = await findOrCreatePokemonCatalogEntry(prisma, {
      title,
      setName,
      rarity,
      tcgPlayerId,
      language,
      cardNumber,
    });

    const updated = await prisma.listing.update({
      where: { id: params.id },
      data: {
        pokemonCardId: catalogEntry.id,
        price,
        condition,
        description,
        imageUrls,
        forSale,
        owner: { connect: { id: ownerId } },
      },
    });

    return NextResponse.json({
      card: {
        ...updated,
        price: updated.price != null ? centsToDollars(updated.price) : null,
      },
    });
  } catch (error: any) {
    console.error("❌ Error updating card:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update card" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/api/cards/get-card.test.ts src/__tests__/api/cards/put-card.test.ts`
Expected: PASS (3 + 6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cards/[id]/route.ts src/__tests__/api/cards/get-card.test.ts src/__tests__/api/cards/put-card.test.ts
git commit -m "fix: rewire GET/PUT /api/cards/[id] onto Listing + catalog tables"
```

---

### Task 4: `src/app/api/cards/[id]/watchlist/route.ts` — toggle watchlist

**Files:**
- Modify: `src/app/api/cards/[id]/watchlist/route.ts`
- Modify: `src/__tests__/api/watchlist/toggle.test.ts`

**Interfaces:** None — this route only renames identifiers, it doesn't need the catalog resolver (the watchlist toggle never reads card identity).

- [ ] **Step 1: Update the failing test**

Replace the full contents of `src/__tests__/api/watchlist/toggle.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * POST /api/cards/[id]/watchlist
 *
 * Toggles the watchlist status for the authenticated user on a specific
 * listing. If the user has not watchlisted the listing, it adds it. If they
 * have, it removes it. Returns { watchlisted: boolean, count: number } in
 * both cases.
 */

// ── STEP 1: Create mock objects ───────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  cardWatchlist: {
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

// ── STEP 2: Register fakes ────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

// ── STEP 3: Import code under test ────────────────────────────────────────────

import { POST } from "@/app/api/cards/[id]/watchlist/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

const PARAMS = { params: { id: "card-1" } };
const SESSION = { user: { id: "user-1" } };

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/cards/[id]/watchlist
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/cards/[id]/watchlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockPrisma.cardWatchlist.count.mockResolvedValue(1);
  });

  // What's being tested: the auth gate.
  //
  // Unauthenticated requests must be rejected before any DB access.

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await POST(new NextRequest("http://localhost"), PARAMS);
    expect(res.status).toBe(401);
    expect(mockPrisma.cardWatchlist.findUnique).not.toHaveBeenCalled();
  });

  // What's being tested: the add path.
  //
  // When the user has not watchlisted the listing (findUnique returns null),
  // the route must create a new entry and return watchlisted: true.

  it("adds the card when not already watchlisted", async () => {
    mockPrisma.cardWatchlist.findUnique.mockResolvedValueOnce(null);
    mockPrisma.cardWatchlist.create.mockResolvedValueOnce({});
    mockPrisma.cardWatchlist.count.mockResolvedValueOnce(5);

    const res = await POST(new NextRequest("http://localhost"), PARAMS);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ watchlisted: true, count: 5 });
    expect(mockPrisma.cardWatchlist.create).toHaveBeenCalledWith({
      data: { listingId: "card-1", userId: "user-1" },
    });
    expect(mockPrisma.cardWatchlist.delete).not.toHaveBeenCalled();
  });

  // What's being tested: the remove path.
  //
  // When the user has already watchlisted the listing (findUnique returns a
  // row), the route must delete that row and return watchlisted: false.

  it("removes the card when already watchlisted", async () => {
    const existing = { id: "wl-entry-1", listingId: "card-1", userId: "user-1" };
    mockPrisma.cardWatchlist.findUnique.mockResolvedValueOnce(existing);
    mockPrisma.cardWatchlist.delete.mockResolvedValueOnce({});
    mockPrisma.cardWatchlist.count.mockResolvedValueOnce(4);

    const res = await POST(new NextRequest("http://localhost"), PARAMS);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ watchlisted: false, count: 4 });
    expect(mockPrisma.cardWatchlist.delete).toHaveBeenCalledWith({
      where: { id: "wl-entry-1" },
    });
    expect(mockPrisma.cardWatchlist.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/api/watchlist/toggle.test.ts`
Expected: FAIL — the route still uses the `cardId_userId` compound key and `{ cardId, userId }` data shape.

- [ ] **Step 3: Rewrite the route**

Replace the full contents of `src/app/api/cards/[id]/watchlist/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * POST /api/cards/[id]/watchlist
 * Toggles the watchlist status for the current user on a specific listing.
 * Returns { watchlisted: boolean, count: number }.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const listingId = params.id;
  const userId = session.user.id;

  // Check if the user already has this listing watchlisted
  const existing = await prisma.cardWatchlist.findUnique({
    where: { listingId_userId: { listingId, userId } },
  });

  if (existing) {
    await prisma.cardWatchlist.delete({ where: { id: existing.id } });
  } else {
    await prisma.cardWatchlist.create({ data: { listingId, userId } });
  }

  const count = await prisma.cardWatchlist.count({ where: { listingId } });

  // watchlisted: true if we just added it (existing was null), false if we just removed it
  return NextResponse.json({ watchlisted: !existing, count });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/api/watchlist/toggle.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cards/[id]/watchlist/route.ts src/__tests__/api/watchlist/toggle.test.ts
git commit -m "fix: rewire POST /api/cards/[id]/watchlist onto listingId"
```

---

### Task 5: `src/app/api/watchlist/route.ts` — list current user's watchlist

**Files:**
- Modify: `src/app/api/watchlist/route.ts`
- Modify: `src/__tests__/api/watchlist/route.test.ts`

**Interfaces:**
- Consumes: `listingCatalogInclude`, `withListingDisplay` from `@/lib/listingDisplay` (Task 1).

- [ ] **Step 1: Update the failing test**

Replace the full contents of `src/__tests__/api/watchlist/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/watchlist
 *
 * Returns all listings the authenticated user has watchlisted, newest first.
 * Prices are stored in cents in the DB and converted to dollars in the
 * response. Card identity is resolved from whichever catalog relation
 * (pokemonCard/riftboundCard) is populated on the listing.
 */

// ── STEP 1: Create mock objects ───────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  cardWatchlist: {
    findMany: vi.fn(),
  },
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

// ── STEP 2: Register fakes ────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

// ── STEP 3: Import code under test ────────────────────────────────────────────

import { GET } from "@/app/api/watchlist/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

const SESSION = { user: { id: "user-1" } };

function makeWatchlistEntry(listingId: string, priceInCents: number | null) {
  return {
    listing: {
      id: listingId,
      price: priceInCents,
      condition: "NM",
      forSale: true,
      imageUrls: [],
      status: "available",
      description: "",
      binderId: null,
      pokemonCard: {
        nameEn: `Card ${listingId}`,
        rarity: "Rare",
        setNameEn: "Base Set",
        language: "English",
        localId: "001",
        tcgPlayerId: null,
      },
      riftboundCard: null,
      // No email here: a mocked findMany call bypasses Prisma's `select`
      // entirely, so this fixture must mirror what the corrected
      // { id, username } select actually returns in production.
      owner: { id: "owner-1", username: "Ash" },
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
    },
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/watchlist
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /api/watchlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  // What's being tested: the auth gate.
  //
  // Unauthenticated requests must be rejected before any DB access.

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mockPrisma.cardWatchlist.findMany).not.toHaveBeenCalled();
  });

  // What's being tested: price conversion and response shape.
  //
  // The DB stores prices in cents; the API must return them as dollars.
  // Listings with null prices must pass through as null (not 0 or undefined).

  it("returns watchlisted cards with prices converted from cents to dollars", async () => {
    mockPrisma.cardWatchlist.findMany.mockResolvedValueOnce([
      makeWatchlistEntry("c1", 1000), // 1000 cents → $10
      makeWatchlistEntry("c2", null), // no price → null
    ]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cards).toHaveLength(2);
    expect(body.cards[0].id).toBe("c1");
    expect(body.cards[0].price).toBe(10);
    expect(body.cards[0].title).toBe("Card c1");
    expect(body.cards[1].price).toBeNull();
  });

  // What's being tested: the query is scoped to the requesting user and ordered
  // newest-first so the watchlist page shows recent additions at the top.

  it("queries by userId and orders by createdAt desc", async () => {
    mockPrisma.cardWatchlist.findMany.mockResolvedValueOnce([]);

    await GET();

    expect(mockPrisma.cardWatchlist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        orderBy: { createdAt: "desc" },
      })
    );
  });

  // What's being tested: empty state — user has no watchlisted cards.
  //
  // The response should still be a valid { cards: [] } object, not an error.

  it("returns an empty cards array when the user has no watchlisted cards", async () => {
    mockPrisma.cardWatchlist.findMany.mockResolvedValueOnce([]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cards).toEqual([]);
  });

  // What's being tested: the listing owner's email must never reach the
  // response. Commit 6410447 already fixed this for /api/cards and
  // /api/cards/[id] — this route was missed. Watchlisting a card requires
  // no relationship with the seller, so there's no reason to expose it.

  it("never includes the listing owner's email in the response", async () => {
    mockPrisma.cardWatchlist.findMany.mockResolvedValueOnce([
      makeWatchlistEntry("c1", 1000),
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body.cards[0].owner).toEqual({ id: "owner-1", username: "Ash" });
    expect(body.cards[0].owner.email).toBeUndefined();

    // Because the mock above already returns an email-free owner regardless
    // of what select we pass Prisma, the response-body assertions above
    // can't actually prove the fix — reverting `owner: { select: { id, username } }`
    // back to including `email: true` would still pass them. Assert on the
    // call arguments themselves so this test fails if that select is widened.
    const findManyArgs = mockPrisma.cardWatchlist.findMany.mock.calls[0][0];
    expect(findManyArgs.include.listing.include.owner).toEqual({
      select: { id: true, username: true },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/api/watchlist/route.test.ts`
Expected: FAIL — the route still reads `entries.map(({ card }) => ...)`.

- [ ] **Step 3: Rewrite the route**

Replace the full contents of `src/app/api/watchlist/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { centsToDollars } from "@/lib/money";
import { listingCatalogInclude, withListingDisplay } from "@/lib/listingDisplay";

/**
 * GET /api/watchlist
 * Returns all listings the authenticated user has watchlisted, newest first.
 * Used by the /watchlist page.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const entries = await prisma.cardWatchlist.findMany({
    where: { userId },
    include: {
      listing: {
        include: {
          // Watchlisting a card requires no relationship with the seller —
          // email deliberately excluded, same rationale as cards/route.ts.
          owner: { select: { id: true, username: true } },
          ...listingCatalogInclude,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const cards = entries.map(({ listing }) => {
    const withDisplay = withListingDisplay(listing);
    return {
      ...withDisplay,
      price: withDisplay.price != null ? centsToDollars(withDisplay.price) : null,
    };
  });

  return NextResponse.json({ cards });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/api/watchlist/route.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/watchlist/route.ts src/__tests__/api/watchlist/route.test.ts
git commit -m "fix: rewire GET /api/watchlist onto Listing + catalog tables"
```

---

### Task 6: `src/app/api/user/cards/route.ts` — current user's own listings

**Files:**
- Modify: `src/app/api/user/cards/route.ts`
- Create: `src/__tests__/api/user/cards/route.test.ts` (no test previously existed for this route)

**Interfaces:**
- Consumes: `listingCatalogInclude`, `withListingDisplay` from `@/lib/listingDisplay` (Task 1).

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/api/user/cards/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/user/cards
 *
 * Returns the authenticated user's own listings (used by the "My Cards"
 * page), including their binder assignment. Card identity is resolved from
 * whichever catalog relation (pokemonCard/riftboundCard) is populated.
 */

const mockPrisma = vi.hoisted(() => ({
  listing: { findMany: vi.fn() },
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { GET } from "@/app/api/user/cards/route";

const SESSION = { user: { id: "user-1" } };

const LISTING = {
  id: "listing-1",
  ownerId: "user-1",
  price: 1000,
  binder: { id: "binder-1", name: "Main Binder" },
  pokemonCard: {
    nameEn: "Blastoise",
    rarity: "Holo Rare",
    setNameEn: "Base Set",
    language: "English",
    localId: "002",
    tcgPlayerId: "tcg-2",
  },
  riftboundCard: null,
};

describe("GET /api/user/cards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockPrisma.listing.findMany.mockResolvedValue([LISTING]);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await GET(new Request("http://localhost/api/user/cards"));
    expect(res.status).toBe(401);
    expect(mockPrisma.listing.findMany).not.toHaveBeenCalled();
  });

  it("returns the user's listings with resolved display fields", async () => {
    const res = await GET(new Request("http://localhost/api/user/cards"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cards).toHaveLength(1);
    expect(body.cards[0].id).toBe("listing-1");
    expect(body.cards[0].title).toBe("Blastoise");
    expect(body.cards[0].binder).toEqual({ id: "binder-1", name: "Main Binder" });
    expect(body.cards[0]).not.toHaveProperty("pokemonCard");
    expect(body.cards[0]).not.toHaveProperty("riftboundCard");
  });

  it("scopes the query to the requesting user's own listings, newest first, with binder and catalog included", async () => {
    await GET(new Request("http://localhost/api/user/cards"));

    expect(mockPrisma.listing.findMany).toHaveBeenCalledWith({
      where: { ownerId: "user-1" },
      include: {
        binder: true,
        pokemonCard: true,
        riftboundCard: true,
      },
      orderBy: { createdAt: "desc" },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/api/user/cards/route.test.ts`
Expected: FAIL — the route still calls `prisma.card.findMany`.

- [ ] **Step 3: Rewrite the route**

Replace the full contents of `src/app/api/user/cards/route.ts`:

```ts
// app/api/user/cards/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listingCatalogInclude, withListingDisplay } from "@/lib/listingDisplay";

// GET /api/user/cards
export async function GET(_req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const listings = await prisma.listing.findMany({
      where: { ownerId: session.user.id },
      include: {
        binder: true,
        ...listingCatalogInclude,
      },
      orderBy: { createdAt: "desc" },
    });

    const cards = listings.map((listing) => withListingDisplay(listing));

    return NextResponse.json({ cards });
  } catch (error: any) {
    console.error("❌ Error fetching user cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch user's cards" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/api/user/cards/route.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/user/cards/route.ts src/__tests__/api/user/cards/route.test.ts
git commit -m "fix: rewire GET /api/user/cards onto Listing + catalog tables"
```

---

### Task 7: `src/app/api/home/featured/route.ts` — homepage data (the route actively crashing the dev server)

**Files:**
- Modify: `src/app/api/home/featured/route.ts`
- Modify: `src/__tests__/api/home/featured.test.ts`

**Interfaces:**
- Consumes: `listingCatalogInclude`, `withListingDisplay` from `@/lib/listingDisplay` (Task 1).

This is the route from the crash log (`TypeError: Cannot read properties of undefined (reading 'findMany')`, `relation "Card" does not exist`). Besides the model rename, its raw SQL query joins `"Card"` directly — that join is now not just wrong but also unnecessary, since `CardTransaction.tcgPlayerId` is already a denormalized column (confirmed in `prisma/schema.prisma`) and never needed the join to read.

- [ ] **Step 1: Update the failing test**

Replace the full contents of `src/__tests__/api/home/featured.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/home/featured
 *
 * Public, unauthenticated homepage data source (best sellers, highest
 * transacted, newly listed, auctions ending soon). Because it has no auth
 * check at all, it must never include a listing owner's email — anyone can
 * curl this endpoint. Commit 6410447 fixed the equivalent leak on
 * /api/cards and /api/cards/[id]; this route was missed.
 *
 * Card identity (title/rarity/etc.) is resolved from whichever catalog
 * relation (pokemonCard/riftboundCard) is populated on each listing.
 */

const mockPrisma = vi.hoisted(() => ({
  bestSeller: { findMany: vi.fn() },
  listing: { findFirst: vi.fn(), findMany: vi.fn() },
  auction: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/home/featured/route";

function makeListing(overrides: Partial<any> = {}) {
  return {
    id: "card-1",
    price: 1000,
    forSale: true,
    binder: null,
    owner: { id: "owner-1", username: "Ash" },
    pokemonCard: {
      nameEn: "Charizard",
      rarity: "Rare Holo",
      setNameEn: "Base Set",
      language: "English",
      localId: "004",
      tcgPlayerId: "tcg-1",
    },
    riftboundCard: null,
    ...overrides,
  };
}

function makeAuction(overrides: Partial<any> = {}) {
  return {
    id: "auction-1",
    listingId: "card-1",
    sellerId: "owner-1",
    startingBid: 500,
    reservePrice: null,
    buyOutPrice: null,
    currentBid: null,
    highestBidderId: null,
    status: "active",
    endsAt: new Date("2026-01-01"),
    sellerDecisionDeadline: null,
    version: 1,
    _count: { bids: 0 },
    listing: {
      id: "card-1",
      imageUrls: [],
      condition: "NM",
      inAuction: true,
      owner: { id: "owner-1", username: "Ash" },
      pokemonCard: {
        nameEn: "Charizard",
        rarity: "Rare Holo",
        setNameEn: "Base Set",
        language: "English",
        localId: "004",
        tcgPlayerId: "tcg-1",
      },
      riftboundCard: null,
    },
    ...overrides,
  };
}

describe("GET /api/home/featured", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.bestSeller.findMany.mockResolvedValue([{ tcgPlayerId: "tcg-1" }]);
    mockPrisma.listing.findFirst.mockResolvedValue(makeListing());
    mockPrisma.$queryRaw.mockResolvedValue([{ tcgPlayerId: "tcg-1", count: BigInt(3) }]);
    mockPrisma.listing.findMany.mockResolvedValue([makeListing()]);
    mockPrisma.auction.findMany.mockResolvedValue([]);
  });

  it("resolves card identity fields via the catalog relation for bestSellers, highestTransacted, and newlyListed", async () => {
    const res = await GET();
    const body = await res.json();

    for (const list of [body.bestSellers, body.highestTransacted, body.newlyListed]) {
      for (const card of list) {
        expect(card.title).toBe("Charizard");
        expect(card).not.toHaveProperty("pokemonCard");
        expect(card).not.toHaveProperty("riftboundCard");
      }
    }
  });

  it("never includes the listing owner's email in bestSellers, highestTransacted, or newlyListed", async () => {
    const res = await GET();
    const body = await res.json();

    for (const list of [body.bestSellers, body.highestTransacted, body.newlyListed]) {
      for (const card of list) {
        expect(card.owner).toEqual({ id: "owner-1", username: "Ash" });
        expect(card.owner.email).toBeUndefined();
      }
    }

    // The response-body assertions above can't actually prove the fix: the
    // mocks return an email-free owner regardless of what select the route
    // passes to Prisma, so reverting `listingInclude.owner`'s select back to
    // including `email: true` would still pass them. Assert on the actual
    // call arguments for every call site that shares `listingInclude` — the
    // findFirst calls driving bestSellers/highestTransacted, and the
    // findMany call driving newlyListed — so this test fails if that
    // select is ever widened again.
    expect(mockPrisma.listing.findFirst.mock.calls.length).toBeGreaterThan(0);
    for (const [args] of mockPrisma.listing.findFirst.mock.calls) {
      expect(args.include.owner).toEqual({ select: { id: true, username: true } });
    }

    const findManyArgs = mockPrisma.listing.findMany.mock.calls[0][0];
    expect(findManyArgs.include.owner).toEqual({ select: { id: true, username: true } });
  });

  it("matches bestSellers/highestTransacted against either catalog relation's tcgPlayerId", async () => {
    await GET();

    for (const [args] of mockPrisma.listing.findFirst.mock.calls) {
      expect(args.where.OR).toEqual([
        { pokemonCard: { tcgPlayerId: "tcg-1" } },
        { riftboundCard: { tcgPlayerId: "tcg-1" } },
      ]);
      expect(args.where.forSale).toBe(true);
    }
  });

  it("queries transaction counts directly off CardTransaction without joining a card table", async () => {
    await GET();

    const [sqlParts] = mockPrisma.$queryRaw.mock.calls[0];
    const sql = sqlParts.join("");
    expect(sql).toContain("CardTransaction");
    expect(sql).not.toContain("JOIN");
    expect(sql).not.toMatch(/"Card"/);
  });

  it("resolves auction card display fields and preserves the AuctionCard response shape", async () => {
    mockPrisma.auction.findMany.mockResolvedValueOnce([makeAuction()]);

    const res = await GET();
    const body = await res.json();

    expect(body.auctionsEndingSoon).toHaveLength(1);
    const auctionCard = body.auctionsEndingSoon[0].card;
    expect(auctionCard.title).toBe("Charizard");
    expect(auctionCard.owner).toEqual({ id: "owner-1", username: "Ash" });
    expect(auctionCard).not.toHaveProperty("pokemonCard");
    expect(auctionCard).not.toHaveProperty("riftboundCard");

    const auctionArgs = mockPrisma.auction.findMany.mock.calls[0][0];
    expect(auctionArgs.include.listing.select.pokemonCard).toBe(true);
    expect(auctionArgs.include.listing.select.riftboundCard).toBe(true);
  });

  // What's being tested: the four independent query groups (bestSellers,
  // highestTransacted, newlyListed, auctionsEndingSoon) must be issued
  // concurrently, not one after another — none of them depends on another's
  // result. This test proves concurrency by using manually-controlled
  // ("deferred") promises: if the route awaited them sequentially, only the
  // first mock would be invoked before this assertion runs; if it uses
  // Promise.all (or an equivalent), all four are invoked before any resolve.

  it("issues all four independent query groups concurrently", async () => {
    const started: string[] = [];
    const finishers: Record<string, (v: any) => void> = {};

    function deferred(name: string, value: any) {
      started.push(name);
      return new Promise((resolve) => {
        finishers[name] = () => resolve(value);
      });
    }

    mockPrisma.bestSeller.findMany.mockImplementation(() => deferred("bestSeller", []));
    mockPrisma.$queryRaw.mockImplementation(() => deferred("queryRaw", []));
    mockPrisma.listing.findMany.mockImplementation(() => deferred("newlyListed", []));
    mockPrisma.auction.findMany.mockImplementation(() => deferred("endingSoon", []));

    const resPromise = GET();
    await Promise.resolve(); // let the handler run up to its first await boundary
    await Promise.resolve(); // and its microtask continuations

    expect(started.sort()).toEqual(["bestSeller", "endingSoon", "newlyListed", "queryRaw"]);

    Object.values(finishers).forEach((finish) => finish(undefined));
    await resPromise;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/api/home/featured.test.ts`
Expected: FAIL — the route still calls `prisma.card.*` and joins `"Card"` in raw SQL.

- [ ] **Step 3: Rewrite the route**

Replace the full contents of `src/app/api/home/featured/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { centsToDollars } from "@/lib/money";
import { listingCatalogInclude, withListingDisplay } from "@/lib/listingDisplay";

function mapCard(listing: any) {
  const withDisplay = withListingDisplay(listing);
  return {
    ...withDisplay,
    price: withDisplay.price != null ? centsToDollars(withDisplay.price) : null,
  };
}

// ── Converts a DB Auction row to the API response shape ──────────────────────
// Mirrors the formatAuction function in /api/auctions/route.ts.
function formatAuction(auction: {
  id: string; listingId: string; sellerId: string;
  startingBid: number; reservePrice: number | null; buyOutPrice: number | null;
  currentBid: number | null; highestBidderId: string | null;
  status: string; endsAt: Date; sellerDecisionDeadline: Date | null;
  version: number;
  _count: { bids: number };
  listing: any;
}) {
  return {
    id:                     auction.id,
    cardId:                 auction.listingId,
    sellerId:               auction.sellerId,
    startingBid:            centsToDollars(auction.startingBid),
    reservePrice:           auction.reservePrice   != null ? centsToDollars(auction.reservePrice)   : null,
    buyOutPrice:            auction.buyOutPrice    != null ? centsToDollars(auction.buyOutPrice)    : null,
    currentBid:             auction.currentBid     != null ? centsToDollars(auction.currentBid)     : null,
    highestBidderId:        auction.highestBidderId,
    status:                 auction.status,
    endsAt:                 auction.endsAt.toISOString(),
    sellerDecisionDeadline: auction.sellerDecisionDeadline?.toISOString() ?? null,
    version:                auction.version,
    bidCount:               auction._count.bids,
    card:                   withListingDisplay(auction.listing),
  };
}

const AUCTION_LISTING_SELECT = {
  id: true, imageUrls: true, condition: true, inAuction: true,
  owner: { select: { id: true, username: true } },
  pokemonCard: true,
  riftboundCard: true,
} as const;

const listingInclude = {
  // Public, unauthenticated endpoint — email deliberately excluded, same
  // rationale as src/app/api/cards/route.ts and cards/[id]/route.ts.
  owner: { select: { id: true, username: true } },
  binder: true,
  ...listingCatalogInclude,
} as const;

export async function GET() {
  try {
    const [bestSellers, highestTransacted, newlyListedRaw, endingSoonRaw] = await Promise.all([
      // Best Sellers: admin-curated, ordered by position.
      // Fetch all rows then slice to 5 *after* filtering out any tcgPlayerIds that
      // have no forSale listing — prevents a null hole from shrinking the visible row.
      (async () => {
        const bestSellerRows = await prisma.bestSeller.findMany({
          orderBy: { position: "asc" },
        });
        return (
          await Promise.all(
            bestSellerRows.map(({ tcgPlayerId }) =>
              prisma.listing.findFirst({
                where: {
                  forSale: true,
                  OR: [
                    { pokemonCard: { tcgPlayerId } },
                    { riftboundCard: { tcgPlayerId } },
                  ],
                },
                include: listingInclude,
                orderBy: { price: "asc" },
              })
            )
          )
        )
          .filter(Boolean)
          .slice(0, 5)
          .map(mapCard);
      })(),

      // Highest Transacted: group transactions by tcgPlayerId — already a
      // denormalized column on CardTransaction, no join needed — then fetch
      // the cheapest forSale listing for each.
      (async () => {
        const topTcgPlayerIds = await prisma.$queryRaw<
          Array<{ tcgPlayerId: string; count: bigint }>
        >`
          SELECT ct."tcgPlayerId", COUNT(*) AS count
          FROM "CardTransaction" ct
          WHERE ct."tcgPlayerId" IS NOT NULL
          GROUP BY ct."tcgPlayerId"
          ORDER BY count DESC
          LIMIT 5
        `;
        return (
          await Promise.all(
            topTcgPlayerIds.map(({ tcgPlayerId }) =>
              prisma.listing.findFirst({
                where: {
                  forSale: true,
                  OR: [
                    { pokemonCard: { tcgPlayerId } },
                    { riftboundCard: { tcgPlayerId } },
                  ],
                },
                include: listingInclude,
                orderBy: { price: "asc" },
              })
            )
          )
        )
          .filter(Boolean)
          .map(mapCard);
      })(),

      // Newly Listed: 5 most recent forSale listings
      prisma.listing.findMany({
        where: { forSale: true },
        include: listingInclude,
        orderBy: { createdAt: "desc" },
        take: 5,
      }),

      // Auctions Ending Soon: 5 active auctions with the earliest end time.
      // Mirrors GET /api/auctions?expiringSoon=true so HomeFeatured can render
      // the auction row immediately without a separate client-side fetch.
      prisma.auction.findMany({
        where:   { status: "active", endsAt: { gt: new Date() } },
        include: { listing: { select: AUCTION_LISTING_SELECT }, _count: { select: { bids: true } } },
        orderBy: { endsAt: "asc" },
        take:    5,
      }),
    ]);

    return NextResponse.json({
      bestSellers,
      highestTransacted,
      newlyListed:        newlyListedRaw.map(mapCard),
      auctionsEndingSoon: endingSoonRaw.map(formatAuction),
    });
  } catch (error) {
    console.error("❌ Error fetching featured cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch featured cards" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/api/home/featured.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, all tests green (this is the last task in the plan — this is the point to confirm nothing outside this plan's direct scope regressed).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/home/featured/route.ts src/__tests__/api/home/featured.test.ts
git commit -m "fix: rewire GET /api/home/featured onto Listing + catalog tables, drop dead Card join"
```

---

## Manual Verification (after all tasks complete)

The plan's tests mock Prisma, so they can't prove the dev server actually starts and serves real data. Before finishing this branch:

1. Start the dev server (`pnpm dev`) and confirm the homepage (`/`) loads without the `relation "Card" does not exist` / `Cannot read properties of undefined` errors from the original crash log.
2. Visit a card detail page, the watchlist page, and "My Cards" — confirm titles/rarity/set names render correctly for the seeded Pokémon and Riftbound listings.
3. As an admin, upload a new card through the existing upload form and confirm it appears correctly (proves the `findOrCreatePokemonCatalogEntry` catalog-reuse path works end-to-end against the real database, not just mocks).
