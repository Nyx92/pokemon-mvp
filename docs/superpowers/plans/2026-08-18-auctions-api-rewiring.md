# Auctions API Rewiring (Plan 2d) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every Auctions backend file still calling the pre-rename Prisma model `Card`/`cardId` (renamed to `Listing`/`listingId` with catalog tables in a prior plan), so a seller can start an auction, buyers can bid, the seller can accept/reject a below-reserve bid, and the expiry cron keeps closing ended auctions correctly.

**Architecture:** Same pattern as Plans 2a/2b/2c: resolve card-identity fields via the existing `src/lib/listingDisplay.ts` helper (`listingCatalogInclude`, `withListingDisplay`), unmodified by this plan. External wire contracts stay exactly as they are today — the `AuctionItem`/`AuctionCard` JSON shape (`src/types/auction.ts`, unmodified) keeps its `cardId` field and nested `card: {...}` object exactly as-is; only internal Prisma calls change. This plan runs independently of and concurrently with Plan 2c (Offers) — the two touch entirely disjoint files (confirmed during planning). The one cross-plan interaction is read-only: this plan's `auctions/route.ts` queries the `Offer` model (to block starting an auction on a card with a pending offer) using `Offer.listingId`, which Plan 2c's work also reads/writes — no shared file, no ordering dependency.

**Tech Stack:** Next.js 14 App Router route handlers, Prisma 6, Stripe SDK, Vitest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-08-17-riftbound-card-schema-design.md` — same relationship as Plans 2a/2b/2c: a direct continuation of that architectural work.

## Global Constraints

- **No schema changes.** Confirmed field names from `prisma/schema.prisma`: `Auction.listingId` (renamed from `cardId`), `Order.listingId`, `CardTransaction.listingId`. `Bid` has NO card/listing reference at all (only `auctionId`/`bidderId`) — untouched by this rename entirely. `Listing`'s own scalar fields (`price`, `condition`, `imageUrls`, `forSale`, `ownerId`, `reservedById`, `reservedUntil`, `inAuction`) are unchanged from the old `Card` model.
- **External wire contracts are preserved exactly.** Request bodies (`{ cardId, startingBid, ... }`), the `AuctionItem`/`AuctionCard` response shape (`src/types/auction.ts`, unmodified — still has `cardId`, `card: {...}`), and Stripe PI metadata all keep the literal string `cardId`/`card` — only internal Prisma field names change to `listingId`/`listing`.
- **`notifyAsync`'s `cardId` parameter is unchanged** (fixed in Plan 2b's Task 1) — every call in this plan keeps passing `cardId: <the listing's id>`.
- **`src/lib/paymentIntentGuard.ts` needs NO changes.** Checked during planning — `verifyPaymentIntentAmountOrRespond()` only takes a Stripe client, PI id, and two amounts; it never references Card/Listing. Not included as a task.
- **The `formatAuction`/catalog-select pattern already exists** in `src/app/api/home/featured/route.ts` (fixed in Plan 2a) — this plan's `auctions/route.ts` Task reuses the identical shape (a `LISTING_SELECT` constant with `pokemonCard: true, riftboundCard: true` plus base auction-card fields, and a `formatAuction` that calls `withListingDisplay`), so the two files' auction-formatting logic stays consistent across the app.
- Prices are stored in cents; `dollarsToCents`/`centsToDollars` from `@/lib/money` convert at API boundaries, exactly where the current code already does.
- Test files follow this codebase's existing mock pattern: `vi.hoisted(() => ({...}))` to build the mock object, `vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))` to register it, then `import` the route under test.

---

### Task 1: `src/app/api/auctions/route.ts` — GET (list) and POST (create)

**Files:**
- Modify: `src/app/api/auctions/route.ts`
- Modify: `src/__tests__/api/auctions/list.test.ts`
- Modify: `src/__tests__/api/auctions/create.test.ts`

**Interfaces:**
- Consumes: `listingCatalogInclude`, `withListingDisplay` from `@/lib/listingDisplay`.
- Produces (used by no other task, but the same shape is reused by Task 2): a `LISTING_SELECT` constant and `formatAuction()` function, local to this file (each auction-serving route defines its own copy, matching the existing pattern where `home/featured/route.ts` has its own `AUCTION_LISTING_SELECT`/`formatAuction` rather than a shared import — consistent with this codebase's existing duplication convention for this exact shape).

- [ ] **Step 1: Update the failing tests**

Replace the full contents of `src/__tests__/api/auctions/list.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * GET /api/auctions — list auctions.
 *
 * Three query modes:
 *   ?cardId=xxx        — active/pending_seller_decision auction for one card (card detail page)
 *   ?expiringSoon=true — top-5 active auctions still in the future (homepage row)
 *   (no params)        — all active auctions still in the future (browse page)
 *
 * The Auction model's card reference is `listingId` (renamed from `cardId`);
 * card identity (title, rarity, etc.) is resolved from whichever catalog
 * relation (pokemonCard/riftboundCard) the listing points to. The external
 * response shape (cardId, nested card: {...}) is unchanged.
 */

// ── STEP 1: Create the mock objects ──────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  auction: {
    findMany:  vi.fn(),
    findFirst: vi.fn(),
  },
}));

// ── STEP 2: Register the fakes ────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth",    () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth",   () => ({ authOptions: {} }));

// ── STEP 3: Import the code under test ───────────────────────────────────────

import { GET } from "@/app/api/auctions/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getReq(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/auctions");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

// Minimal DB auction row (prices in cents, as Prisma returns them)
function makeDbAuction(overrides: Partial<{
  id:      string;
  endsAt:  Date;
  status:  string;
}> = {}) {
  return {
    id:                     "auction-1",
    listingId:              "card-1",
    sellerId:               "seller-1",
    startingBid:            500,   // cents — formatAuction converts to S$5.00
    reservePrice:           null,
    buyOutPrice:            null,
    currentBid:             null,
    highestBidderId:        null,
    status:                 "active",
    endsAt:                 new Date(Date.now() + 60 * 60 * 1000), // 1 h from now
    sellerDecisionDeadline: null,
    version:                0,
    _count:                 { bids: 0 },
    listing: {
      id: "card-1", imageUrls: [], condition: "Raw NM", inAuction: true,
      owner: { id: "seller-1", username: "ash" },
      pokemonCard: {
        nameEn: "Charizard", rarity: "Holo Rare", setNameEn: "Base Set",
        language: "English", localId: "4/102", tcgPlayerId: "tcg-1",
      },
      riftboundCard: null,
    },
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/auctions", () => {
  // ── Browse page (no params) ───────────────────────────────────────────────

  it("browse: queries only active auctions whose endsAt is in the future", async () => {
    mockPrisma.auction.findMany.mockResolvedValue([]);
    await GET(getReq());

    expect(mockPrisma.auction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "active",
          endsAt: { gt: expect.any(Date) },
        }),
      })
    );
  });

  it("browse: returns prices converted to dollars and resolves card title from the catalog", async () => {
    mockPrisma.auction.findMany.mockResolvedValue([makeDbAuction()]);
    const res  = await GET(getReq());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.auctions).toHaveLength(1);
    expect(body.auctions[0].startingBid).toBe(5); // 500 cents → S$5.00
    expect(body.auctions[0].cardId).toBe("card-1");
    expect(body.auctions[0].card.title).toBe("Charizard");
    expect(body.auctions[0]).not.toHaveProperty("listingId");
  });

  it("browse: returns 500 on DB error", async () => {
    mockPrisma.auction.findMany.mockRejectedValue(new Error("DB failure"));
    const res = await GET(getReq());
    expect(res.status).toBe(500);
  });

  // ── Homepage row (?expiringSoon=true) ─────────────────────────────────────

  it("expiringSoon: queries only active auctions whose endsAt is in the future", async () => {
    mockPrisma.auction.findMany.mockResolvedValue([]);
    await GET(getReq({ expiringSoon: "true" }));

    expect(mockPrisma.auction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where:   expect.objectContaining({
          status: "active",
          endsAt: { gt: expect.any(Date) },
        }),
        orderBy: { endsAt: "asc" },
        take:    5,
      })
    );
  });

  it("expiringSoon: returns formatted auctions", async () => {
    mockPrisma.auction.findMany.mockResolvedValue([makeDbAuction()]);
    const res  = await GET(getReq({ expiringSoon: "true" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.auctions).toHaveLength(1);
  });

  // ── Card detail page (?cardId=xxx) ────────────────────────────────────────

  it("cardId: queries status in [active, pending_seller_decision] with no endsAt filter, using listingId", async () => {
    mockPrisma.auction.findFirst.mockResolvedValue(null);
    await GET(getReq({ cardId: "card-1" }));

    expect(mockPrisma.auction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          listingId: "card-1",
          status: { in: ["active", "pending_seller_decision"] },
        },
      })
    );
  });

  it("cardId: returns null when no auction exists", async () => {
    mockPrisma.auction.findFirst.mockResolvedValue(null);
    const res  = await GET(getReq({ cardId: "card-1" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.auction).toBeNull();
  });

  it("cardId: returns the auction even when endsAt has passed (client handles pre-cron display)", async () => {
    const pastEndsAt = new Date(Date.now() - 60 * 60 * 1000); // 1 h ago
    mockPrisma.auction.findFirst.mockResolvedValue(
      makeDbAuction({ status: "active", endsAt: pastEndsAt })
    );
    const res  = await GET(getReq({ cardId: "card-1" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.auction).not.toBeNull();
    expect(body.auction.status).toBe("active");
  });

  it("cardId: surfaces a pending_seller_decision auction even after endsAt has passed", async () => {
    const pastEndsAt = new Date(Date.now() - 60 * 60 * 1000); // 1 h ago
    mockPrisma.auction.findFirst.mockResolvedValue(
      makeDbAuction({ status: "pending_seller_decision", endsAt: pastEndsAt })
    );
    const res  = await GET(getReq({ cardId: "card-1" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.auction.status).toBe("pending_seller_decision");
  });
});
```

Replace the full contents of `src/__tests__/api/auctions/create.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * POST /api/auctions — seller starts an auction.
 *
 * Sequence:
 *   1. Auth check
 *   2. Validate inputs (startingBid, durationDays, reservePrice, buyOutPrice)
 *   3. Load listing — must be owned by seller, not already in auction, not
 *      have a pending offer, and not have an active Buy Now reservation
 *   4. Create Auction + lock listing in prisma.$transaction
 *   5. Return 201 with formatted auction (prices in dollars)
 */

// ── STEP 1: Create the mock objects ──────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  listing: { findUnique: vi.fn(), update: vi.fn() },
  auction: { create: vi.fn() },
  offer:   { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

// ── STEP 2: Register the fakes ────────────────────────────────────────────────

vi.mock("@/lib/prisma",  () => ({ prisma: mockPrisma }));
vi.mock("next-auth",     () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth",    () => ({ authOptions: {} }));
vi.mock("@/lib/notifications", () => ({ notifyAsync: vi.fn(), createNotification: vi.fn() }));

// ── STEP 3: Import the code under test ───────────────────────────────────────

import { POST } from "@/app/api/auctions/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function postReq(body: object) {
  return new NextRequest("http://localhost/api/auctions", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

const SELLER_SESSION = { user: { id: "seller-1" } };

const LISTING = {
  id: "card-1", ownerId: "seller-1",
  inAuction: false, reservedById: null, reservedUntil: null,
};

// A minimal DB Auction row returned by prisma.auction.create
function makeDbAuction(overrides = {}) {
  return {
    id:             "auction-1",
    listingId:      "card-1",
    sellerId:       "seller-1",
    startingBid:    500,   // cents
    reservePrice:   null,
    buyOutPrice:    null,
    currentBid:     null,
    highestBidderId: null,
    status:         "active",
    endsAt:         new Date("2099-01-01"),
    sellerDecisionDeadline: null,
    version:        0,
    _count:         { bids: 0 },
    listing: {
      id: "card-1", imageUrls: [], condition: "Raw NM", inAuction: true,
      owner: { id: "seller-1", username: "ash" },
      pokemonCard: {
        nameEn: "Charizard", rarity: "Holo Rare", setNameEn: "Base Set",
        language: "English", localId: "4/102", tcgPlayerId: "tcg-1",
      },
      riftboundCard: null,
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "secret";
  mockPrisma.offer.findFirst.mockResolvedValue(null); // default: no pending offer
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/auctions", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(postReq({ cardId: "card-1", startingBid: 5, durationDays: 3 }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when startingBid is missing", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    const res = await POST(postReq({ cardId: "card-1", durationDays: 3 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/starting bid/i);
  });

  it("returns 400 when startingBid is zero", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    const res = await POST(postReq({ cardId: "card-1", startingBid: 0, durationDays: 3 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when startingBid is not a number", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    const res = await POST(postReq({ cardId: "card-1", startingBid: "abc", durationDays: 3 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/starting bid/i);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 400 when reservePrice is not a number", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.listing.findUnique.mockResolvedValue(LISTING);
    const res = await POST(postReq({
      cardId: "card-1", startingBid: 5, reservePrice: "xyz", durationDays: 3,
    }));
    expect(res.status).toBe(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 400 when buyOutPrice is not a number", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.listing.findUnique.mockResolvedValue(LISTING);
    const res = await POST(postReq({
      cardId: "card-1", startingBid: 5, buyOutPrice: "xyz", durationDays: 3,
    }));
    expect(res.status).toBe(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 400 when durationDays is out of range", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    const res = await POST(postReq({ cardId: "card-1", startingBid: 5, durationDays: 7 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/duration/i);
  });

  it("returns 400 when reservePrice < startingBid", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    const res = await POST(postReq({
      cardId: "card-1", startingBid: 10, reservePrice: 5, durationDays: 3,
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/reserve/i);
  });

  it("returns 400 when buyOutPrice <= reservePrice", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    const res = await POST(postReq({
      cardId: "card-1", startingBid: 5, reservePrice: 20, buyOutPrice: 20, durationDays: 3,
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/buy-out/i);
  });

  it("returns 400 when buyOutPrice is below startingBid and no reservePrice is set", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.listing.findUnique.mockResolvedValue(LISTING);
    const res = await POST(postReq({
      cardId: "card-1", startingBid: 50, buyOutPrice: 10, durationDays: 3,
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/buy-out/i);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("allows buyOutPrice equal to startingBid when no reservePrice is set", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.listing.findUnique.mockResolvedValue(LISTING);
    const dbAuction = makeDbAuction({ startingBid: 5000, buyOutPrice: 5000 });
    mockPrisma.$transaction.mockResolvedValue([dbAuction]);
    const res = await POST(postReq({
      cardId: "card-1", startingBid: 50, buyOutPrice: 50, durationDays: 3,
    }));
    expect(res.status).toBe(201);
  });

  it("returns 404 when card does not exist", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.listing.findUnique.mockResolvedValue(null);
    const res = await POST(postReq({ cardId: "card-1", startingBid: 5, durationDays: 3 }));
    expect(res.status).toBe(404);
  });

  it("returns 403 when card is owned by someone else", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.listing.findUnique.mockResolvedValue({ ...LISTING, ownerId: "other-user" });
    const res = await POST(postReq({ cardId: "card-1", startingBid: 5, durationDays: 3 }));
    expect(res.status).toBe(403);
  });

  it("returns 409 when card is already in auction", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.listing.findUnique.mockResolvedValue({ ...LISTING, inAuction: true });
    const res = await POST(postReq({ cardId: "card-1", startingBid: 5, durationDays: 3 }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already.*auction/i);
  });

  it("returns 409 when card has a pending offer", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.listing.findUnique.mockResolvedValue(LISTING);
    mockPrisma.offer.findFirst.mockResolvedValue({ id: "offer-1" });

    const res = await POST(postReq({ cardId: "card-1", startingBid: 5, durationDays: 3 }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/pending offer/i);

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    // The pending-offer guard must query by the renamed listingId field.
    expect(mockPrisma.offer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ listingId: "card-1" }) })
    );
  });

  it("returns 409 when card has an active Buy Now reservation", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.listing.findUnique.mockResolvedValue({
      ...LISTING,
      reservedById: "buyer-1",
      reservedUntil: new Date(Date.now() + 10 * 60_000),
    });

    const res = await POST(postReq({ cardId: "card-1", startingBid: 5, durationDays: 3 }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/reserved/i);

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("allows auction creation when reservation has expired", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.listing.findUnique.mockResolvedValue({
      ...LISTING,
      reservedById: "buyer-1",
      reservedUntil: new Date(Date.now() - 10 * 60_000),
    });
    const dbAuction = makeDbAuction({ startingBid: 500 });
    mockPrisma.$transaction.mockResolvedValue([dbAuction]);

    const res = await POST(postReq({ cardId: "card-1", startingBid: 5, durationDays: 3 }));
    expect(res.status).toBe(201);
  });

  it("creates auction and returns 201 with prices in dollars and cardId (not listingId)", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.listing.findUnique.mockResolvedValue(LISTING);
    const dbAuction = makeDbAuction({ startingBid: 500 }); // 500 cents = S$5.00
    mockPrisma.$transaction.mockResolvedValue([dbAuction]);

    const res = await POST(postReq({ cardId: "card-1", startingBid: 5, durationDays: 3 }));
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.auction.startingBid).toBe(5);
    expect(body.auction.reservePrice).toBeNull();
    expect(body.auction.buyOutPrice).toBeNull();
    expect(body.auction.status).toBe("active");
    expect(body.auction.bidCount).toBe(0);
    expect(body.auction.cardId).toBe("card-1");
    expect(body.auction).not.toHaveProperty("listingId");

    // The auction is created against the renamed listingId column.
    expect(mockPrisma.auction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ listingId: "card-1" }) })
    );
  });

  it("creates auction with reserve and buy-out prices", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.listing.findUnique.mockResolvedValue(LISTING);
    const dbAuction = makeDbAuction({
      startingBid:  500,
      reservePrice: 1000,
      buyOutPrice:  2000,
    });
    mockPrisma.$transaction.mockResolvedValue([dbAuction]);

    const res = await POST(postReq({
      cardId: "card-1", startingBid: 5, reservePrice: 10, buyOutPrice: 20, durationDays: 3,
    }));
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.auction.startingBid).toBe(5);
    expect(body.auction.reservePrice).toBe(10);
    expect(body.auction.buyOutPrice).toBe(20);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/api/auctions/list.test.ts src/__tests__/api/auctions/create.test.ts`
Expected: FAIL — the route still calls `prisma.card.findUnique`/`prisma.auction.create({data:{cardId}})` and reads `auction.card`.

- [ ] **Step 3: Rewrite the route**

Replace the full contents of `src/app/api/auctions/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { centsToDollars, dollarsToCents } from "@/lib/money";
import { listingCatalogInclude, withListingDisplay } from "@/lib/listingDisplay";

// ── Shared shape for converting a DB Auction row to the API response ────────
// Prices are stored as cents in the DB; callers receive dollars. Card
// identity (title, rarity, etc.) is resolved via the catalog relation on
// the linked Listing — the external response shape is unchanged.
function formatAuction(auction: any) {
  return {
    id:             auction.id,
    cardId:         auction.listingId,
    sellerId:       auction.sellerId,
    startingBid:    centsToDollars(auction.startingBid),
    reservePrice:   auction.reservePrice   != null ? centsToDollars(auction.reservePrice)   : null,
    buyOutPrice:    auction.buyOutPrice    != null ? centsToDollars(auction.buyOutPrice)    : null,
    currentBid:     auction.currentBid    != null ? centsToDollars(auction.currentBid)     : null,
    highestBidderId: auction.highestBidderId,
    status:          auction.status,
    endsAt:          auction.endsAt.toISOString(),
    sellerDecisionDeadline: auction.sellerDecisionDeadline?.toISOString() ?? null,
    version:         auction.version,
    bidCount:        auction._count.bids,
    card:            withListingDisplay(auction.listing),
  };
}

const LISTING_SELECT = {
  id: true, imageUrls: true, condition: true, inAuction: true,
  owner: { select: { id: true, username: true } },
  ...listingCatalogInclude,
} as const;

/**
 * GET /api/auctions
 *   ?cardId=xxx        — active auction for a specific card (used by card detail page)
 *   ?expiringSoon=true — the 5 active auctions expiring soonest (used by homepage row)
 *   (no params)        — all active auctions (used by /auctions listing page)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cardId       = searchParams.get("cardId");
  const expiringSoon = searchParams.get("expiringSoon") === "true";

  try {
    // ── Active auction for a single card ──────────────────────────────────────
    // Returns any auction that is still active or awaiting the seller's decision.
    // We intentionally include "active + endsAt in the past" rows here — the client
    // distinguishes them by checking endsAt and bidCount:
    //   • active + past + bidCount = 0  → treated as ended immediately (auctionExpiredClientSide in page.tsx)
    //   • active + past + bidCount > 0  → pre-cron window; info box shown ("refresh shortly")
    //   • pending_seller_decision       → Accept/Decline buttons shown
    if (cardId) {
      const auction = await prisma.auction.findFirst({
        where: {
          listingId: cardId,
          status: { in: ["active", "pending_seller_decision"] },
        },
        include: { listing: { select: LISTING_SELECT }, _count: { select: { bids: true } } },
      });

      return NextResponse.json({ auction: auction ? formatAuction(auction) : null });
    }

    // ── Expiring-soon: the 5 active auctions with the earliest end time ──────
    // endsAt > now guards the window between endsAt passing and the cron running
    // (up to ~5 min), ensuring stale "active" auctions don't leak into the row.
    if (expiringSoon) {
      const auctions = await prisma.auction.findMany({
        where:   { status: "active", endsAt: { gt: new Date() } },
        include: { listing: { select: LISTING_SELECT }, _count: { select: { bids: true } } },
        orderBy: { endsAt: "asc" },
        take:    5,
      });

      return NextResponse.json({ auctions: auctions.map(formatAuction) });
    }

    // ── All active auctions (auctions browse page) ────────────────────────────
    // Same endsAt > now guard: exclude auctions the cron hasn't expired yet.
    const auctions = await prisma.auction.findMany({
      where:   { status: "active", endsAt: { gt: new Date() } },
      include: { listing: { select: LISTING_SELECT }, _count: { select: { bids: true } } },
      orderBy: { endsAt: "asc" },
      take:    100,
    });

    return NextResponse.json({ auctions: auctions.map(formatAuction) });
  } catch (err) {
    console.error("[auctions GET] error:", err);
    return NextResponse.json({ error: "Failed to fetch auctions" }, { status: 500 });
  }
}

/**
 * POST /api/auctions
 *
 * Seller starts an auction on one of their cards.
 *
 * 1. Auth check — must be logged in.
 * 2. Validate inputs:
 *    - startingBid required and > 0
 *    - durationDays must be 1–6
 *    - buyOutPrice > reservePrice if both supplied
 * 3. Load the card — must be owned by the seller and not already in auction.
 *    3b. Guard: card must not have a pending offer.
 *    3c. Guard: card must not have an active Buy Now reservation.
 * 4. Create the Auction record.
 * 5. Mark Listing.inAuction = true and Listing.forSale = false so offers and
 *    Buy Now are blocked while the auction is running.
 *
 * Body: { cardId, startingBid (dollars), reservePrice?, buyOutPrice?, durationDays }
 */
export async function POST(req: NextRequest) {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const sellerId = session.user.id;

  try {
    const { cardId, startingBid, reservePrice, buyOutPrice, durationDays } =
      await req.json();

    // ── 2. Validate inputs ──────────────────────────────────────────────────
    if (!cardId) {
      return NextResponse.json({ error: "cardId is required" }, { status: 400 });
    }

    // Number.isNaN checks come BEFORE the <= 0 comparisons below —
    // `NaN <= 0` and `!amount` (for a truthy non-numeric string) are both
    // `false`, so a non-numeric input would otherwise silently reach
    // prisma.auction.create as NaN and surface as a raw 500.
    const startingBidNum = Number(startingBid);
    if (!startingBid || Number.isNaN(startingBidNum)) {
      return NextResponse.json(
        { error: "Starting bid must be greater than $0" },
        { status: 400 }
      );
    }
    const startingBidCents = dollarsToCents(startingBidNum);
    if (startingBidCents <= 0) {
      return NextResponse.json(
        { error: "Starting bid must be greater than $0" },
        { status: 400 }
      );
    }

    const days = Number(durationDays);
    if (!durationDays || Number.isNaN(days) || days < 1 || days > 6) {
      return NextResponse.json(
        { error: "Duration must be between 1 and 6 days" },
        { status: 400 }
      );
    }

    if (reservePrice != null && Number.isNaN(Number(reservePrice))) {
      return NextResponse.json({ error: "Reserve price must be a number" }, { status: 400 });
    }
    if (buyOutPrice != null && Number.isNaN(Number(buyOutPrice))) {
      return NextResponse.json({ error: "Buy-out price must be a number" }, { status: 400 });
    }

    const reservePriceCents = reservePrice != null ? dollarsToCents(Number(reservePrice)) : null;
    const buyOutPriceCents  = buyOutPrice  != null ? dollarsToCents(Number(buyOutPrice))  : null;

    if (reservePriceCents !== null && reservePriceCents < startingBidCents) {
      return NextResponse.json(
        { error: "Reserve price must be at least the starting bid" },
        { status: 400 }
      );
    }
    if (
      reservePriceCents !== null &&
      buyOutPriceCents  !== null &&
      buyOutPriceCents <= reservePriceCents
    ) {
      return NextResponse.json(
        { error: "Buy-out price must be higher than the reserve price" },
        { status: 400 }
      );
    }
    // Without a reserve price, buyOutPrice must still be at least the
    // starting bid — otherwise the first legal bid (>= startingBid) would
    // trigger an instant buy-out settlement below the seller's intended floor.
    if (
      reservePriceCents === null &&
      buyOutPriceCents  !== null &&
      buyOutPriceCents  < startingBidCents
    ) {
      return NextResponse.json(
        { error: "Buy-out price must be at least the starting bid" },
        { status: 400 }
      );
    }

    // ── 3. Verify the card belongs to the seller and is not in auction ───────
    const listing = await prisma.listing.findUnique({
      where:  { id: cardId },
      select: { ownerId: true, inAuction: true, reservedById: true, reservedUntil: true },
    });

    if (!listing) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
    if (listing.ownerId !== sellerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (listing.inAuction) {
      return NextResponse.json(
        { error: "This card already has an active auction" },
        { status: 409 }
      );
    }

    // ── 3b. Guard: check card doesn't have a pending offer ──────────────────────
    // A card with a pending offer must not also be auctionable — the seller could
    // accept that offer mid-auction and settleAuction() would later overwrite the
    // transfer when the auction ends (the other half of this race, fixed in
    // offers/[id]/route.ts's accept flow).
    const pendingOffer = await prisma.offer.findFirst({
      where: { listingId: cardId, status: "pending", archivedAt: null },
      select: { id: true },
    });
    if (pendingOffer) {
      return NextResponse.json(
        { error: "This card has a pending offer — resolve it before starting an auction" },
        { status: 409 }
      );
    }

    // ── 3c. Guard: check card doesn't have an active Buy Now reservation ────
    // The checkout flow sets reservedById + reservedUntil but leaves forSale:
    // true until the webhook fires. If an auction is allowed to start during
    // that window, auction creation flips forSale to false, and the webhook's
    // card-transfer updateMany (which requires forSale: true) later fails for
    // the buyer who already paid — mirrors the same guard in
    // offers/[id]/route.ts's accept flow.
    if (
      listing.reservedById &&
      listing.reservedUntil &&
      listing.reservedUntil > new Date()
    ) {
      return NextResponse.json(
        { error: "Card is currently reserved by a pending checkout" },
        { status: 409 }
      );
    }

    // ── 4 & 5. Create auction + lock card (atomic) ───────────────────────────
    const endsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const [auction] = await prisma.$transaction([
      prisma.auction.create({
        data: {
          listingId: cardId,
          sellerId,
          startingBid:  startingBidCents,
          reservePrice: reservePriceCents,
          buyOutPrice:  buyOutPriceCents,
          endsAt,
          status: "active",
        },
        include: { listing: { select: LISTING_SELECT }, _count: { select: { bids: true } } },
      }),
      // Prevent Buy Now / offers while auction is live.
      prisma.listing.update({
        where: { id: cardId },
        data:  { inAuction: true, forSale: false },
      }),
    ]);

    console.log(`[auctions POST] Auction created: ${auction.id} for card ${cardId}`);

    return NextResponse.json({ auction: formatAuction(auction) }, { status: 201 });
  } catch (err) {
    console.error("[auctions POST] error:", err);
    return NextResponse.json({ error: "Failed to create auction" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/api/auctions/list.test.ts src/__tests__/api/auctions/create.test.ts`
Expected: PASS (9 + 18 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auctions/route.ts src/__tests__/api/auctions/list.test.ts src/__tests__/api/auctions/create.test.ts
git commit -m "fix: rewire GET/POST /api/auctions onto Listing + catalog tables"
```

---

### Task 2: `src/app/api/auctions/[id]/route.ts` — GET (auction detail + bids)

**Files:**
- Modify: `src/app/api/auctions/[id]/route.ts`
- Create: `src/__tests__/api/auctions/detail.test.ts` (no test file previously existed for this route)

**Interfaces:**
- Consumes: `listingCatalogInclude`, `withListingDisplay` from `@/lib/listingDisplay`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/api/auctions/detail.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * GET /api/auctions/[id]
 *
 * Returns the auction record with its bids (amounts + statuses, no PI ids
 * exposed) and the associated card. Public endpoint — no auth required.
 * Card identity is resolved from whichever catalog relation the linked
 * listing points to; the response shape (cardId, nested card: {...}) is
 * unchanged from before the rename.
 */

const mockPrisma = vi.hoisted(() => ({
  auction: { findUnique: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/auctions/[id]/route";

const PARAMS = { params: { id: "auction-1" } };

function makeDbAuction(overrides = {}) {
  return {
    id: "auction-1",
    listingId: "card-1",
    sellerId: "seller-1",
    startingBid: 500,
    reservePrice: null,
    buyOutPrice: null,
    currentBid: 700,
    highestBidderId: "buyer-1",
    status: "active",
    endsAt: new Date(Date.now() + 60 * 60 * 1000),
    sellerDecisionDeadline: null,
    version: 1,
    _count: { bids: 1 },
    listing: {
      id: "card-1", imageUrls: [], condition: "Raw NM", inAuction: true,
      owner: { id: "seller-1", username: "ash" },
      pokemonCard: {
        nameEn: "Charizard", rarity: "Holo Rare", setNameEn: "Base Set",
        language: "English", localId: "4/102", tcgPlayerId: "tcg-1",
      },
      riftboundCard: null,
    },
    bids: [
      {
        id: "bid-1", bidderId: "buyer-1", amount: 700, status: "active",
        createdAt: new Date("2025-01-01"),
        bidder: { id: "buyer-1", username: "misty" },
      },
    ],
    ...overrides,
  };
}

describe("GET /api/auctions/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when the auction does not exist", async () => {
    mockPrisma.auction.findUnique.mockResolvedValue(null);
    const res = await GET(new NextRequest("http://localhost/api/auctions/auction-1"), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns the auction with prices converted to dollars and card identity resolved", async () => {
    mockPrisma.auction.findUnique.mockResolvedValue(makeDbAuction());
    const res = await GET(new NextRequest("http://localhost/api/auctions/auction-1"), PARAMS);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.auction.cardId).toBe("card-1");
    expect(body.auction.startingBid).toBe(5);
    expect(body.auction.currentBid).toBe(7);
    expect(body.auction.card.title).toBe("Charizard");
    expect(body.auction).not.toHaveProperty("listingId");
  });

  it("returns bids with amounts converted to dollars, no PI ids exposed", async () => {
    mockPrisma.auction.findUnique.mockResolvedValue(makeDbAuction());
    const res = await GET(new NextRequest("http://localhost/api/auctions/auction-1"), PARAMS);
    const body = await res.json();

    expect(body.auction.bids).toHaveLength(1);
    expect(body.auction.bids[0].amount).toBe(7); // 700 cents → S$7.00
    expect(body.auction.bids[0]).not.toHaveProperty("paymentIntentId");
    expect(body.auction.bids[0].bidder).toEqual({ id: "buyer-1", username: "misty" });
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.auction.findUnique.mockRejectedValue(new Error("DB failure"));
    const res = await GET(new NextRequest("http://localhost/api/auctions/auction-1"), PARAMS);
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/api/auctions/detail.test.ts`
Expected: FAIL — the route still calls `prisma.auction.findUnique({include:{card:{...}}})` and reads `auction.card` directly.

- [ ] **Step 3: Rewrite the route**

Replace the full contents of `src/app/api/auctions/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { centsToDollars } from "@/lib/money";
import { listingCatalogInclude, withListingDisplay } from "@/lib/listingDisplay";

/**
 * GET /api/auctions/[id]
 *
 * Returns the auction record with its bids (amounts + statuses, no PI ids exposed)
 * and the associated card. Public endpoint — no auth required.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auction = await prisma.auction.findUnique({
      where:   { id: params.id },
      include: {
        listing: {
          select: {
            id: true, imageUrls: true, condition: true, inAuction: true,
            owner: { select: { id: true, username: true } },
            ...listingCatalogInclude,
          },
        },
        bids: {
          // Expose bids to authenticated viewers for history/transparency.
          // PI ids are intentionally excluded — they are internal Stripe references.
          select: {
            id: true, bidderId: true, amount: true, status: true, createdAt: true,
            bidder: { select: { id: true, username: true } },
          },
          orderBy: { amount: "desc" },
        },
        _count: { select: { bids: true } },
      },
    });

    if (!auction) {
      return NextResponse.json({ error: "Auction not found" }, { status: 404 });
    }

    return NextResponse.json({
      auction: {
        id:             auction.id,
        cardId:         auction.listingId,
        sellerId:       auction.sellerId,
        startingBid:    centsToDollars(auction.startingBid),
        reservePrice:   auction.reservePrice  != null ? centsToDollars(auction.reservePrice)  : null,
        buyOutPrice:    auction.buyOutPrice   != null ? centsToDollars(auction.buyOutPrice)   : null,
        currentBid:     auction.currentBid   != null ? centsToDollars(auction.currentBid)    : null,
        highestBidderId: auction.highestBidderId,
        status:          auction.status,
        endsAt:          auction.endsAt.toISOString(),
        sellerDecisionDeadline: auction.sellerDecisionDeadline?.toISOString() ?? null,
        version:         auction.version,
        bidCount:        auction._count.bids,
        card:            withListingDisplay(auction.listing),
        bids: auction.bids.map((b) => ({
          ...b,
          amount:    centsToDollars(b.amount),
          createdAt: b.createdAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    console.error("[auctions/[id] GET] error:", err);
    return NextResponse.json({ error: "Failed to fetch auction" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/api/auctions/detail.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auctions/[id]/route.ts src/__tests__/api/auctions/detail.test.ts
git commit -m "fix: rewire GET /api/auctions/[id] onto Listing + catalog tables"
```

---

### Task 3: `src/app/api/auctions/[id]/bid/route.ts` — POST (place a bid)

**Files:**
- Modify: `src/app/api/auctions/[id]/bid/route.ts`
- Modify: `src/__tests__/api/auctions/bid.test.ts`

**Interfaces:**
- Consumes: `listingCatalogInclude`, `withListingDisplay` from `@/lib/listingDisplay`.

The version-locked optimistic-concurrency transaction (`tx.auction.updateMany` guarded on `version`) must not change behaviorally beyond the rename — this is the core anti-double-bid guard.

- [ ] **Step 1: Update the failing test**

Replace the full contents of `src/__tests__/api/auctions/bid.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * POST /api/auctions/[id]/bid — buyer places a binding bid.
 *
 * The auction's card reference is `listingId` (renamed from `cardId`); card
 * identity (title) for notification copy is resolved from whichever catalog
 * relation the linked listing points to.
 */

// ── STEP 1: Create the mock objects ──────────────────────────────────────────

const mockStripeInstance = vi.hoisted(() => ({
  paymentIntents: {
    retrieve: vi.fn(),
    cancel:   vi.fn(),
  },
}));

const mockPrisma = vi.hoisted(() => ({
  auction: { findUnique: vi.fn() },
  bid:     { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}));

const mockGetServerSession  = vi.hoisted(() => vi.fn());
const mockSettleAuction     = vi.hoisted(() => vi.fn());
const mockCancelBidPI       = vi.hoisted(() => vi.fn());

// ── STEP 2: Register the fakes ────────────────────────────────────────────────

vi.mock("stripe",          () => ({ default: vi.fn(() => mockStripeInstance) }));
vi.mock("@/lib/prisma",    () => ({ prisma: mockPrisma }));
vi.mock("next-auth",       () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth",      () => ({ authOptions: {} }));
vi.mock("@/lib/notifications",      () => ({ notifyAsync: vi.fn() }));
vi.mock("@/lib/auctionSettlement",  () => ({
  settleAuction: mockSettleAuction,
  cancelBidPI:   mockCancelBidPI,
}));

// ── STEP 3: Import the code under test ───────────────────────────────────────

import { POST } from "@/app/api/auctions/[id]/bid/route";
import { notifyAsync } from "@/lib/notifications";

// ── Helpers ───────────────────────────────────────────────────────────────────

function postReq(body: object) {
  return new NextRequest("http://localhost/api/auctions/auction-1/bid", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

const PARAMS = { params: { id: "auction-1" } };

const BUYER_SESSION  = { user: { id: "buyer-1" } };
const SELLER_SESSION = { user: { id: "seller-1" } };

// An active auction with no bids yet; all prices in cents.
const BASE_AUCTION = {
  id:              "auction-1",
  status:          "active",
  endsAt:          new Date(Date.now() + 10 * 60 * 60 * 1000), // 10 h from now
  sellerId:        "seller-1",
  version:         2,
  startingBid:     500,    // S$5.00
  currentBid:      null,
  highestBidderId: null,
  reservePrice:    null,
  buyOutPrice:     null,
  listing: {
    id: "card-1",
    pokemonCard: {
      nameEn: "Charizard", rarity: "Rare Holo", setNameEn: "Base Set",
      language: "English", localId: "4/102", tcgPlayerId: "tcg-1",
    },
    riftboundCard: null,
  },
};

// PI returned by stripe.paymentIntents.retrieve.
const PI_REQUIRES_CAPTURE = {
  status:   "requires_capture",
  metadata: { bidderId: "buyer-1" },
};

// Simulates a successful $transaction: bumps the auction version and creates a bid.
function txSuccess() {
  mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => {
    const txClient = {
      auction: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      bid: {
        update: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({ id: "bid-1" }),
      },
    };
    return cb(txClient as unknown as typeof mockPrisma);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStripeInstance.paymentIntents.cancel.mockResolvedValue({});
  mockCancelBidPI.mockResolvedValue(undefined);
  mockSettleAuction.mockResolvedValue(undefined);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/auctions/[id]/bid", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(postReq({ paymentIntentId: "pi_1", amount: 10 }), PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 400 when paymentIntentId is missing", async () => {
    mockGetServerSession.mockResolvedValue(BUYER_SESSION);
    const res = await POST(postReq({ amount: 10 }), PARAMS);
    expect(res.status).toBe(400);
  });

  it("returns 400 when amount is invalid", async () => {
    mockGetServerSession.mockResolvedValue(BUYER_SESSION);
    const res = await POST(postReq({ paymentIntentId: "pi_1", amount: 0 }), PARAMS);
    expect(res.status).toBe(400);
  });

  it("returns 403 when seller bids on own auction", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue(BASE_AUCTION);
    mockStripeInstance.paymentIntents.retrieve.mockResolvedValue(PI_REQUIRES_CAPTURE);
    const res = await POST(postReq({ paymentIntentId: "pi_1", amount: 10 }), PARAMS);
    expect(res.status).toBe(403);
    expect(mockStripeInstance.paymentIntents.cancel).toHaveBeenCalledWith("pi_1");
  });

  it("returns 400 when bid is below startingBid", async () => {
    mockGetServerSession.mockResolvedValue(BUYER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue(BASE_AUCTION); // startingBid = 500 cents
    mockStripeInstance.paymentIntents.retrieve.mockResolvedValue(PI_REQUIRES_CAPTURE);
    const res = await POST(postReq({ paymentIntentId: "pi_1", amount: 4 }), PARAMS);
    expect(res.status).toBe(400);
    expect(mockStripeInstance.paymentIntents.cancel).toHaveBeenCalledWith("pi_1");
  });

  it("returns 400 when bid is not higher than currentBid", async () => {
    mockGetServerSession.mockResolvedValue(BUYER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue({
      ...BASE_AUCTION, currentBid: 1000, highestBidderId: "other-buyer",
    });
    mockStripeInstance.paymentIntents.retrieve.mockResolvedValue(PI_REQUIRES_CAPTURE);
    const res = await POST(postReq({ paymentIntentId: "pi_1", amount: 10 }), PARAMS);
    expect(res.status).toBe(400);
    expect(mockStripeInstance.paymentIntents.cancel).toHaveBeenCalledWith("pi_1");
  });

  it("returns 409 when PI is not in requires_capture state", async () => {
    mockGetServerSession.mockResolvedValue(BUYER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue(BASE_AUCTION);
    mockStripeInstance.paymentIntents.retrieve.mockResolvedValue({
      status: "requires_payment_method",
      metadata: {},
    });
    const res = await POST(postReq({ paymentIntentId: "pi_1", amount: 10 }), PARAMS);
    expect(res.status).toBe(409);
  });

  it("returns 409 on concurrent bid (optimistic lock miss)", async () => {
    mockGetServerSession.mockResolvedValue(BUYER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue(BASE_AUCTION);
    mockStripeInstance.paymentIntents.retrieve.mockResolvedValue({ ...PI_REQUIRES_CAPTURE, amount: 1000 });
    mockPrisma.bid.findFirst.mockResolvedValue(null);

    mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => {
      const txClient = {
        auction: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        bid:     { update: vi.fn(), create: vi.fn() },
      };
      return cb(txClient as unknown as typeof mockPrisma);
    });

    const res = await POST(postReq({ paymentIntentId: "pi_1", amount: 10 }), PARAMS);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/concurrent|higher bid/i);
    expect(mockStripeInstance.paymentIntents.cancel).toHaveBeenCalledWith("pi_1");
  });

  it("places bid successfully and sends notifications", async () => {
    mockGetServerSession.mockResolvedValue(BUYER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue(BASE_AUCTION);
    mockStripeInstance.paymentIntents.retrieve.mockResolvedValue({ ...PI_REQUIRES_CAPTURE, amount: 1000 });
    mockPrisma.bid.findFirst.mockResolvedValue(null);
    txSuccess();

    const res = await POST(postReq({ paymentIntentId: "pi_1", amount: 10 }), PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.settled).toBe(false);

    // Seller should receive bid_received notification with the resolved title
    // and cardId sourced from the listing (notifyAsync's own param stays cardId).
    expect(notifyAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "seller-1", type: "bid_received",
        cardId: "card-1",
        title: expect.stringContaining("Charizard"),
      })
    );
  });

  it("cancels previous bidder PI and sends outbid notification", async () => {
    mockGetServerSession.mockResolvedValue(BUYER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue({
      ...BASE_AUCTION, currentBid: 1000, highestBidderId: "other-buyer",
    });
    mockStripeInstance.paymentIntents.retrieve.mockResolvedValue({ ...PI_REQUIRES_CAPTURE, amount: 1500 });
    mockPrisma.bid.findFirst.mockResolvedValue({
      id: "prev-bid-1", paymentIntentId: "pi_prev", bidderId: "other-buyer",
    });
    txSuccess();

    const res = await POST(postReq({ paymentIntentId: "pi_1", amount: 15 }), PARAMS);
    expect(res.status).toBe(200);

    expect(mockCancelBidPI).toHaveBeenCalledWith("pi_prev");

    expect(notifyAsync).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "other-buyer", type: "outbid" })
    );
  });

  it("settles immediately when bid >= buyOutPrice", async () => {
    mockGetServerSession.mockResolvedValue(BUYER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue({
      ...BASE_AUCTION, buyOutPrice: 2000, // S$20 buy-out
    });
    mockStripeInstance.paymentIntents.retrieve.mockResolvedValue({ ...PI_REQUIRES_CAPTURE, amount: 2000 });
    mockPrisma.bid.findFirst.mockResolvedValue(null);
    txSuccess();

    const res = await POST(postReq({ paymentIntentId: "pi_1", amount: 20 }), PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settled).toBe(true);
    expect(mockSettleAuction).toHaveBeenCalledWith("auction-1");
  });

  it("does NOT settle immediately when bid hits reservePrice — auction runs until endsAt", async () => {
    mockGetServerSession.mockResolvedValue(BUYER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue({
      ...BASE_AUCTION, reservePrice: 1500, // S$15 reserve
    });
    mockStripeInstance.paymentIntents.retrieve.mockResolvedValue({ ...PI_REQUIRES_CAPTURE, amount: 1500 });
    mockPrisma.bid.findFirst.mockResolvedValue(null);
    txSuccess();

    const res = await POST(postReq({ paymentIntentId: "pi_1", amount: 15 }), PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settled).toBe(false);
    expect(mockSettleAuction).not.toHaveBeenCalled();
  });

  it("returns 400 and cancels the PI when its authorised amount doesn't match the claimed bid", async () => {
    mockGetServerSession.mockResolvedValue(BUYER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue(BASE_AUCTION);
    mockStripeInstance.paymentIntents.retrieve.mockResolvedValue({ ...PI_REQUIRES_CAPTURE, amount: 500 });

    const res = await POST(postReq({ paymentIntentId: "pi_1", amount: 10 }), PARAMS);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/does not match/i);
    expect(mockStripeInstance.paymentIntents.cancel).toHaveBeenCalledWith("pi_1");
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/api/auctions/bid.test.ts`
Expected: FAIL — the route still selects `card: {select:{id,title}}` and reads `auction.card.title` directly.

- [ ] **Step 3: Rewrite the route**

Replace the full contents of `src/app/api/auctions/[id]/bid/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dollarsToCents } from "@/lib/money";
import { settleAuction, cancelBidPI } from "@/lib/auctionSettlement";
import { notifyAsync } from "@/lib/notifications";
import { verifyPaymentIntentAmountOrRespond } from "@/lib/paymentIntentGuard";
import { listingCatalogInclude, withListingDisplay } from "@/lib/listingDisplay";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-02-24.acacia",
});

/**
 * POST /api/auctions/[id]/bid
 *
 * Step 2 of 2 for placing a bid (mirrors POST /api/offers).
 *
 * By this point the buyer has:
 *   1. Created a PI via POST /api/auctions/[id]/bid/intent.
 *   2. Confirmed the PI via stripe.confirmCardPayment() in the browser.
 *      Funds are authorised (held) but NOT charged yet.
 *
 * Flow:
 *   1. Auth + parse body.
 *   2. Re-validate auction state (active, not ended).
 *   3. Verify PI status with Stripe (must be "requires_capture").
 *   4. Read the current highest bid (to cancel its PI if we win the lock).
 *   5. DB transaction with optimistic version lock:
 *      a. updateMany auction WHERE version = snapshot → 0 rows = 409 (concurrent bid)
 *      b. Mark previous highest bid → "cancelled" in DB
 *      c. Create new Bid record
 *   6. On concurrent bid (409): cancel our new PI, return 409.
 *   7. Cancel previous PI (fire-and-forget).
 *   8. Notify seller (bid_received) and outbid bidder (outbid).
 *   9. If bid >= reservePrice or buyOutPrice → settleAuction (instant sale).
 *  10. Return success.
 *
 * Body: { paymentIntentId, amount } — amount in dollars
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auctionId = params.id;

  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const bidderId = session.user.id;

  try {
    const { paymentIntentId, amount } = await req.json();

    if (!paymentIntentId || typeof paymentIntentId !== "string") {
      return NextResponse.json({ error: "Missing paymentIntentId" }, { status: 400 });
    }

    const amountCents = dollarsToCents(Number(amount));
    if (!amount || amountCents <= 0) {
      return NextResponse.json({ error: "Invalid bid amount" }, { status: 400 });
    }

    // ── 2. Load the auction snapshot ─────────────────────────────────────────
    const auction = await prisma.auction.findUnique({
      where:  { id: auctionId },
      select: {
        id: true, status: true, endsAt: true, sellerId: true, version: true,
        startingBid: true, currentBid: true, highestBidderId: true,
        reservePrice: true, buyOutPrice: true,
        listing: { select: { id: true, ...listingCatalogInclude } },
      },
    });

    if (!auction) {
      return NextResponse.json({ error: "Auction not found" }, { status: 404 });
    }
    if (auction.status !== "active") {
      await cancelSafely(paymentIntentId);
      return NextResponse.json({ error: "Auction is not active" }, { status: 409 });
    }
    if (auction.endsAt < new Date()) {
      await cancelSafely(paymentIntentId);
      return NextResponse.json({ error: "Auction has ended" }, { status: 409 });
    }
    if (auction.sellerId === bidderId) {
      await cancelSafely(paymentIntentId);
      return NextResponse.json(
        { error: "You cannot bid on your own auction" },
        { status: 403 }
      );
    }
    if (amountCents < auction.startingBid) {
      await cancelSafely(paymentIntentId);
      return NextResponse.json(
        { error: `Bid must be at least S$${(auction.startingBid / 100).toFixed(2)}` },
        { status: 400 }
      );
    }
    if (auction.currentBid !== null && amountCents <= auction.currentBid) {
      await cancelSafely(paymentIntentId);
      return NextResponse.json(
        { error: `Bid must be higher than the current bid of S$${(auction.currentBid / 100).toFixed(2)}` },
        { status: 400 }
      );
    }

    // ── 3. Verify PI is properly authorised ──────────────────────────────────
    // Must be "requires_capture" — means the buyer's card was successfully
    // authorised in the browser (funds are held, not charged yet).
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status !== "requires_capture") {
      return NextResponse.json(
        { error: `Payment authorisation failed (status: ${pi.status})` },
        { status: 409 }
      );
    }
    if (pi.metadata?.bidderId && pi.metadata.bidderId !== bidderId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── 3b. Verify the authorised amount matches the claimed bid ─────────────
    // Without this, a bidder could authorise a small PI via
    // POST /api/auctions/[id]/bid/intent, then submit an arbitrarily larger
    // `amount` here — currentBid/Bid.amount would record the larger figure
    // while Stripe only ever holds/captures the smaller one.
    const amountMismatch = await verifyPaymentIntentAmountOrRespond(
      stripe,
      paymentIntentId,
      pi.amount,
      amountCents,
      "Bid"
    );
    if (amountMismatch) return amountMismatch;

    // ── 4. Snapshot the current highest bid before writing ───────────────────
    // We need its PI id to cancel it after winning the lock.
    const previousBid = auction.highestBidderId
      ? await prisma.bid.findFirst({
          where:   { auctionId, status: "active" },
          orderBy: { amount: "desc" },
          select:  { id: true, paymentIntentId: true, bidderId: true },
        })
      : null;

    // ── 5. Version-locked DB transaction ─────────────────────────────────────
    // Only one bid writer can match the current version and bump it.
    // If another bid landed between our read (step 2) and this write, the
    // version will have incremented and updateMany returns count = 0.
    let newBidId: string;
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 5a. Optimistic lock — atomically claim the "current highest bidder" slot.
        const lockResult = await tx.auction.updateMany({
          where: { id: auctionId, version: auction.version, status: "active" },
          data:  {
            currentBid:      amountCents,
            highestBidderId: bidderId,
            version:         { increment: 1 },
          },
        });

        if (lockResult.count === 0) {
          // Another bid won the race — cancel our PI and tell the buyer to retry.
          throw new Error("CONCURRENT_BID");
        }

        // 5b. Mark the previous highest bid as cancelled in the DB.
        //     Its Stripe PI is cancelled outside the transaction in step 7.
        if (previousBid) {
          await tx.bid.update({
            where: { id: previousBid.id },
            data:  { status: "cancelled" },
          });
        }

        // 5c. Record this bid.
        const bid = await tx.bid.create({
          data: { auctionId, bidderId, amount: amountCents, paymentIntentId, status: "active" },
        });

        return bid;
      });

      newBidId = result.id;
    } catch (err) {
      if (err instanceof Error && err.message === "CONCURRENT_BID") {
        // ── 6. Lost the lock — release our PI and ask buyer to retry ─────────
        await cancelSafely(paymentIntentId);
        return NextResponse.json(
          { error: "A higher bid was placed at the same time. Please refresh and try again." },
          { status: 409 }
        );
      }
      // Unexpected DB error — cancel our PI so funds are not stranded.
      await cancelSafely(paymentIntentId);
      throw err;
    }

    console.log(
      `[auctions/bid POST] Bid ${newBidId} placed on auction ${auctionId} by ${bidderId} for ${amountCents}`
    );

    // ── 7. Cancel the previous bidder's PI (fire-and-forget) ─────────────────
    if (previousBid) {
      cancelBidPI(previousBid.paymentIntentId);
    }

    // ── 8. Notify seller and outbid bidder ────────────────────────────────────
    const listingTitle = withListingDisplay(auction.listing).title;

    notifyAsync({
      userId: auction.sellerId,
      type:   "bid_received",
      title:  `New bid on "${listingTitle}"`,
      body:   `Someone placed a bid of S$${(amountCents / 100).toFixed(2)} on "${listingTitle}".`,
      cardId: auction.listing.id,
    });

    if (previousBid && previousBid.bidderId !== bidderId) {
      notifyAsync({
        userId: previousBid.bidderId,
        type:   "outbid",
        title:  `You've been outbid on "${listingTitle}"`,
        body:   `Someone placed a higher bid on "${listingTitle}". Place a new bid to stay in the running.`,
        cardId: auction.listing.id,
      });
    }

    // ── 9. Instant settlement if bid hits the buy-out price ──────────────────
    // Only BO ends the auction immediately. RP is NOT an instant-win trigger —
    // it is a "minimum acceptable" floor checked by the cron at endsAt:
    //   bid >= RP at end  → cron auto-settles (no seller action required)
    //   bid >= BO during  → auction ends right now
    const hitsBuyOut = auction.buyOutPrice !== null && amountCents >= auction.buyOutPrice;

    if (hitsBuyOut) {
      console.log(`[auctions/bid POST] Buy-out price hit — settling auction ${auctionId}`);
      await settleAuction(auctionId);
      return NextResponse.json({ success: true, settled: true });
    }

    return NextResponse.json({ success: true, settled: false });
  } catch (err) {
    console.error("[auctions/bid POST] error:", err);
    return NextResponse.json({ error: "Failed to place bid" }, { status: 500 });
  }
}

// Cancels a PI silently — used to clean up when validation fails after
// the buyer already authorised their card.
async function cancelSafely(paymentIntentId: string): Promise<void> {
  try {
    await stripe.paymentIntents.cancel(paymentIntentId);
  } catch {
    // PI may already be in a terminal state — safe to ignore.
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/api/auctions/bid.test.ts`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auctions/[id]/bid/route.ts src/__tests__/api/auctions/bid.test.ts
git commit -m "fix: rewire POST /api/auctions/[id]/bid onto Listing + catalog tables"
```

---

### Task 4: `src/app/api/auctions/[id]/bid/intent/route.ts` — POST (create bid PI)

**Files:**
- Modify: `src/app/api/auctions/[id]/bid/intent/route.ts`
- Modify: `src/__tests__/api/auctions/bid-intent.test.ts`

**Interfaces:**
- Consumes: `listingCatalogInclude`, `withListingDisplay` from `@/lib/listingDisplay` — needed to resolve the listing's title for the Stripe PI's `metadata.cardTitle` (informational only).

- [ ] **Step 1: Update the failing test**

Replace the full contents of `src/__tests__/api/auctions/bid-intent.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * POST /api/auctions/[id]/bid/intent — buyer creates a Stripe PaymentIntent
 * for a bid (step 1 of 2, mirrors POST /api/offers/payment-intent).
 */

// ── STEP 1: Create the mock objects ──────────────────────────────────────────

const mockStripeInstance = vi.hoisted(() => ({
  paymentIntents: {
    create: vi.fn(),
  },
}));

const mockPrisma = vi.hoisted(() => ({
  auction: { findUnique: vi.fn() },
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

// ── STEP 2: Register the fakes ────────────────────────────────────────────────

vi.mock("stripe", () => ({ default: vi.fn(() => mockStripeInstance) }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

// ── STEP 3: Import the code under test ───────────────────────────────────────

import { POST } from "@/app/api/auctions/[id]/bid/intent/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function postReq(body: object) {
  return new NextRequest("http://localhost/api/auctions/auction-1/bid/intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const PARAMS = { params: { id: "auction-1" } };

const BUYER_SESSION = { user: { id: "buyer-1" } };
const SELLER_SESSION = { user: { id: "seller-1" } };

// An active auction with no bids yet; all prices in cents.
const BASE_AUCTION = {
  id: "auction-1",
  status: "active",
  endsAt: new Date(Date.now() + 10 * 60 * 60 * 1000), // 10 h from now
  sellerId: "seller-1",
  startingBid: 500, // S$5.00
  currentBid: null,
  listing: {
    id: "card-1",
    pokemonCard: {
      nameEn: "Charizard", rarity: "Rare Holo", setNameEn: "Base Set",
      language: "English", localId: "4/102", tcgPlayerId: "tcg-1",
    },
    riftboundCard: null,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/auctions/[id]/bid/intent", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(postReq({ amount: 10 }), PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 400 when amount is invalid", async () => {
    mockGetServerSession.mockResolvedValue(BUYER_SESSION);
    const res = await POST(postReq({ amount: 0 }), PARAMS);
    expect(res.status).toBe(400);
    expect(mockStripeInstance.paymentIntents.create).not.toHaveBeenCalled();
  });

  it("returns 404 when auction is not found", async () => {
    mockGetServerSession.mockResolvedValue(BUYER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue(null);
    const res = await POST(postReq({ amount: 10 }), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 409 when auction is not active", async () => {
    mockGetServerSession.mockResolvedValue(BUYER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue({ ...BASE_AUCTION, status: "sold" });
    const res = await POST(postReq({ amount: 10 }), PARAMS);
    expect(res.status).toBe(409);
  });

  it("returns 409 when auction has ended", async () => {
    mockGetServerSession.mockResolvedValue(BUYER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue({
      ...BASE_AUCTION,
      endsAt: new Date(Date.now() - 1000),
    });
    const res = await POST(postReq({ amount: 10 }), PARAMS);
    expect(res.status).toBe(409);
  });

  it("returns 403 when seller bids on own auction", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue(BASE_AUCTION);
    const res = await POST(postReq({ amount: 10 }), PARAMS);
    expect(res.status).toBe(403);
    expect(mockStripeInstance.paymentIntents.create).not.toHaveBeenCalled();
  });

  it("returns 400 when bid is below startingBid", async () => {
    mockGetServerSession.mockResolvedValue(BUYER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue(BASE_AUCTION); // startingBid = 500 cents
    const res = await POST(postReq({ amount: 4 }), PARAMS);
    expect(res.status).toBe(400);
  });

  it("returns 400 when bid is not higher than currentBid", async () => {
    mockGetServerSession.mockResolvedValue(BUYER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue({ ...BASE_AUCTION, currentBid: 1000 });
    const res = await POST(postReq({ amount: 10 }), PARAMS);
    expect(res.status).toBe(400);
  });

  it("creates a manual-capture PaymentIntent with the resolved card title and returns its clientSecret", async () => {
    mockGetServerSession.mockResolvedValue(BUYER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue(BASE_AUCTION);
    mockStripeInstance.paymentIntents.create.mockResolvedValue({
      id: "pi_1",
      client_secret: "secret_1",
    });

    const res = await POST(postReq({ amount: 10 }), PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ clientSecret: "secret_1", paymentIntentId: "pi_1" });

    expect(mockStripeInstance.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1000,
        currency: "sgd",
        capture_method: "manual",
        metadata: expect.objectContaining({
          bidderId: "buyer-1",
          auctionId: "auction-1",
          cardTitle: "Charizard",
        }),
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/api/auctions/bid-intent.test.ts`
Expected: FAIL — the route still selects `card: {select:{id,title}}` and reads `auction.card.title` directly.

- [ ] **Step 3: Rewrite the route**

Replace the full contents of `src/app/api/auctions/[id]/bid/intent/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dollarsToCents } from "@/lib/money";
import { listingCatalogInclude, withListingDisplay } from "@/lib/listingDisplay";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-02-24.acacia",
});

/**
 * POST /api/auctions/[id]/bid/intent
 *
 * Step 1 of 2 for placing a bid (mirrors POST /api/offers/payment-intent).
 *
 * Creates a Stripe PaymentIntent with capture_method: "manual" for the bid
 * amount. Returns the clientSecret so the frontend can confirm the PI via
 * stripe.confirmCardPayment(). Funds are authorised (held) but NOT charged.
 *
 * Basic validation runs here so we don't create dangling PIs for invalid bids.
 * Full version-locked validation runs in Step 2 (POST /api/auctions/[id]/bid).
 *
 * Body: { amount } — bid amount in dollars
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const bidderId = session.user.id;

  try {
    const { amount } = await req.json();

    // ── 2. Validate amount ──────────────────────────────────────────────────
    const amountCents = dollarsToCents(Number(amount));
    if (!amount || amountCents <= 0) {
      return NextResponse.json(
        { error: "Bid amount must be greater than $0" },
        { status: 400 }
      );
    }

    // ── 3. Load auction for pre-flight checks ───────────────────────────────
    // These are optimistic checks only — the binding version-lock is in Step 2.
    const auction = await prisma.auction.findUnique({
      where:  { id: params.id },
      select: {
        id: true, status: true, endsAt: true, sellerId: true,
        startingBid: true, currentBid: true,
        listing: { select: { id: true, ...listingCatalogInclude } },
      },
    });

    if (!auction) {
      return NextResponse.json({ error: "Auction not found" }, { status: 404 });
    }
    if (auction.status !== "active") {
      return NextResponse.json({ error: "Auction is not active" }, { status: 409 });
    }
    if (auction.endsAt < new Date()) {
      return NextResponse.json({ error: "Auction has ended" }, { status: 409 });
    }
    if (auction.sellerId === bidderId) {
      return NextResponse.json(
        { error: "You cannot bid on your own auction" },
        { status: 403 }
      );
    }
    if (amountCents < auction.startingBid) {
      return NextResponse.json(
        { error: `Bid must be at least S$${(auction.startingBid / 100).toFixed(2)}` },
        { status: 400 }
      );
    }
    if (auction.currentBid !== null && amountCents <= auction.currentBid) {
      return NextResponse.json(
        { error: `Bid must be higher than the current bid of S$${(auction.currentBid / 100).toFixed(2)}` },
        { status: 400 }
      );
    }

    // ── 4. Create the Stripe PaymentIntent ───────────────────────────────────
    const paymentIntent = await stripe.paymentIntents.create({
      amount:         amountCents,
      currency:       "sgd",
      capture_method: "manual", // authorise now, capture only if this bid wins
      metadata: {
        bidderId,
        auctionId: params.id,
        cardTitle: withListingDisplay(auction.listing).title,
      },
    });

    return NextResponse.json({
      clientSecret:    paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error("[auctions/bid/intent POST] error:", err);
    return NextResponse.json(
      { error: "Failed to create payment intent" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/api/auctions/bid-intent.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auctions/[id]/bid/intent/route.ts src/__tests__/api/auctions/bid-intent.test.ts
git commit -m "fix: rewire POST /api/auctions/[id]/bid/intent onto Listing + catalog tables"
```

---

### Task 5: `src/app/api/auctions/[id]/decide/route.ts` — POST (seller accept/reject)

**Files:**
- Modify: `src/app/api/auctions/[id]/decide/route.ts`
- Modify: `src/__tests__/api/auctions/decide.test.ts`

**Interfaces:**
- Consumes: `listingCatalogInclude`, `withListingDisplay` from `@/lib/listingDisplay` — needed for the reject-path notification's resolved title. The accept path delegates entirely to `settleAuction()` (Task 6), which does its own catalog resolution.

- [ ] **Step 1: Update the failing test**

Replace the full contents of `src/__tests__/api/auctions/decide.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * POST /api/auctions/[id]/decide — seller accepts or rejects the highest bid
 * during the pending_seller_decision window.
 */

// ── STEP 1: Create the mock objects ──────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  auction: { findUnique: vi.fn(), update: vi.fn() },
  bid: { update: vi.fn() },
  listing: { update: vi.fn() },
  $transaction: vi.fn(),
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockSettleAuction = vi.hoisted(() => vi.fn());
const mockCancelBidPI = vi.hoisted(() => vi.fn());
const mockNotifyAsync = vi.hoisted(() => vi.fn());

// ── STEP 2: Register the fakes ────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/notifications", () => ({ notifyAsync: mockNotifyAsync }));
vi.mock("@/lib/auctionSettlement", () => ({
  settleAuction: mockSettleAuction,
  cancelBidPI: mockCancelBidPI,
}));

// ── STEP 3: Import the code under test ───────────────────────────────────────

import { POST } from "@/app/api/auctions/[id]/decide/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function postReq(body: object) {
  return new NextRequest("http://localhost/api/auctions/auction-1/decide", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const PARAMS = { params: { id: "auction-1" } };

const SELLER_SESSION = { user: { id: "seller-1" } };
const OTHER_SESSION = { user: { id: "not-seller" } };

const HIGHEST_BID = {
  id: "bid-1",
  paymentIntentId: "pi_1",
  bidderId: "buyer-1",
  amount: 1500,
};

const BASE_AUCTION = {
  id: "auction-1",
  sellerId: "seller-1",
  status: "pending_seller_decision",
  sellerDecisionDeadline: new Date(Date.now() + 60 * 60 * 1000), // 1h from now
  bids: [HIGHEST_BID],
  listing: {
    id: "card-1",
    pokemonCard: {
      nameEn: "Charizard", rarity: "Rare Holo", setNameEn: "Base Set",
      language: "English", localId: "4/102", tcgPlayerId: "tcg-1",
    },
    riftboundCard: null,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops));
  mockPrisma.bid.update.mockResolvedValue({});
  mockPrisma.auction.update.mockResolvedValue({});
  mockPrisma.listing.update.mockResolvedValue({});
  mockCancelBidPI.mockResolvedValue(undefined);
  mockSettleAuction.mockResolvedValue(undefined);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/auctions/[id]/decide", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(postReq({ action: "accept" }), PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid action", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    const res = await POST(postReq({ action: "maybe" }), PARAMS);
    expect(res.status).toBe(400);
  });

  it("returns 404 when auction is not found", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue(null);
    const res = await POST(postReq({ action: "accept" }), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 403 when caller is not the seller", async () => {
    mockGetServerSession.mockResolvedValue(OTHER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue(BASE_AUCTION);
    const res = await POST(postReq({ action: "accept" }), PARAMS);
    expect(res.status).toBe(403);
  });

  it("returns 409 when auction is not awaiting a seller decision", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue({ ...BASE_AUCTION, status: "active" });
    const res = await POST(postReq({ action: "accept" }), PARAMS);
    expect(res.status).toBe(409);
  });

  it("returns 409 when the decision window has expired", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue({
      ...BASE_AUCTION,
      sellerDecisionDeadline: new Date(Date.now() - 1000),
    });
    const res = await POST(postReq({ action: "accept" }), PARAMS);
    expect(res.status).toBe(409);
  });

  it("returns 409 when there are no bids on the auction", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue({ ...BASE_AUCTION, bids: [] });
    const res = await POST(postReq({ action: "accept" }), PARAMS);
    expect(res.status).toBe(409);
  });

  it("accept — delegates to settleAuction and returns success", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue(BASE_AUCTION);

    const res = await POST(postReq({ action: "accept" }), PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockSettleAuction).toHaveBeenCalledWith("auction-1");
    expect(mockCancelBidPI).not.toHaveBeenCalled();
  });

  it("reject — cancels the winning PI, updates bid/auction/card, and notifies the bidder with the resolved title", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue(BASE_AUCTION);

    const res = await POST(postReq({ action: "reject" }), PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    expect(mockCancelBidPI).toHaveBeenCalledWith("pi_1");
    expect(mockPrisma.bid.update).toHaveBeenCalledWith({
      where: { id: "bid-1" },
      data: { status: "cancelled" },
    });
    expect(mockPrisma.auction.update).toHaveBeenCalledWith({
      where: { id: "auction-1" },
      data: { status: "expired" },
    });
    expect(mockPrisma.listing.update).toHaveBeenCalledWith({
      where: { id: "card-1" },
      data: { inAuction: false },
    });
    expect(mockNotifyAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "buyer-1", type: "auction_expired",
        cardId: "card-1",
        title: expect.stringContaining("Charizard"),
      })
    );
    expect(mockSettleAuction).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/api/auctions/decide.test.ts`
Expected: FAIL — the route still calls `prisma.card.update` and reads `auction.card.title` directly.

- [ ] **Step 3: Rewrite the route**

Replace the full contents of `src/app/api/auctions/[id]/decide/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { settleAuction, cancelBidPI } from "@/lib/auctionSettlement";
import { notifyAsync } from "@/lib/notifications";
import { listingCatalogInclude, withListingDisplay } from "@/lib/listingDisplay";

/**
 * POST /api/auctions/[id]/decide
 *
 * Seller accepts or rejects the highest bid during the pending_seller_decision window.
 * Only reachable when the auction status is "pending_seller_decision" and the
 * seller decision deadline has not yet passed.
 *
 * Accept flow:
 *   1. Verify auction state and deadline.
 *   2. Call settleAuction() — captures PI, transfers card, marks auction sold.
 *
 * Reject flow:
 *   1. Verify auction state and deadline.
 *   2. Cancel highest bid PI (fire-and-forget).
 *   3. Mark auction "expired", clear Listing.inAuction.
 *   4. Notify bidder.
 *
 * Body: { action: "accept" | "reject" }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // ── 1. Auth check ──────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const { action } = await req.json();
    if (!["accept", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // ── 2. Load auction ────────────────────────────────────────────────────
    const auction = await prisma.auction.findUnique({
      where:   { id: params.id },
      include: {
        bids: {
          where:   { status: "active" },
          orderBy: { amount: "desc" },
          take:    1,
          select:  { id: true, paymentIntentId: true, bidderId: true, amount: true },
        },
        listing: { select: { id: true, ...listingCatalogInclude } },
      },
    });

    if (!auction) {
      return NextResponse.json({ error: "Auction not found" }, { status: 404 });
    }
    if (auction.sellerId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (auction.status !== "pending_seller_decision") {
      return NextResponse.json(
        { error: "Auction is not awaiting a seller decision" },
        { status: 409 }
      );
    }
    if (auction.sellerDecisionDeadline && auction.sellerDecisionDeadline < new Date()) {
      return NextResponse.json(
        { error: "The decision window has expired" },
        { status: 409 }
      );
    }

    const highestBid = auction.bids[0];
    if (!highestBid) {
      return NextResponse.json(
        { error: "No bids found on this auction" },
        { status: 409 }
      );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ACCEPT — delegate to settleAuction (captures PI + transfers card)
    // ══════════════════════════════════════════════════════════════════════════
    if (action === "accept") {
      await settleAuction(params.id);
      return NextResponse.json({ success: true });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // REJECT — cancel PI, expire auction, release card
    // ══════════════════════════════════════════════════════════════════════════

    // 3. Cancel the winning bid's PI (fire-and-forget).
    cancelBidPI(highestBid.paymentIntentId);

    // 4. Mark bid cancelled + auction expired + release the card in one transaction.
    await prisma.$transaction([
      prisma.bid.update({
        where: { id: highestBid.id },
        data:  { status: "cancelled" },
      }),
      prisma.auction.update({
        where: { id: params.id },
        data:  { status: "expired" },
      }),
      prisma.listing.update({
        where: { id: auction.listing.id },
        data:  { inAuction: false },
      }),
    ]);

    // 5. Notify the bidder that the seller declined.
    const listingTitle = withListingDisplay(auction.listing).title;
    notifyAsync({
      userId: highestBid.bidderId,
      type:   "auction_expired",
      title:  `Auction declined for "${listingTitle}"`,
      body:   `The seller chose not to accept the final bid on "${listingTitle}". Your hold has been released.`,
      cardId: auction.listing.id,
    });

    console.log(
      `[auctions/decide POST] Seller rejected auction ${params.id}. Bid ${highestBid.id} cancelled.`
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[auctions/decide POST] error:", err);
    return NextResponse.json(
      { error: "Failed to process decision" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/api/auctions/decide.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auctions/[id]/decide/route.ts src/__tests__/api/auctions/decide.test.ts
git commit -m "fix: rewire POST /api/auctions/[id]/decide onto Listing + catalog tables"
```

---

### Task 6: `src/lib/auctionSettlement.ts` — settleAuction, cancelBidPI

**Files:**
- Modify: `src/lib/auctionSettlement.ts`
- Create: `src/__tests__/lib/auctionSettlement.test.ts` (no test file previously existed — `settleAuction` currently has ZERO direct unit test coverage; it's only exercised indirectly through mocks in `bid.test.ts`, `decide.test.ts`, and `cron/expire-auctions.test.ts`. Given this is the single highest-stakes function in this plan — it captures real payment, atomically transfers ownership, and issues compensating refunds on failure — it gets the same direct-test treatment Plan 2b gave `webhookHelpers.ts`.)

**Interfaces:**
- Consumes: `listingCatalogInclude`, `withListingDisplay` from `@/lib/listingDisplay`.
- Produces (used by Tasks 3, 5, 7): `settleAuction(auctionId): Promise<void>`, `cancelBidPI(paymentIntentId): void` — signatures unchanged, only internals rewired.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/auctionSettlement.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * settleAuction — the core money-movement function for auctions: captures
 * the winning bid's PaymentIntent, then atomically creates the sale records
 * and transfers listing ownership. If the DB transaction fails after capture,
 * it issues a compensating Stripe refund (mirrors the webhook's
 * issueRefundOnTransferFailure and the offer-accept route's same pattern).
 *
 * cancelBidPI — a small fire-and-forget PI-cancel helper shared by the bid
 * route, decide route, and expire-auctions cron.
 */

const mockStripeInstance = vi.hoisted(() => ({
  paymentIntents: { capture: vi.fn(), cancel: vi.fn() },
  refunds: { create: vi.fn() },
}));

const mockTx = vi.hoisted(() => ({
  order: { create: vi.fn() },
  cardTransaction: { create: vi.fn() },
  bid: { update: vi.fn(), updateMany: vi.fn() },
  listing: { update: vi.fn() },
  auction: { update: vi.fn() },
}));

const mockPrisma = vi.hoisted(() => ({
  auction: { findUnique: vi.fn() },
  bid: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));

const mockNotifyAsync = vi.hoisted(() => vi.fn());

vi.mock("stripe", () => ({ default: vi.fn(() => mockStripeInstance) }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/notifications", () => ({ notifyAsync: mockNotifyAsync }));

import { settleAuction, cancelBidPI } from "@/lib/auctionSettlement";

const WINNING_BID = { id: "bid-1", paymentIntentId: "pi_win", bidderId: "buyer-1", amount: 1500, status: "active" };
const LOSING_BID  = { id: "bid-2", paymentIntentId: "pi_lose", bidderId: "buyer-2" };

function makeAuction(overrides = {}) {
  return {
    id: "auction-1",
    listingId: "card-1",
    sellerId: "seller-1",
    status: "active",
    bids: [WINNING_BID],
    listing: {
      id: "card-1",
      pokemonCard: {
        nameEn: "Charizard", rarity: "Rare Holo", setNameEn: "Base Set",
        language: "English", localId: "4/102", tcgPlayerId: "tcg-1",
      },
      riftboundCard: null,
    },
    ...overrides,
  };
}

describe("settleAuction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStripeInstance.paymentIntents.capture.mockResolvedValue({ id: "pi_win", status: "succeeded" });
    mockStripeInstance.refunds.create.mockResolvedValue({ id: "re_1" });
    mockPrisma.auction.findUnique.mockResolvedValue(makeAuction());
    mockPrisma.bid.findMany.mockResolvedValue([]); // no losing bids by default
    mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockTx));
    mockTx.order.create.mockResolvedValue({ id: "order-1" });
    mockTx.cardTransaction.create.mockResolvedValue({});
    mockTx.bid.update.mockResolvedValue({});
    mockTx.bid.updateMany.mockResolvedValue({ count: 0 });
    mockTx.listing.update.mockResolvedValue({});
    mockTx.auction.update.mockResolvedValue({});
  });

  it("returns immediately (idempotent) when the auction is already sold", async () => {
    mockPrisma.auction.findUnique.mockResolvedValue(makeAuction({ status: "sold" }));
    await settleAuction("auction-1");
    expect(mockStripeInstance.paymentIntents.capture).not.toHaveBeenCalled();
  });

  it("throws when the auction does not exist", async () => {
    mockPrisma.auction.findUnique.mockResolvedValue(null);
    await expect(settleAuction("auction-x")).rejects.toThrow(/not found/);
  });

  it("throws when there is no active bid", async () => {
    mockPrisma.auction.findUnique.mockResolvedValue(makeAuction({ bids: [] }));
    await expect(settleAuction("auction-1")).rejects.toThrow(/No active bid/);
    expect(mockStripeInstance.paymentIntents.capture).not.toHaveBeenCalled();
  });

  it("captures the winning PI, creates the sale records against the renamed listingId column, and transfers ownership", async () => {
    await settleAuction("auction-1");

    expect(mockStripeInstance.paymentIntents.capture).toHaveBeenCalledWith("pi_win");

    expect(mockTx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          listingId: "card-1", sellerId: "seller-1", buyerId: "buyer-1",
          amount: 1500, currency: "sgd", status: "PAID", stripePaymentIntentId: "pi_win",
        }),
      })
    );

    expect(mockTx.cardTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: "order-1", listingId: "card-1", sellerId: "seller-1", buyerId: "buyer-1",
          amount: 1500, currency: "sgd", stripeEventId: "pi_win",
          tcgPlayerId: "tcg-1",
        }),
      })
    );

    expect(mockTx.bid.update).toHaveBeenCalledWith({ where: { id: "bid-1" }, data: { status: "won" } });

    expect(mockTx.listing.update).toHaveBeenCalledWith({
      where: { id: "card-1" },
      data: { ownerId: "buyer-1", inAuction: false, forSale: false },
    });

    expect(mockTx.auction.update).toHaveBeenCalledWith({
      where: { id: "auction-1" },
      data: { status: "sold" },
    });
  });

  it("cancels losing bidders' PIs and notifies them, using the renamed listingId as notifyAsync's cardId", async () => {
    mockPrisma.bid.findMany.mockResolvedValue([LOSING_BID]);

    await settleAuction("auction-1");

    expect(mockStripeInstance.paymentIntents.capture).toHaveBeenCalledWith("pi_win"); // sanity
    expect(mockNotifyAsync).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "buyer-2", type: "auction_expired", cardId: "card-1" })
    );
  });

  it("notifies the winner and seller with the resolved card title", async () => {
    await settleAuction("auction-1");

    expect(mockNotifyAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "buyer-1", type: "auction_won", cardId: "card-1",
        title: expect.stringContaining("Charizard"),
      })
    );
    expect(mockNotifyAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "seller-1", type: "auction_sold", cardId: "card-1",
        title: expect.stringContaining("Charizard"),
      })
    );
  });

  it("refunds the buyer if the DB transaction fails after PI capture", async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error("DB exploded"));

    await expect(settleAuction("auction-1")).rejects.toThrow("DB exploded");

    expect(mockStripeInstance.paymentIntents.capture).toHaveBeenCalledWith("pi_win");
    expect(mockStripeInstance.refunds.create).toHaveBeenCalledWith({ payment_intent: "pi_win" });
  });

  it("still throws the original error if the compensating refund itself fails", async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error("DB exploded"));
    mockStripeInstance.refunds.create.mockRejectedValue(new Error("refund also failed"));

    await expect(settleAuction("auction-1")).rejects.toThrow("DB exploded");
  });
});

describe("cancelBidPI", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cancels the PI", async () => {
    mockStripeInstance.paymentIntents.cancel.mockResolvedValue({});
    cancelBidPI("pi_1");
    expect(mockStripeInstance.paymentIntents.cancel).toHaveBeenCalledWith("pi_1");
  });

  it("swallows payment_intent_unexpected_state errors", async () => {
    mockStripeInstance.paymentIntents.cancel.mockRejectedValue({ code: "payment_intent_unexpected_state" });
    expect(() => cancelBidPI("pi_1")).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/auctionSettlement.test.ts`
Expected: FAIL — the module still calls `tx.card.update`/`tx.order.create({data:{cardId}})` and reads `auction.card`.

- [ ] **Step 3: Rewrite the implementation**

Replace the full contents of `src/lib/auctionSettlement.ts`:

```ts
/**
 * auctionSettlement.ts — shared logic for settling a completed auction.
 *
 * Called from three places:
 *   - POST /api/auctions/[id]/bid    (when a bid hits the reserve or buy-out price)
 *   - POST /api/auctions/[id]/decide (when the seller accepts after pending_seller_decision)
 *   - GET  /api/cron/expire-auctions (when the auction closes with highest bid >= reservePrice)
 *
 * Settlement mirrors the offer-accept flow in PATCH /api/offers/[id]:
 *   1. Capture the winning bid's PaymentIntent (money moves from buyer to platform).
 *   2. Atomic DB transaction:
 *      a. Create Order record (sale history + amount)
 *      b. Create CardTransaction audit record (stripeEventId = PI id, same convention)
 *      c. Mark winning bid → "won"
 *      d. Mark all other active bids → "cancelled" (PI cancellations happen outside tx)
 *      e. Transfer card ownership (ownerId = winner, inAuction = false)
 *      f. Mark auction → "sold"
 *   3. If DB fails AFTER capture: issue a Stripe refund (compensating transaction)
 *      so the buyer is made whole.
 *   4. Cancel losing bidders' PIs (fire-and-forget, same pattern as expired offers).
 *   5. Notify winner and seller (fire-and-forget).
 */

import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { notifyAsync } from "@/lib/notifications";
import { listingCatalogInclude, withListingDisplay } from "@/lib/listingDisplay";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-02-24.acacia",
});

/**
 * settleAuction — captures the winning PI and completes the ownership transfer.
 * Safe to call multiple times: returns immediately if the auction is already "sold".
 */
export async function settleAuction(auctionId: string): Promise<void> {
  // 1. Load the auction with its current winning (active) bid and card metadata.
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      bids: {
        where:   { status: "active" },
        orderBy: { amount: "desc" },
        take:    1,
      },
      listing: { select: { id: true, ...listingCatalogInclude } },
    },
  });

  if (!auction) throw new Error(`[auctionSettlement] Auction ${auctionId} not found`);
  if (auction.status === "sold") return; // already settled — idempotent

  const winningBid = auction.bids[0];
  if (!winningBid) throw new Error(`[auctionSettlement] No active bid on auction ${auctionId}`);

  const listingTitle = withListingDisplay(auction.listing).title;
  const listingTcgPlayerId = withListingDisplay(auction.listing).tcgPlayerId || undefined;

  // 2. Capture the winning PI. Money moves from buyer to platform.
  //    Capture first so the DB transaction can record the confirmed payment.
  //    If capture fails (issuer decline at capture time), we throw without
  //    touching the DB — auction stays in its current state for a retry.
  const captured = await stripe.paymentIntents.capture(winningBid.paymentIntentId);
  console.log(`[auctionSettlement] PI captured: ${captured.id} → ${captured.status}`);

  // 3. Snapshot losing bids now (before the transaction marks them cancelled)
  //    so we have their PI ids for the fire-and-forget cancellations in step 5.
  const losingBids = await prisma.bid.findMany({
    where:  { auctionId, status: "active", id: { not: winningBid.id } },
    select: { id: true, paymentIntentId: true, bidderId: true },
  });

  // 4. Atomic DB transaction — all succeed or all roll back.
  //    Cannot include Stripe calls here (they can't be rolled back).
  try {
    await prisma.$transaction(async (tx) => {
      // 4a. Create an Order record to represent this sale.
      const order = await tx.order.create({
        data: {
          listingId:              auction.listingId,
          sellerId:               auction.sellerId,
          buyerId:                winningBid.bidderId,
          amount:                 winningBid.amount,
          currency:               "sgd",
          status:                 "PAID",
          stripePaymentIntentId:  winningBid.paymentIntentId,
        },
      });

      // 4b. Permanent audit record.
      //     stripeEventId uses the PI id (same convention as PATCH /api/offers/[id])
      //     since auction settlements don't go through a Stripe webhook event.
      await tx.cardTransaction.create({
        data: {
          orderId:      order.id,
          listingId:    auction.listingId,
          sellerId:     auction.sellerId,
          buyerId:      winningBid.bidderId,
          amount:       winningBid.amount,
          currency:     "sgd",
          stripeEventId: winningBid.paymentIntentId,
          tcgPlayerId:  listingTcgPlayerId,
        },
      });

      // 4c. Mark winning bid as won.
      await tx.bid.update({
        where: { id: winningBid.id },
        data:  { status: "won" },
      });

      // 4d. Cancel all other active bids in the DB.
      //     Their Stripe PIs are cancelled outside the transaction (step 5).
      if (losingBids.length > 0) {
        await tx.bid.updateMany({
          where: { auctionId, status: "active", id: { not: winningBid.id } },
          data:  { status: "cancelled" },
        });
      }

      // 4e. Transfer card ownership.
      await tx.listing.update({
        where: { id: auction.listingId },
        data:  { ownerId: winningBid.bidderId, inAuction: false, forSale: false },
      });

      // 4f. Mark auction as sold.
      await tx.auction.update({
        where: { id: auctionId },
        data:  { status: "sold" },
      });
    });
  } catch (dbErr) {
    // DB failed AFTER PI was captured — refund the buyer to make them whole.
    console.error("[auctionSettlement] DB transaction failed after capture, issuing refund:", dbErr);
    try {
      await stripe.refunds.create({ payment_intent: winningBid.paymentIntentId });
    } catch (refundErr) {
      console.error("[auctionSettlement] Refund also failed — manual intervention required:", refundErr);
    }
    throw dbErr;
  }

  // 5. Cancel losing PIs outside the transaction — fire-and-forget.
  //    A background cron can sweep up any that slip through on transient errors.
  for (const bid of losingBids) {
    cancelBidPI(bid.paymentIntentId);
    notifyAsync({
      userId: bid.bidderId,
      type:   "auction_expired",
      title:  `Auction ended for "${listingTitle}"`,
      body:   `The auction for "${listingTitle}" has ended. You did not win this time.`,
      cardId: auction.listingId,
    });
  }

  // 6. Notify winner and seller.
  const amountDisplay = `S$${(winningBid.amount / 100).toFixed(2)}`;

  notifyAsync({
    userId: winningBid.bidderId,
    type:   "auction_won",
    title:  `You won "${listingTitle}"!`,
    body:   `Congratulations! You won the auction for "${listingTitle}" at ${amountDisplay}. The card is now yours.`,
    cardId: auction.listingId,
  });

  notifyAsync({
    userId: auction.sellerId,
    type:   "auction_sold",
    title:  `"${listingTitle}" sold via auction`,
    body:   `Your card "${listingTitle}" was sold for ${amountDisplay}.`,
    cardId: auction.listingId,
  });

  console.log(
    `[auctionSettlement] Settled. Auction: ${auctionId}, Winner: ${winningBid.bidderId}, Amount: ${winningBid.amount}`
  );
}

/**
 * cancelBidPI — cancels a bid's Stripe PI, swallowing terminal-state errors.
 * Exported so the cron and decide route can reuse it without duplicating
 * the payment_intent_unexpected_state guard (same pattern as expireOffer).
 */
export function cancelBidPI(paymentIntentId: string): void {
  stripe.paymentIntents.cancel(paymentIntentId).catch((err: { code?: string }) => {
    // payment_intent_unexpected_state = PI already captured/cancelled — safe to ignore.
    if (err?.code !== "payment_intent_unexpected_state") {
      console.error(`[auctionSettlement] Failed to cancel PI ${paymentIntentId}:`, err);
    }
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/lib/auctionSettlement.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/auctionSettlement.ts src/__tests__/lib/auctionSettlement.test.ts
git commit -m "fix: rewire auctionSettlement onto Listing + catalog tables; add direct test coverage"
```

---

### Task 7: `src/app/api/cron/expire-auctions/route.ts` — GET/POST cron (final task)

**Files:**
- Modify: `src/app/api/cron/expire-auctions/route.ts`
- Modify: `src/__tests__/api/cron/expire-auctions.test.ts`

**Interfaces:**
- Consumes: `listingCatalogInclude`, `withListingDisplay` from `@/lib/listingDisplay`, and `settleAuction`/`cancelBidPI` from `@/lib/auctionSettlement` (Task 6, unchanged signatures).

- [ ] **Step 1: Update the failing test**

Replace the full contents of `src/__tests__/api/cron/expire-auctions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * GET /api/cron/expire-auctions — Vercel cron that closes ended auctions.
 *
 * Two passes per run:
 *
 * Pass 1 — Active auctions whose endsAt has passed:
 *   a) No bids     → expire immediately, notify seller
 *   b) bid >= RP   → settleAuction (auto-settle)
 *   c) bid < RP (or no RP) → pending_seller_decision + 24h deadline + notify seller
 *
 * Pass 2 — pending_seller_decision auctions whose deadline has passed:
 *   → cancelBidPI, expire auction+card, notify bidder
 */

// ── STEP 1: Create the mock objects ──────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  auction: {
    findMany: vi.fn(),
    update:   vi.fn(),
    updateMany: vi.fn(),
  },
  bid:  { update: vi.fn() },
  listing: { update: vi.fn() },
  $transaction: vi.fn(),
}));

const mockSettleAuction = vi.hoisted(() => vi.fn());
const mockCancelBidPI   = vi.hoisted(() => vi.fn());

// ── STEP 2: Register the fakes ────────────────────────────────────────────────

vi.mock("@/lib/prisma",   () => ({ prisma: mockPrisma }));
vi.mock("@/lib/notifications",     () => ({ notifyAsync: vi.fn() }));
vi.mock("@/lib/auctionSettlement", () => ({
  settleAuction: mockSettleAuction,
  cancelBidPI:   mockCancelBidPI,
}));

// ── STEP 3: Import the code under test ───────────────────────────────────────

import { GET } from "@/app/api/cron/expire-auctions/route";
import { notifyAsync } from "@/lib/notifications";

// ── Helpers ───────────────────────────────────────────────────────────────────

function cronReq(token?: string) {
  return new NextRequest("http://localhost/api/cron/expire-auctions", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

const LISTING = {
  id: "card-1",
  pokemonCard: {
    nameEn: "Charizard", rarity: "Rare Holo", setNameEn: "Base Set",
    language: "English", localId: "4/102", tcgPlayerId: "tcg-1",
  },
  riftboundCard: null,
};

function makeAuction(overrides = {}) {
  return {
    id:          "auction-1",
    sellerId:    "seller-1",
    reservePrice: null,
    bids:        [],
    listing:     LISTING,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "cron-secret";
  mockSettleAuction.mockResolvedValue(undefined);
  mockCancelBidPI.mockResolvedValue(undefined);
  // Default: no auctions to process in either pass
  mockPrisma.auction.findMany.mockResolvedValue([]);
  mockPrisma.$transaction.mockResolvedValue([]);
  mockPrisma.auction.update.mockResolvedValue({});
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/cron/expire-auctions", () => {
  // ── Auth ──────────────────────────────────────────────────────────────────────
  it("returns 401 with no token", async () => {
    const res = await GET(cronReq());
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong token", async () => {
    const res = await GET(cronReq("wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("returns 200 with correct token when nothing to process", async () => {
    const res = await GET(cronReq("cron-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settled).toBe(0);
    expect(body.expiredNoBids).toBe(0);
  });

  // ── Pass 1a: no bids → expire ─────────────────────────────────────────────
  it("Pass 1a: expires auction with no bids and notifies seller with the resolved title", async () => {
    const auction = makeAuction({ bids: [] });
    mockPrisma.auction.findMany
      .mockResolvedValueOnce([auction])
      .mockResolvedValueOnce([]);

    const res = await GET(cronReq("cron-secret"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.expiredNoBids).toBe(1);
    expect(body.settled).toBe(0);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);

    expect(notifyAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "seller-1", type: "auction_expired",
        cardId: "card-1", title: expect.stringContaining("Charizard"),
      })
    );
  });

  // ── Pass 1b: bid >= reservePrice → auto-settle ───────────────────────────
  it("Pass 1b: settles auction when bid meets reservePrice", async () => {
    const auction = makeAuction({
      reservePrice: 1000, // S$10
      bids: [{ id: "bid-1", paymentIntentId: "pi_1", bidderId: "buyer-1", amount: 1000 }],
    });
    mockPrisma.auction.findMany
      .mockResolvedValueOnce([auction])
      .mockResolvedValueOnce([]);

    const res = await GET(cronReq("cron-secret"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.settled).toBe(1);
    expect(mockSettleAuction).toHaveBeenCalledWith("auction-1");
  });

  // ── Pass 1c: bid < reservePrice → pending_seller_decision ───────────────
  it("Pass 1c: moves to pending_seller_decision when bid is below reservePrice", async () => {
    const auction = makeAuction({
      reservePrice: 2000, // S$20
      bids: [{ id: "bid-1", paymentIntentId: "pi_1", bidderId: "buyer-1", amount: 1000 }],
    });
    mockPrisma.auction.findMany
      .mockResolvedValueOnce([auction])
      .mockResolvedValueOnce([]);

    const res = await GET(cronReq("cron-secret"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.pendingDecision).toBe(1);
    expect(mockSettleAuction).not.toHaveBeenCalled();

    expect(mockPrisma.auction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "auction-1" },
        data:  expect.objectContaining({ status: "pending_seller_decision" }),
      })
    );

    expect(notifyAsync).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "seller-1", type: "auction_decision_needed", cardId: "card-1" })
    );
  });

  // ── Pass 1c: no reservePrice → also pending_seller_decision ──────────────
  it("Pass 1c: moves to pending_seller_decision when no reservePrice is set", async () => {
    const auction = makeAuction({
      reservePrice: null,
      bids: [{ id: "bid-1", paymentIntentId: "pi_1", bidderId: "buyer-1", amount: 1000 }],
    });
    mockPrisma.auction.findMany
      .mockResolvedValueOnce([auction])
      .mockResolvedValueOnce([]);

    const res = await GET(cronReq("cron-secret"));
    const body = await res.json();
    expect(body.pendingDecision).toBe(1);
    expect(mockSettleAuction).not.toHaveBeenCalled();
  });

  // ── Pass 2: decision timeout → expire ────────────────────────────────────
  it("Pass 2: cancels PI and expires auction when seller decision deadline passes", async () => {
    const auction = makeAuction({
      bids: [{ id: "bid-1", paymentIntentId: "pi_expired", bidderId: "buyer-1" }],
    });
    mockPrisma.auction.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([auction]);

    const res = await GET(cronReq("cron-secret"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.expiredDecisionTimeout).toBe(1);

    expect(mockCancelBidPI).toHaveBeenCalledWith("pi_expired");
    expect(mockPrisma.$transaction).toHaveBeenCalled();

    expect(notifyAsync).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "buyer-1", type: "auction_expired", cardId: "card-1" })
    );
  });

  // ── Resilience ────────────────────────────────────────────────────────────
  it("continues processing after one failure and reports it in errors[]", async () => {
    const good = makeAuction({ id: "auction-good", bids: [] });
    const bad  = makeAuction({
      id:          "auction-bad",
      reservePrice: 500,
      bids: [{ id: "bid-1", paymentIntentId: "pi_1", bidderId: "buyer-1", amount: 500 }],
    });

    mockPrisma.auction.findMany
      .mockResolvedValueOnce([good, bad])
      .mockResolvedValueOnce([]);

    mockSettleAuction.mockRejectedValueOnce(new Error("Stripe timeout"));

    const res = await GET(cronReq("cron-secret"));
    const body = await res.json();

    expect(body.failed).toBe(1);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0]).toContain("auction-bad");
    expect(body.expiredNoBids).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/api/cron/expire-auctions.test.ts`
Expected: FAIL — the route still calls `prisma.card.update` and reads `auction.card.title`/`auction.card.id`.

- [ ] **Step 3: Rewrite the route**

Replace the full contents of `src/app/api/cron/expire-auctions/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { settleAuction, cancelBidPI } from "@/lib/auctionSettlement";
import { notifyAsync } from "@/lib/notifications";
import { listingCatalogInclude, withListingDisplay } from "@/lib/listingDisplay";

/**
 * GET /api/cron/expire-auctions  ← called by Vercel Cron Jobs (vercel.json)
 * POST /api/cron/expire-auctions ← kept for local curl testing
 *
 * Runs every 5 minutes. Two passes per run:
 *
 * Pass 1 — Close active auctions whose endsAt has passed:
 *   a) No bids:
 *      → mark auction "expired", release Listing.inAuction
 *      → notify seller
 *   b) Highest bid >= reservePrice (or no RP set on the auction — auto-settle):
 *      Actually: if reservePrice is null, bid still goes to seller decision.
 *      Only auto-settle when a bid >= reservePrice AND reservePrice is set.
 *      → call settleAuction() (captures PI, transfers card)
 *   c) Highest bid < reservePrice (or reservePrice is null):
 *      → mark auction "pending_seller_decision"
 *      → set sellerDecisionDeadline = now + 24h
 *      → notify seller to decide
 *
 * Pass 2 — Expire pending_seller_decision auctions whose deadline has passed:
 *   → cancel highest bid PI
 *   → mark auction "expired", release Listing.inAuction, cancel bid
 *   → notify bidder and seller
 */

async function runExpiry(req: NextRequest): Promise<NextResponse> {
  // ── 1. Authorise the cron caller ──────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken) {
    console.error("[cron/expire-auctions] CRON_SECRET env var is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const results = {
    settled:    0,
    pendingDecision: 0,
    expiredNoBids: 0,
    expiredDecisionTimeout: 0,
    failed: 0,
    errors: [] as string[],
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PASS 1 — Active auctions past their end time
  // ═══════════════════════════════════════════════════════════════════════════

  const activeExpired = await prisma.auction.findMany({
    where: { status: "active", endsAt: { lt: now } },
    include: {
      bids: {
        where:   { status: "active" },
        orderBy: { amount: "desc" },
        take:    1,
        select:  { id: true, paymentIntentId: true, bidderId: true, amount: true },
      },
      listing: { select: { id: true, ...listingCatalogInclude } },
    },
  });

  for (const auction of activeExpired) {
    try {
      const topBid = auction.bids[0];
      const listingTitle = withListingDisplay(auction.listing).title;

      // ── 1a. No bids — expire immediately ──────────────────────────────────
      if (!topBid) {
        // 1. Expire the auction and release the card lock atomically.
        await prisma.$transaction([
          prisma.auction.update({
            where: { id: auction.id },
            data:  { status: "expired" },
          }),
          prisma.listing.update({
            where: { id: auction.listing.id },
            data:  { inAuction: false },
          }),
        ]);

        // 2. Notify the seller — fire-and-forget (does not block the loop).
        notifyAsync({
          userId: auction.sellerId,
          type:   "auction_expired",
          title:  `Auction ended with no bids: "${listingTitle}"`,
          body:   `Your auction for "${listingTitle}" ended without any bids.`,
          cardId: auction.listing.id,
        });

        results.expiredNoBids++;
        continue;
      }

      // ── 1b. Bid >= reservePrice → auto-settle (no seller action needed) ───
      // 1. Capture the winning PI, transfer card ownership, and mark sold.
      //    (See auctionSettlement.ts for the full numbered sequence.)
      if (auction.reservePrice !== null && topBid.amount >= auction.reservePrice) {
        await settleAuction(auction.id);
        results.settled++;
        continue;
      }

      // ── 1c. Bid below RP (or no RP set) → seller decision window ─────────
      // 1. Compute the 24-hour deadline from now.
      const deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // 2. Flip auction to pending_seller_decision and record the deadline.
      //    listing.inAuction stays true — the card remains locked until seller decides.
      await prisma.auction.update({
        where: { id: auction.id },
        data:  { status: "pending_seller_decision", sellerDecisionDeadline: deadline },
      });

      // 3. Notify the seller to accept or decline — fire-and-forget.
      notifyAsync({
        userId: auction.sellerId,
        type:   "auction_decision_needed",
        title:  `Decision needed: "${listingTitle}"`,
        body:   `Your auction for "${listingTitle}" ended with a top bid of S$${(topBid.amount / 100).toFixed(2)}. You have 24 hours to accept or decline.`,
        cardId: auction.listing.id,
      });

      results.pendingDecision++;
    } catch (err) {
      results.failed++;
      results.errors.push(
        `Auction ${auction.id}: ${err instanceof Error ? err.message : String(err)}`
      );
      console.error("[cron/expire-auctions] Pass 1 failed for auction:", auction.id, err);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PASS 2 — pending_seller_decision auctions past their deadline
  // ═══════════════════════════════════════════════════════════════════════════

  const decisionExpired = await prisma.auction.findMany({
    where: {
      status:                  "pending_seller_decision",
      sellerDecisionDeadline:  { lt: now },
    },
    include: {
      bids: {
        where:   { status: "active" },
        orderBy: { amount: "desc" },
        take:    1,
        select:  { id: true, paymentIntentId: true, bidderId: true },
      },
      listing: { select: { id: true, ...listingCatalogInclude } },
    },
  });

  for (const auction of decisionExpired) {
    try {
      const topBid = auction.bids[0];

      if (topBid) {
        // 1. Cancel the Stripe PI — releases the buyer's held funds (fire-and-forget).
        cancelBidPI(topBid.paymentIntentId);

        // 2. Cancel bid, expire auction, and release card lock atomically.
        await prisma.$transaction([
          prisma.bid.update({
            where: { id: topBid.id },
            data:  { status: "cancelled" },
          }),
          prisma.auction.update({
            where: { id: auction.id },
            data:  { status: "expired" },
          }),
          prisma.listing.update({
            where: { id: auction.listing.id },
            data:  { inAuction: false },
          }),
        ]);

        // 3. Notify the bidder their hold is released — fire-and-forget.
        //    Note: seller is not notified here (they chose not to respond).
        notifyAsync({
          userId: topBid.bidderId,
          type:   "auction_expired",
          title:  `Auction expired: "${withListingDisplay(auction.listing).title}"`,
          body:   `The seller did not respond in time on "${withListingDisplay(auction.listing).title}". Your payment hold has been released.`,
          cardId: auction.listing.id,
        });
      } else {
        // Edge case: no active bid found (e.g. bid was already cancelled externally).
        // 1. Expire the auction and release the card lock.
        await prisma.$transaction([
          prisma.auction.update({
            where: { id: auction.id },
            data:  { status: "expired" },
          }),
          prisma.listing.update({
            where: { id: auction.listing.id },
            data:  { inAuction: false },
          }),
        ]);
      }

      results.expiredDecisionTimeout++;
    } catch (err) {
      results.failed++;
      results.errors.push(
        `Auction ${auction.id}: ${err instanceof Error ? err.message : String(err)}`
      );
      console.error("[cron/expire-auctions] Pass 2 failed for auction:", auction.id, err);
    }
  }

  console.log("[cron/expire-auctions] Done.", results);

  return NextResponse.json({
    settled:                results.settled,
    pendingDecision:        results.pendingDecision,
    expiredNoBids:          results.expiredNoBids,
    expiredDecisionTimeout: results.expiredDecisionTimeout,
    failed:                 results.failed,
    ...(results.errors.length > 0 && { errors: results.errors }),
  });
}

export const GET  = runExpiry;
export const POST = runExpiry;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/api/cron/expire-auctions.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, all tests green (this is the last task in the plan — this is the point to confirm nothing outside this plan's direct scope regressed).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/expire-auctions/route.ts src/__tests__/api/cron/expire-auctions.test.ts
git commit -m "fix: rewire expire-auctions cron onto Listing + catalog tables"
```

---

## Manual Verification (after all tasks complete)

1. Start an auction on a seeded for-sale listing (both a Pokémon and, if a Riftbound listing is for sale, that too) against the live dev database; confirm the auction is created and the listing is correctly locked (`inAuction: true`, `forSale: false`).
2. Place a bid (test-mode PI) and confirm the auction's `currentBid`/`highestBidderId` update and the seller receives a `bid_received` notification with the correct resolved title.
3. Trigger `settleAuction` (via a buy-out bid or the decide-accept flow) and confirm in the database that `Order`/`CardTransaction` rows are created with `listingId` set, and the listing's ownership actually transfers.
4. Confirm `GET /api/auctions` and `GET /api/auctions/[id]` both return the resolved `card.title` (not raw catalog objects) for a real auction.
