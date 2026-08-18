# Offers API Rewiring (Plan 2c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every Offers backend file still calling the pre-rename Prisma model `Card`/`cardId` (renamed to `Listing`/`listingId` with catalog tables in a prior plan), so a buyer can place/amend an offer, a seller can accept/reject one, and the expiry cron keeps working.

**Architecture:** Same pattern as Plans 2a/2b: resolve card-identity fields (title, rarity, etc.) via the existing `src/lib/listingDisplay.ts` helper (`listingCatalogInclude`, `withListingDisplay`), unmodified by this plan. External wire contracts stay exactly as they are today — JSON request/response field names (`cardId` in bodies and query params), `notifyAsync`'s `cardId` parameter — only internal Prisma calls change to the renamed `Listing`/`listingId`. This plan runs independently of and concurrently with Plan 2d (Auctions) — the two touch entirely disjoint files (confirmed during planning) and share no code changes, only a read-only dependency: Plan 2d's `auctions/route.ts` queries the `Offer` model (to block starting an auction on a card with a pending offer), and that query already needs `Offer.listingId` regardless of which plan's work lands first.

**Tech Stack:** Next.js 14 App Router route handlers, Prisma 6, Stripe SDK, Vitest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-08-17-riftbound-card-schema-design.md` — same relationship as Plans 2a/2b: a direct continuation of that architectural work.

## Global Constraints

- **No schema changes.** Confirmed field names from `prisma/schema.prisma`: `Offer.listingId` (renamed from `cardId`), `Order.listingId`, `CardTransaction.listingId`. `Listing`'s own scalar fields (`price`, `condition`, `imageUrls`, `forSale`, `ownerId`, `reservedById`, `reservedUntil`, `inAuction`) are unchanged from the old `Card` model.
- **External wire contracts are preserved exactly.** Query params (`?cardId=...`), JSON request bodies (`{ cardId, price, ... }`), and every offer object's own `cardId` field in JSON responses all keep the literal string `cardId` — only internal Prisma field names change to `listingId`. Since a raw `Offer` row now has `.listingId` instead of `.cardId`, every place this plan returns an offer object to the client renames it back: destructure `listingId` out and re-attach it as `cardId` in the response object, never expose `listingId` in a JSON body.
- **`notifyAsync`'s `cardId` parameter is unchanged** (fixed in Plan 2b's Task 1) — every call in this plan keeps passing `cardId: <the listing's id>`.
- **`src/lib/offerExpiry.ts` needs NO changes.** Checked during planning — `expireOffer()` only reads `id`/`paymentIntentId` off the offer object it's given; it never references `cardId` or any Card/Listing field. Not included as a task.
- **Offer's `card`/buyer/owner includes deliberately include email** in this route (unlike the public card-browsing routes fixed in Plans 2a/2b) — this is existing, intentional behavior for a buyer-seller transaction context, not a bug. Do not strip email here; only fix the Card→Listing/catalog rewiring.
- Prices are stored in cents; `dollarsToCents`/`centsToDollars` from `@/lib/money` convert at API boundaries, exactly where the current code already does.
- Test files follow this codebase's existing mock pattern: `vi.hoisted(() => ({...}))` to build the mock object, `vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))` to register it, then `import` the route under test.

---

### Task 1: `src/app/api/offers/route.ts` — GET (list) and POST (place/amend)

**Files:**
- Modify: `src/app/api/offers/route.ts`
- Modify: `src/__tests__/api/offers/route.test.ts`

**Interfaces:**
- Consumes: `listingCatalogInclude`, `withListingDisplay` from `@/lib/listingDisplay`.
- Produces (used by no other task in this plan, but establishes the pattern Task 2 follows): a local `serializeOffer(offer)` helper in this file that renames the Prisma `listingId` field back to `cardId` in the JSON response and converts price cents→dollars.

- [ ] **Step 1: Update the failing test**

Replace the full contents of `src/__tests__/api/offers/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * HOW THIS FILE EXECUTES (what Vitest does before a single test runs)
 *
 * 1. vi.hoisted() blocks run first — creates four mock objects in memory:
 *      mockStripeInstance   — fake Stripe client (paymentIntents.retrieve, cancel)
 *      mockPrisma           — fake Prisma client (listing, offer)
 *      mockGetServerSession — fake auth function
 *
 * 2. vi.mock() factories run second — registers the fakes so any module that
 *    imports these packages gets the fake version instead of the real one.
 *
 * 3. import { GET, POST } runs last — the real route is loaded with fakes in place.
 *
 * This file covers two endpoints on the same route file:
 *
 *   POST /api/offers — buyer submits an offer:
 *     a) New offer  → create a fresh offer row with a 24h expiry
 *     b) Amend offer → buyer already has a pending offer, update it in-place
 *        (cancel the old PI, issue a new one with the new price)
 *
 *   GET /api/offers — retrieve offers:
 *     a) ?cardId=&myOffer=true → buyer's own offer on a specific card
 *     b) ?cardId=              → all offers on a card (seller only)
 *     c) ?mine=true            → all of the buyer's offers across all cards
 *     d) ?received=true        → all offers received on the seller's cards (all lifecycle states)
 *
 * The Offer model's card reference is `listingId` (renamed from `cardId`), but
 * the request/response wire format still uses `cardId` — see serializeOffer()
 * in the route file for the translation.
 */

// ── STEP 1: Create the mock objects ──────────────────────────────────────────

const mockStripeInstance = vi.hoisted(() => ({
  paymentIntents: {
    retrieve: vi.fn(), // POST: validates PI is authorised before saving offer
    cancel: vi.fn(),   // POST: cancels old PI when buyer amends an existing offer
  },
}));

const mockPrisma = vi.hoisted(() => ({
  listing: { findUnique: vi.fn() },
  offer: {
    findFirst: vi.fn(),  // checks for an existing offer from this buyer
    findMany: vi.fn(),   // returns list of offers (GET)
    create: vi.fn(),     // new offer
    update: vi.fn(),     // amend existing offer
  },
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

// ── STEP 2: Register the fakes ────────────────────────────────────────────────

vi.mock("stripe", () => ({ default: vi.fn(() => mockStripeInstance) }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
// Silence the Resend SDK — notification side-effects are tested separately.
vi.mock("@/lib/notifications", () => ({ notifyAsync: vi.fn(), createNotification: vi.fn() }));

// ── STEP 3: Import the code under test ───────────────────────────────────────

import { GET, POST } from "@/app/api/offers/route";
import { notifyAsync } from "@/lib/notifications";

// ── Test helpers + shared data ────────────────────────────────────────────────

const LISTING = { id: "card-1", forSale: true, ownerId: "seller-1" };

function pokemonCatalog(title = "Charizard") {
  return {
    nameEn: title, rarity: "Rare Holo", setNameEn: "Base Set",
    language: "English", localId: "4/102", tcgPlayerId: "tcg-1",
  };
}

// A PaymentIntent that has been authorised — funds held, ready to capture.
// `amount` (5000 cents = S$50) matches the default `price: 50` used by most
// POST tests below. Tests that submit a different price (the amend tests,
// which use price: 60) override this mock with a matching `amount`.
const PI_REQUIRES_CAPTURE = { status: "requires_capture", metadata: { buyerId: "buyer-1" }, amount: 5000 };

function postRequest(body: object) {
  return new NextRequest("http://localhost/api/offers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/offers");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/offers
// ═════════════════════════════════════════════════════════════════════════════
describe("POST /api/offers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated buyer
    mockGetServerSession.mockResolvedValue({ user: { id: "buyer-1" } });
    // Default: listing exists and is for sale
    mockPrisma.listing.findUnique.mockResolvedValue(LISTING);
    // Default: PI is authorised and belongs to this buyer
    mockStripeInstance.paymentIntents.retrieve.mockResolvedValue(PI_REQUIRES_CAPTURE);
    // Default: no existing offer from this buyer
    mockPrisma.offer.findFirst.mockResolvedValue(null);
    // Default: PI cancel succeeds (used in amend path)
    mockStripeInstance.paymentIntents.cancel.mockResolvedValue({});
  });

  // ── Auth ──────────────────────────────────────────────────────────────────

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(postRequest({ cardId: "card-1", price: 50, paymentIntentId: "pi_1" }));
    expect(res.status).toBe(401);
  });

  // ── Input validation ──────────────────────────────────────────────────────

  it("returns 400 when cardId is missing", async () => {
    const res = await POST(postRequest({ price: 50, paymentIntentId: "pi_1" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "Invalid offer data" });
  });

  it("returns 400 when price is zero or negative", async () => {
    const res = await POST(postRequest({ cardId: "card-1", price: 0, paymentIntentId: "pi_1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when paymentIntentId is missing", async () => {
    const res = await POST(postRequest({ cardId: "card-1", price: 50 }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "Missing paymentIntentId" });
  });

  // ── Card validation ───────────────────────────────────────────────────────

  it("returns 404 when card does not exist", async () => {
    mockPrisma.listing.findUnique.mockResolvedValue(null);
    const res = await POST(postRequest({ cardId: "x", price: 50, paymentIntentId: "pi_1" }));
    expect(res.status).toBe(404);
  });

  it("returns 409 when card is not for sale", async () => {
    mockPrisma.listing.findUnique.mockResolvedValue({ ...LISTING, forSale: false });
    const res = await POST(postRequest({ cardId: "card-1", price: 50, paymentIntentId: "pi_1" }));
    expect(res.status).toBe(409);
  });

  it("returns 400 when buyer tries to offer on their own card", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "seller-1" } });
    const res = await POST(postRequest({ cardId: "card-1", price: 50, paymentIntentId: "pi_1" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "Cannot offer on your own card" });
  });

  // ── PaymentIntent validation ──────────────────────────────────────────────

  it("returns 409 when PI is not in requires_capture state (card declined etc.)", async () => {
    mockStripeInstance.paymentIntents.retrieve.mockResolvedValue({
      status: "canceled",
      metadata: {},
    });
    const res = await POST(postRequest({ cardId: "card-1", price: 50, paymentIntentId: "pi_1" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("status: canceled") });
  });

  it("returns 403 when PI buyerId metadata does not match the authenticated buyer", async () => {
    mockStripeInstance.paymentIntents.retrieve.mockResolvedValue({
      status: "requires_capture",
      metadata: { buyerId: "someone-else" },
    });
    const res = await POST(postRequest({ cardId: "card-1", price: 50, paymentIntentId: "pi_1" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 and cancels the PI when its authorised amount doesn't match the claimed price", async () => {
    const res = await POST(postRequest({ cardId: "card-1", price: 500, paymentIntentId: "pi_1" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("does not match") });
    expect(mockStripeInstance.paymentIntents.cancel).toHaveBeenCalledWith("pi_1");
    expect(mockPrisma.offer.create).not.toHaveBeenCalled();
  });

  // ── New offer (happy path) ────────────────────────────────────────────────

  it("creates a new pending offer and returns 201 with cardId (not listingId) in the response", async () => {
    const createdOffer = {
      id: "offer-1",
      listingId: "card-1",
      buyerId: "buyer-1",
      sellerId: "seller-1",
      price: 5000,
      message: null,
      status: "pending",
      paymentIntentId: "pi_1",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockPrisma.offer.create.mockResolvedValue(createdOffer);

    const res = await POST(postRequest({ cardId: "card-1", price: 50, paymentIntentId: "pi_1" }));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.amended).toBe(false);
    expect(data.offer.price).toBe(50);
    expect(data.offer.status).toBe("pending");
    // Wire format: cardId present, listingId never leaked to the client.
    expect(data.offer.cardId).toBe("card-1");
    expect(data.offer).not.toHaveProperty("listingId");

    expect(mockPrisma.offer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          listingId: "card-1",
          buyerId: "buyer-1",
          sellerId: "seller-1",
          status: "pending",
          paymentIntentId: "pi_1",
          expiresAt: expect.any(Date),
        }),
      })
    );
  });

  // ── Existing accepted offer ───────────────────────────────────────────────

  it("returns 409 when buyer already has an accepted offer (mid-capture)", async () => {
    mockPrisma.offer.findFirst.mockResolvedValue({ id: "offer-old", status: "accepted" });

    const res = await POST(postRequest({ cardId: "card-1", price: 50, paymentIntentId: "pi_1" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("accepted offer") });
  });

  // ── Amend existing pending offer ──────────────────────────────────────────

  it("cancels the old PI and updates the existing pending offer (amended: true)", async () => {
    const existingOffer = {
      id: "offer-old",
      status: "pending",
      paymentIntentId: "pi_old",
    };
    mockPrisma.offer.findFirst.mockResolvedValue(existingOffer);
    mockStripeInstance.paymentIntents.retrieve.mockResolvedValue({
      status: "requires_capture", metadata: { buyerId: "buyer-1" }, amount: 6000,
    });

    const updatedOffer = {
      id: "offer-old",
      listingId: "card-1",
      price: 6000,
      message: "Can pick up in person",
      status: "pending",
      paymentIntentId: "pi_new",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
    mockPrisma.offer.update.mockResolvedValue(updatedOffer);

    const res = await POST(
      postRequest({ cardId: "card-1", price: 60, message: "Can pick up in person", paymentIntentId: "pi_new" })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.amended).toBe(true);
    expect(data.offer.cardId).toBe("card-1");

    expect(mockStripeInstance.paymentIntents.cancel).toHaveBeenCalledWith("pi_old");

    expect(mockPrisma.offer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "offer-old" },
        data: expect.objectContaining({
          paymentIntentId: "pi_new",
          expiresAt: expect.any(Date),
        }),
      })
    );

    const updateCall = mockPrisma.offer.update.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty("sellerId");
  });

  it("notifies the seller with the updated price when an offer is amended", async () => {
    mockPrisma.offer.findFirst.mockResolvedValue({
      id: "offer-old",
      status: "pending",
      paymentIntentId: "pi_old",
    });
    mockStripeInstance.paymentIntents.retrieve.mockResolvedValue({
      status: "requires_capture", metadata: { buyerId: "buyer-1" }, amount: 6000,
    });
    mockPrisma.offer.update.mockResolvedValue({
      id: "offer-old",
      listingId: "card-1",
      price: 6000,
      message: null,
      status: "pending",
      paymentIntentId: "pi_new",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await POST(
      postRequest({ cardId: "card-1", price: 60, paymentIntentId: "pi_new" })
    );

    expect(vi.mocked(notifyAsync)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notifyAsync)).toHaveBeenCalledWith(
      expect.objectContaining({
        userId:  "seller-1",
        type:    "offer_received",
        offerId: "offer-old",
        cardId:  "card-1",
        body:    expect.stringContaining("S$60"),
      })
    );
  });

  it("continues amending even if cancelling old PI fails (logs warning)", async () => {
    mockPrisma.offer.findFirst.mockResolvedValue({
      id: "offer-old",
      status: "pending",
      paymentIntentId: "pi_old",
    });
    mockStripeInstance.paymentIntents.retrieve.mockResolvedValue({
      status: "requires_capture", metadata: { buyerId: "buyer-1" }, amount: 6000,
    });
    mockStripeInstance.paymentIntents.cancel.mockRejectedValue(new Error("already cancelled"));
    mockPrisma.offer.update.mockResolvedValue({
      id: "offer-old", listingId: "card-1", price: 6000, message: null, status: "pending",
      paymentIntentId: "pi_new", expiresAt: new Date(),
    });

    const res = await POST(
      postRequest({ cardId: "card-1", price: 60, paymentIntentId: "pi_new" })
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.offer.update).toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/offers
// ═════════════════════════════════════════════════════════════════════════════
describe("GET /api/offers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: "buyer-1" } });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET(getRequest({ mine: "true" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when no recognised query param is provided", async () => {
    const res = await GET(getRequest({}));
    expect(res.status).toBe(400);
  });

  // ── Buyer: my offer on a specific card ────────────────────────────────────

  it("returns buyer's own offer when cardId + myOffer=true, with cardId in the response", async () => {
    const offer = { id: "offer-1", listingId: "card-1", price: 5000, status: "pending" };
    mockPrisma.offer.findFirst.mockResolvedValue(offer);

    const res = await GET(getRequest({ cardId: "card-1", myOffer: "true" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.offer.price).toBe(50);
    expect(data.offer.cardId).toBe("card-1");
    expect(data.offer).not.toHaveProperty("listingId");
  });

  it("returns null when buyer has no offer on the card", async () => {
    mockPrisma.offer.findFirst.mockResolvedValue(null);

    const res = await GET(getRequest({ cardId: "card-1", myOffer: "true" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.offer).toBeNull();
  });

  // ── Seller: all offers on their card ─────────────────────────────────────

  it("returns all offers for the seller who owns the card", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "seller-1" } });
    mockPrisma.listing.findUnique.mockResolvedValue({ ownerId: "seller-1" });
    mockPrisma.offer.findMany.mockResolvedValue([
      { id: "offer-1", listingId: "card-1", price: 5000, status: "pending", buyer: { id: "buyer-1", username: "bob", email: "bob@x.com" } },
    ]);

    const res = await GET(getRequest({ cardId: "card-1" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.offers).toHaveLength(1);
    expect(data.offers[0].price).toBe(50);
    expect(data.offers[0].cardId).toBe("card-1");
    // Buyer email IS expected here — this route deliberately keeps it (see
    // Global Constraints), unlike the public card-browsing routes.
    expect(data.offers[0].buyer.email).toBe("bob@x.com");
  });

  it("returns 403 when a non-owner tries to view offers on a card", async () => {
    mockPrisma.listing.findUnique.mockResolvedValue({ ownerId: "seller-1" });

    const res = await GET(getRequest({ cardId: "card-1" }));
    expect(res.status).toBe(403);
  });

  it("returns 404 when the card does not exist (seller view)", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "seller-1" } });
    mockPrisma.listing.findUnique.mockResolvedValue(null);

    const res = await GET(getRequest({ cardId: "missing-card" }));
    expect(res.status).toBe(404);
  });

  // ── Buyer: full offer history ─────────────────────────────────────────────

  it("returns all of the buyer's offers when mine=true, with resolved catalog fields", async () => {
    mockPrisma.offer.findMany.mockResolvedValue([
      {
        id: "offer-1", listingId: "card-1", price: 5000, status: "pending",
        listing: {
          id: "card-1", imageUrls: [], condition: "NM", forSale: true,
          owner: { id: "seller-1", username: "alice", email: "a@x.com" },
          pokemonCard: pokemonCatalog("Charizard"), riftboundCard: null,
        },
      },
      {
        id: "offer-2", listingId: "card-2", price: 3000, status: "expired",
        listing: {
          id: "card-2", imageUrls: [], condition: "LP", forSale: false,
          owner: { id: "seller-1", username: "alice", email: "a@x.com" },
          pokemonCard: pokemonCatalog("Blastoise"), riftboundCard: null,
        },
      },
    ]);

    const res = await GET(getRequest({ mine: "true" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.offers).toHaveLength(2);
    expect(data.offers[0].price).toBe(50);
    expect(data.offers[1].price).toBe(30);
    expect(data.offers[0].cardId).toBe("card-1");
    expect(data.offers[0].card.title).toBe("Charizard");
    expect(data.offers[1].card.title).toBe("Blastoise");
  });

  // ── Seller: received offers across all lifecycle states ──────────────────

  it("returns all lifecycle states (pending, expired, rejected, paid) for received=true", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "seller-1" } });
    mockPrisma.offer.findMany.mockResolvedValue([
      {
        id: "offer-1", listingId: "card-1", price: 5000, status: "pending", archivedAt: null,
        listing: { id: "card-1", imageUrls: [], condition: "NM", pokemonCard: pokemonCatalog("Charizard"), riftboundCard: null },
      },
      {
        id: "offer-2", listingId: "card-1", price: 3000, status: "expired", archivedAt: null,
        listing: { id: "card-1", imageUrls: [], condition: "NM", pokemonCard: pokemonCatalog("Charizard"), riftboundCard: null },
      },
      {
        id: "offer-3", listingId: "card-1", price: 4000, status: "rejected", archivedAt: null,
        listing: { id: "card-1", imageUrls: [], condition: "NM", pokemonCard: pokemonCatalog("Charizard"), riftboundCard: null },
      },
      {
        id: "offer-4", listingId: "card-2", price: 6000, status: "paid", archivedAt: new Date(),
        listing: { id: "card-2", imageUrls: [], condition: "LP", pokemonCard: pokemonCatalog("Blastoise"), riftboundCard: null },
      },
    ]);

    const res = await GET(getRequest({ received: "true" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.offers).toHaveLength(4);
    expect(data.offers[0].price).toBe(50);
    expect(data.offers[1].price).toBe(30);
    expect(data.offers[2].price).toBe(40);
    expect(data.offers[3].price).toBe(60);
    expect(data.offers[3].card.title).toBe("Blastoise");

    expect(mockPrisma.offer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sellerId: "seller-1",
          OR: expect.arrayContaining([
            { archivedAt: null },
            { status: { in: expect.arrayContaining(["paid", "accepted"]) } },
          ]),
        }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/api/offers/route.test.ts`
Expected: FAIL — the route still calls `prisma.card.findUnique`/`prisma.offer.findMany({where:{cardId}})` and returns raw offers with `listingId` never mapped back to `cardId`.

- [ ] **Step 3: Rewrite the route**

Replace the full contents of `src/app/api/offers/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { centsToDollars, dollarsToCents } from "@/lib/money";
import { notifyAsync } from "@/lib/notifications";
import { verifyPaymentIntentAmountOrRespond } from "@/lib/paymentIntentGuard";
import { listingCatalogInclude, withListingDisplay } from "@/lib/listingDisplay";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-02-24.acacia",
});

// How long (in hours) the seller has to respond before the offer expires
// and the buyer's authorised funds are released.
const OFFER_EXPIRY_HOURS = 24;

// The Offer model's card reference is `listingId` (renamed from `cardId`
// when Card became Listing), but the wire format this route has always used
// stays `cardId` — this rebuilds a raw offer row's price + card fields for
// the client without ever leaking the internal `listingId` name.
function serializeOffer(offer: any) {
  const { listingId, price, listing, ...rest } = offer;
  return {
    ...rest,
    cardId: listingId,
    price: price != null ? centsToDollars(price) : null,
    ...(listing ? { card: withListingDisplay(listing) } : {}),
  };
}

/**
 * GET /api/offers?cardId=X              — seller: all non-archived offers on their card
 * GET /api/offers?cardId=X&myOffer=true — viewer: their own offer on this card (or null)
 * GET /api/offers?mine=true             — buyer: full offer history
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;
  const { searchParams } = new URL(req.url);
  const cardId = searchParams.get("cardId");
  const myOffer = searchParams.get("myOffer") === "true";
  const mine = searchParams.get("mine") === "true";
  const received = searchParams.get("received") === "true";

  try {
    // ── Viewer: fetch their own offer on a specific card ──────────────────────
    if (cardId && myOffer) {
      const offer = await prisma.offer.findFirst({
        where: {
          listingId: cardId,
          buyerId: userId,
          status: { in: ["pending", "accepted", "rejected", "expired"] },
          archivedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({ offer: offer ? serializeOffer(offer) : null });
    }

    // ── Seller: all non-archived offers on their card ─────────────────────────
    if (cardId) {
      const listing = await prisma.listing.findUnique({
        where: { id: cardId },
        select: { ownerId: true },
      });
      if (!listing)
        return NextResponse.json({ error: "Card not found" }, { status: 404 });
      if (listing.ownerId !== userId)
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      const offers = await prisma.offer.findMany({
        where: { listingId: cardId, archivedAt: null },
        include: {
          buyer: { select: { id: true, username: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({ offers: offers.map(serializeOffer) });
    }

    // ── Buyer: their full offer history ───────────────────────────────────────
    if (mine) {
      const offers = await prisma.offer.findMany({
        where: { buyerId: userId },
        include: {
          listing: {
            select: {
              id: true,
              imageUrls: true,
              condition: true,
              forSale: true,
              owner: { select: { id: true, username: true, email: true } },
              ...listingCatalogInclude,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({ offers: offers.map(serializeOffer) });
    }

    // ── Seller: all incoming offers across all four lifecycle states ──────────
    // Returns pending (active), rejected, expired, and paid/accepted (history)
    // so the /offers page can split them into Active / Accepted / Declined / Expired
    // tabs on the frontend without a second request.
    //
    // Why the OR clause:
    //   - archivedAt: null  catches pending, rejected, and expired offers (the card
    //     is still owned by the seller or the offer just ended).
    //   - status paid/accepted catches accepted offers, which the accept flow also
    //     archives (step 5c archives ALL offers on the card, including the one
    //     just marked "paid" in step 5b). Without this second branch, accepted offers
    //     would be invisible to the seller entirely.
    //
    // Offers archived for other reasons (e.g. card sold via checkout before the
    // seller responded) stay out — they have archivedAt set and status "pending",
    // which matches neither branch.
    if (received) {
      const offers = await prisma.offer.findMany({
        where: {
          // Filter by the snapshotted seller id, not listing.ownerId.
          // After a sale, listing.ownerId flips to the buyer — sellerId stays fixed.
          sellerId: userId,
          OR: [
            { archivedAt: null },                              // pending, rejected, expired
            { status: { in: ["paid", "accepted"] } },         // accepted (archived by step 5c)
          ],
        },
        include: {
          listing: {
            select: { id: true, imageUrls: true, condition: true, ...listingCatalogInclude },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ offers: offers.map(serializeOffer) });
    }

    return NextResponse.json({ error: "Missing query param" }, { status: 400 });
  } catch (err) {
    console.error("[offers GET] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch offers" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/offers
 *
 * STEP 2 of placing an offer (step 1 is POST /api/offers/payment-intent).
 *
 * By this point:
 *   - The buyer has already created a Stripe PaymentIntent with capture_method:
 *     "manual" via POST /api/offers/payment-intent.
 *   - The buyer has confirmed their card details via stripe.confirmCardPayment()
 *     in the browser. The funds are now authorised (held) on their card.
 *   - The frontend sends us the resulting paymentIntentId so we can store it.
 *
 * This endpoint:
 *   1. Validates the offer data and card eligibility.
 *   2. Verifies the PaymentIntent in Stripe (must be "requires_capture" status,
 *      meaning it was successfully authorised and is waiting to be captured or
 *      cancelled).
 *   3. If the buyer already has a pending offer (amend case):
 *      - Cancels the OLD PaymentIntent (releases the old hold on their card).
 *      - Updates the existing offer record with the new price/message/PI.
 *   4. If this is a brand-new offer:
 *      - Creates a new offer record.
 *   5. Sets expiresAt = now + 24h on the offer.
 *      The cron job (/api/cron/expire-offers) will cancel the PI and mark
 *      the offer "expired" if the seller doesn't respond within 24h.
 *
 * Body: { cardId, price (cents), message?, paymentIntentId }
 */
export async function POST(req: NextRequest) {
  // ── 1. Auth check ──────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const buyerId = session.user.id;

  try {
    const { cardId, price, message, paymentIntentId } = await req.json();

    // ── 2. Validate inputs ──────────────────────────────────────────────────
    if (!cardId || price == null || Number(price) <= 0) {
      return NextResponse.json(
        { error: "Invalid offer data" },
        { status: 400 }
      );
    }
    // paymentIntentId is now required — it must come from the PI creation step.
    if (!paymentIntentId || typeof paymentIntentId !== "string") {
      return NextResponse.json(
        { error: "Missing paymentIntentId" },
        { status: 400 }
      );
    }

    // ── 3. Verify the card is still for sale ────────────────────────────────
    const listing = await prisma.listing.findUnique({
      where: { id: cardId },
      include: listingCatalogInclude,
    });
    if (!listing)
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    if (!listing.forSale)
      return NextResponse.json(
        { error: "Card is not for sale" },
        { status: 409 }
      );
    if (listing.ownerId === buyerId) {
      return NextResponse.json(
        { error: "Cannot offer on your own card" },
        { status: 400 }
      );
    }

    // Resolved once — used in both notification branches below (amend and new).
    const listingTitle = withListingDisplay(listing).title;

    // ── 4. Verify the PaymentIntent in Stripe ────────────────────────────────
    // We retrieve the PI from Stripe and confirm its status is "requires_capture".
    // This means stripe.confirmCardPayment() ran successfully in the browser and
    // the funds are authorised (held) but NOT charged yet.
    // We also confirm the PI belongs to this buyer and is for the right amount.
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (pi.status !== "requires_capture") {
      // The PI wasn't successfully authorised (e.g. card declined, wrong credentials).
      // Do NOT store the offer — there's nothing to capture.
      return NextResponse.json(
        {
          error: `Payment authorisation failed or was already used (status: ${pi.status})`,
        },
        { status: 409 }
      );
    }

    // Safety: ensure this PI was created for this buyer (metadata check).
    if (pi.metadata?.buyerId && pi.metadata.buyerId !== buyerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const priceInCents = dollarsToCents(Number(price));
    const cleanMessage = message?.trim() || null;

    // ── 4b. Verify the authorised amount matches the claimed offer price ────
    // Without this, a buyer could authorise a small PI via
    // POST /api/offers/payment-intent, then submit an arbitrarily larger
    // `price` here — the offer would be stored/shown to the seller at the
    // larger amount while Stripe only ever holds/captures the smaller one.
    const amountMismatch = await verifyPaymentIntentAmountOrRespond(
      stripe,
      paymentIntentId,
      pi.amount,
      priceInCents,
      "Offer"
    );
    if (amountMismatch) return amountMismatch;

    // ── 5. Check for existing live offer from this buyer ─────────────────────
    // A buyer can only have ONE active offer per card at a time.
    const existing = await prisma.offer.findFirst({
      where: {
        listingId: cardId,
        buyerId,
        // "accepted" offers are locked — the seller already chose this offer;
        // the buyer must wait for the capture or cancellation before offering again.
        status: { in: ["pending", "accepted"] },
        archivedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing?.status === "accepted") {
      // The seller already accepted a previous offer from this buyer.
      // With manual capture, the funds will be captured immediately when the
      // seller accepts — so if status is "accepted", the card is mid-transfer.
      return NextResponse.json(
        {
          error:
            "You have an accepted offer that is being processed.",
        },
        { status: 409 }
      );
    }

    // ── 6a. Amend: cancel the old PI and update the existing pending offer ───
    if (existing?.status === "pending") {
      // The buyer is changing their offer. Cancel the OLD PaymentIntent first
      // so the previous hold on their card is released. Then save the new PI.
      if (existing.paymentIntentId) {
        try {
          await stripe.paymentIntents.cancel(existing.paymentIntentId);
        } catch (cancelErr) {
          // Log but don't block — the old PI may already be cancelled/expired.
          console.warn(
            "[offers POST] Could not cancel old PI:",
            existing.paymentIntentId,
            cancelErr
          );
        }
      }

      const updated = await prisma.offer.update({
        where: { id: existing.id },
        data: {
          price: priceInCents,
          message: cleanMessage,
          // Replace old PI with the new one
          paymentIntentId,
          // Reset the 24h expiry window from now
          expiresAt: new Date(Date.now() + OFFER_EXPIRY_HOURS * 60 * 60 * 1000),
        },
      });

      // Notify the seller that the buyer revised their offer with a new price.
      // Fire-and-forget — never blocks the response.
      notifyAsync({
        userId:  listing.ownerId,
        type:    "offer_received",
        title:   `Offer updated on "${listingTitle}"`,
        body:    `A buyer updated their offer to S$${price} on "${listingTitle}". Head to your Offers page to respond.`,
        offerId: existing.id,
        cardId:  listing.id,
      });

      return NextResponse.json({
        offer: serializeOffer(updated),
        amended: true,
      });
    }

    // ── 6b. New offer ─────────────────────────────────────────────────────────
    const offer = await prisma.offer.create({
      data: {
        listingId: cardId,
        buyerId,
        // Snapshot the current card owner as the seller. We can't rely on
        // listing.ownerId later because it changes when the card is transferred.
        sellerId: listing.ownerId,
        price: priceInCents,
        message: cleanMessage,
        status: "pending",
        paymentIntentId,
        // Seller has 24h to respond. After expiresAt the cron job will:
        //   1. Cancel the PaymentIntent (release the hold on buyer's card)
        //   2. Mark this offer status → "expired"
        expiresAt: new Date(Date.now() + OFFER_EXPIRY_HOURS * 60 * 60 * 1000),
      },
    });

    // Notify the seller — fire-and-forget, never blocks the response.
    notifyAsync({
      userId:  listing.ownerId,
      type:    "offer_received",
      title:   `New offer on "${listingTitle}"`,
      body:    `You received an offer of S$${price} on your card "${listingTitle}". Head to your Offers page to respond.`,
      offerId: offer.id,
      cardId:  listing.id,
    });

    return NextResponse.json(
      { offer: serializeOffer(offer), amended: false },
      { status: 201 }
    );
  } catch (err) {
    console.error("[offers POST] error:", err);
    return NextResponse.json(
      { error: "Failed to place offer" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/api/offers/route.test.ts`
Expected: PASS (18 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/offers/route.ts src/__tests__/api/offers/route.test.ts
git commit -m "fix: rewire GET/POST /api/offers onto Listing + catalog tables"
```

---

### Task 2: `src/app/api/offers/[id]/route.ts` — PATCH (seller accept/reject)

**Files:**
- Modify: `src/app/api/offers/[id]/route.ts`
- Modify: `src/__tests__/api/offers/patch-offer.test.ts`

**Interfaces:**
- Consumes: `listingCatalogInclude`, `withListingDisplay` from `@/lib/listingDisplay` — the accept/reject flow never displays card identity to the client, but it does need the listing's `title` (for notification copy) and `tcgPlayerId` (for the `CardTransaction` audit record), both of which moved off `Listing` onto the catalog tables. `notifyAsync`'s `cardId` param is unchanged (fixed in Plan 2b's Task 1).

Money-movement logic (PI capture, the atomic DB transaction, the refund safety net) is renamed but must not change behaviorally — this is the highest-stakes file in this plan.

- [ ] **Step 1: Update the failing test**

Replace the full contents of `src/__tests__/api/offers/patch-offer.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * HOW THIS FILE EXECUTES (what Vitest does before a single test runs)
 *
 * 1. vi.hoisted() blocks run first — creates five mock objects in memory:
 *      mockStripeInstance   — fake Stripe client (paymentIntents.capture, cancel)
 *      mockTx               — fake Prisma transaction client (used inside $transaction)
 *      mockPrisma           — fake Prisma client (offer.findUnique, $transaction)
 *      mockGetServerSession — fake auth function
 *      mockExpireOffer      — fake expireOffer function (on-demand expiry guard)
 *
 * 2. vi.mock() factories run second — registers the fakes.
 *
 * 3. import { PATCH } runs last — the real handler is loaded with fakes in place.
 *
 * The Offer model's card reference is `listingId` (renamed from `cardId`);
 * the Card model itself is `Listing` (renamed). This route never returns an
 * offer object to the client (only { success: true }), so there's no
 * cardId/listingId wire-format concern here — only internal Prisma renames.
 */

// ── STEP 1: Create the mock objects ──────────────────────────────────────────

const mockStripeInstance = vi.hoisted(() => ({
  paymentIntents: {
    capture: vi.fn(), // accept: captures the held funds → actual charge
    cancel: vi.fn(),  // reject: releases the hold → no charge
  },
  refunds: {
    create: vi.fn(), // accept: compensating refund if the DB tx fails after capture
  },
}));

// mockTx is the fake Prisma client passed into the $transaction callback.
const mockTx = vi.hoisted(() => ({
  order: { create: vi.fn() },
  offer: { update: vi.fn(), updateMany: vi.fn() },
  listing: { update: vi.fn() },
  cardTransaction: { create: vi.fn() },
}));

const mockPrisma = vi.hoisted(() => ({
  listing: { findUnique: vi.fn() }, // used by the Buy Now reservation guard (step 3)
  offer: { findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

const mockExpireOffer = vi.hoisted(() => vi.fn());

// ── STEP 2: Register the fakes ────────────────────────────────────────────────

vi.mock("stripe", () => ({ default: vi.fn(() => mockStripeInstance) }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/offerExpiry", () => ({ expireOffer: mockExpireOffer }));
vi.mock("@/lib/notifications", () => ({ notifyAsync: vi.fn(), createNotification: vi.fn() }));

// ── STEP 3: Import the code under test ───────────────────────────────────────

import { PATCH } from "@/app/api/offers/[id]/route";

// ── Test helpers + shared data ────────────────────────────────────────────────

function patchRequest(body: object) {
  return new NextRequest("http://localhost/api/offers/offer-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// A valid pending offer: status is pending, not archived, not expired, has a PI
const PENDING_OFFER = {
  id: "offer-1",
  status: "pending",
  buyerId: "buyer-1",
  paymentIntentId: "pi_123",
  price: 5000, // S$50.00 in cents
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h from now (not expired)
  archivedAt: null,
  listing: {
    id: "card-1", ownerId: "seller-1",
    pokemonCard: {
      nameEn: "Charizard", rarity: "Rare Holo", setNameEn: "Base Set",
      language: "English", localId: "4/102", tcgPlayerId: "xy1-4",
    },
    riftboundCard: null,
  },
};

const MOCK_ORDER = { id: "order-1" };

// ═════════════════════════════════════════════════════════════════════════════
// PATCH /api/offers/[id] — ACCEPT
// ═════════════════════════════════════════════════════════════════════════════
describe("PATCH /api/offers/[id] — accept", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: "seller-1" } });
    mockPrisma.offer.findUnique.mockResolvedValue(PENDING_OFFER);
    mockPrisma.listing.findUnique.mockResolvedValue({ reservedById: null, reservedUntil: null, inAuction: false });
    mockStripeInstance.paymentIntents.capture.mockResolvedValue({
      id: "pi_123",
      status: "succeeded",
    });
    mockStripeInstance.refunds.create.mockResolvedValue({ id: "re_123" });

    mockPrisma.$transaction.mockImplementation(async (fn) => {
      mockTx.order.create.mockResolvedValue(MOCK_ORDER);
      mockTx.offer.update.mockResolvedValue({});
      mockTx.offer.updateMany.mockResolvedValue({ count: 1 });
      mockTx.listing.update.mockResolvedValue({});
      mockTx.cardTransaction.create.mockResolvedValue({});
      return fn(mockTx);
    });
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it("captures PI, creates order (PAID), archives all offers, transfers card, creates transaction record", async () => {
    const res = await PATCH(patchRequest({ action: "accept" }), { params: { id: "offer-1" } });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);

    // 1. Stripe PI captured — funds move from hold to actual charge
    expect(mockStripeInstance.paymentIntents.capture).toHaveBeenCalledWith("pi_123");

    // 2. Order created with PAID status and all sale details, against the
    //    renamed listingId column.
    expect(mockTx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          listingId: "card-1",
          sellerId: "seller-1",
          buyerId: "buyer-1",
          amount: 5000,
          status: "PAID",
          stripePaymentIntentId: "pi_123",
        }),
      })
    );

    // 3. Offer marked paid and linked to the order (for transaction history)
    expect(mockTx.offer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "offer-1" },
        data: expect.objectContaining({ status: "paid", orderId: "order-1" }),
      })
    );

    // 4. ALL offers on the listing archived
    expect(mockTx.offer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { listingId: "card-1", archivedAt: null },
        data: { archivedAt: expect.any(Date) },
      })
    );

    // 5. Card ownership transferred: buyer becomes the new owner, card unlisted
    expect(mockTx.listing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "card-1" },
        data: expect.objectContaining({
          ownerId: "buyer-1",
          forSale: false,
          price: null,
          reservedById: null,
          reservedUntil: null,
          reservedCheckoutSessionId: null,
        }),
      })
    );

    // 6. CardTransaction audit record created against the renamed listingId
    //    column, with tcgPlayerId resolved from the listing's catalog relation
    //    (no longer a flat column, and no longer a second nested query).
    expect(mockTx.cardTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: "order-1",
          listingId: "card-1",
          sellerId: "seller-1",
          buyerId: "buyer-1",
          amount: 5000,
          currency: "sgd",
          stripeEventId: "pi_123",
          tcgPlayerId: "xy1-4",
        }),
      })
    );
  });

  // ── Refund safety net ─────────────────────────────────────────────────────

  it("refunds the buyer if the DB transaction fails after PI capture", async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error("DB exploded"));

    const res = await PATCH(patchRequest({ action: "accept" }), { params: { id: "offer-1" } });

    expect(res.status).toBe(500);
    expect(mockStripeInstance.paymentIntents.capture).toHaveBeenCalledWith("pi_123");
    expect(mockStripeInstance.refunds.create).toHaveBeenCalledWith({ payment_intent: "pi_123" });
  });

  it("still returns 500 (not a crash) if the compensating refund itself fails", async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error("DB exploded"));
    mockStripeInstance.refunds.create.mockRejectedValue(new Error("refund also failed"));

    const res = await PATCH(patchRequest({ action: "accept" }), { params: { id: "offer-1" } });

    expect(res.status).toBe(500);
    expect(mockStripeInstance.refunds.create).toHaveBeenCalled();
  });

  // ── Auth / ownership ──────────────────────────────────────────────────────

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await PATCH(patchRequest({ action: "accept" }), { params: { id: "offer-1" } });
    expect(res.status).toBe(401);
  });

  it("returns 403 when a non-owner tries to accept", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "buyer-1" } });
    const res = await PATCH(patchRequest({ action: "accept" }), { params: { id: "offer-1" } });
    expect(res.status).toBe(403);
  });

  it("returns 404 when offer does not exist", async () => {
    mockPrisma.offer.findUnique.mockResolvedValue(null);
    const res = await PATCH(patchRequest({ action: "accept" }), { params: { id: "offer-x" } });
    expect(res.status).toBe(404);
  });

  it("returns 400 when action is not accept or reject", async () => {
    const res = await PATCH(patchRequest({ action: "delete" }), { params: { id: "offer-1" } });
    expect(res.status).toBe(400);
  });

  // ── Terminal states ───────────────────────────────────────────────────────

  it("returns 409 when offer is archived (already sold)", async () => {
    mockPrisma.offer.findUnique.mockResolvedValue({ ...PENDING_OFFER, archivedAt: new Date() });
    const res = await PATCH(patchRequest({ action: "accept" }), { params: { id: "offer-1" } });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "Offer is archived" });
  });

  it("returns 409 when offer is already rejected (not pending)", async () => {
    mockPrisma.offer.findUnique.mockResolvedValue({ ...PENDING_OFFER, status: "rejected" });
    const res = await PATCH(patchRequest({ action: "accept" }), { params: { id: "offer-1" } });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "Offer is not pending" });
  });

  it("returns 409 when offer is already paid", async () => {
    mockPrisma.offer.findUnique.mockResolvedValue({ ...PENDING_OFFER, status: "paid" });
    const res = await PATCH(patchRequest({ action: "accept" }), { params: { id: "offer-1" } });
    expect(res.status).toBe(409);
  });

  it("returns 409 when offer has no paymentIntentId", async () => {
    mockPrisma.offer.findUnique.mockResolvedValue({ ...PENDING_OFFER, paymentIntentId: null });
    const res = await PATCH(patchRequest({ action: "accept" }), { params: { id: "offer-1" } });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "No payment intent found for this offer" });
  });

  // ── Buy Now reservation guard ─────────────────────────────────────────────

  it("returns 409 when card is actively reserved by a Buy Now checkout", async () => {
    mockPrisma.listing.findUnique.mockResolvedValue({
      reservedById: "other-buyer",
      reservedUntil: new Date(Date.now() + 60_000),
    });

    const res = await PATCH(patchRequest({ action: "accept" }), { params: { id: "offer-1" } });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "Card is currently reserved by a pending checkout" });

    expect(mockStripeInstance.paymentIntents.capture).not.toHaveBeenCalled();
  });

  // ── Auction guard ──────────────────────────────────────────────────────────

  it("returns 409 when the card is currently in an active auction", async () => {
    mockPrisma.listing.findUnique.mockResolvedValue({
      reservedById: null,
      reservedUntil: null,
      inAuction: true,
    });

    const res = await PATCH(patchRequest({ action: "accept" }), { params: { id: "offer-1" } });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "Card is currently in an active auction" });

    expect(mockStripeInstance.paymentIntents.capture).not.toHaveBeenCalled();
  });

  // ── On-demand expiry guard ─────────────────────────────────────────────────

  it("expires the offer immediately if expiresAt is in the past (cron hasn't run yet)", async () => {
    mockPrisma.offer.findUnique.mockResolvedValue({
      ...PENDING_OFFER,
      expiresAt: new Date(Date.now() - 60_000),
    });
    mockExpireOffer.mockResolvedValue(undefined);

    const res = await PATCH(patchRequest({ action: "accept" }), { params: { id: "offer-1" } });
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toBe("This offer has expired");

    expect(mockExpireOffer).toHaveBeenCalledWith({
      id: "offer-1",
      paymentIntentId: "pi_123",
    });

    expect(mockStripeInstance.paymentIntents.capture).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PATCH /api/offers/[id] — REJECT
// ═════════════════════════════════════════════════════════════════════════════
describe("PATCH /api/offers/[id] — reject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: "seller-1" } });
    mockPrisma.offer.findUnique.mockResolvedValue(PENDING_OFFER);
    mockStripeInstance.paymentIntents.cancel.mockResolvedValue({});
    mockPrisma.offer.update.mockResolvedValue({ ...PENDING_OFFER, status: "rejected" });
  });

  it("cancels the PI and marks the offer rejected", async () => {
    const res = await PATCH(patchRequest({ action: "reject" }), { params: { id: "offer-1" } });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);

    expect(mockStripeInstance.paymentIntents.cancel).toHaveBeenCalledWith("pi_123");

    expect(mockPrisma.offer.update).toHaveBeenCalledWith({
      where: { id: "offer-1" },
      data: { status: "rejected" },
    });
  });

  it("still marks offer rejected even if PI cancel fails (PI may already be cancelled)", async () => {
    mockStripeInstance.paymentIntents.cancel.mockRejectedValue(new Error("already cancelled"));

    const res = await PATCH(patchRequest({ action: "reject" }), { params: { id: "offer-1" } });

    expect(res.status).toBe(200);
    expect(mockPrisma.offer.update).toHaveBeenCalledWith({
      where: { id: "offer-1" },
      data: { status: "rejected" },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/api/offers/patch-offer.test.ts`
Expected: FAIL — the route still calls `prisma.card.findUnique`/`tx.card.update` and reads `offer.card`.

- [ ] **Step 3: Rewrite the route**

Replace the full contents of `src/app/api/offers/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expireOffer } from "@/lib/offerExpiry";
import { notifyAsync } from "@/lib/notifications";
import { listingCatalogInclude, withListingDisplay } from "@/lib/listingDisplay";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-02-24.acacia",
});

/**
 * PATCH /api/offers/[id]
 * Seller accepts or rejects a pending offer.
 * Body: { action: "accept" | "reject" }
 *
 * ── Accept flow ────────────────────────────────────────────────────────────
 *   1. Retrieve the offer + its PaymentIntent ID.
 *   2. Capture the PaymentIntent via Stripe API.
 *      → Money moves from buyer to Stripe. No further action needed by buyer.
 *   3. Inside a DB transaction (atomic — all succeed or all roll back):
 *      a. Mark offer status → "accepted" (briefly, then "paid" below)
 *      b. Transfer card ownership to the buyer (ownerId = buyerId)
 *      c. Mark card as no longer for sale (forSale = false)
 *      d. Archive ALL offers on this card (new owner shouldn't see old offers)
 *      e. Create a CardTransaction record to preserve the sale history
 *   4. Update the offer status → "paid" and link to the Order (outside the
 *      main tx, after capture succeeds).
 *
 *   Why capture then transfer in one go?
 *   In the old flow, accept → buyer waits → buyer pays separately → webhook
 *   triggers transfer. With manual capture, the accept IS the payment — we
 *   capture and transfer atomically so there's no window where money moved
 *   but the card wasn't transferred (or vice versa).
 *
 * ── Reject flow ────────────────────────────────────────────────────────────
 *   1. Cancel the PaymentIntent via Stripe API.
 *      → Stripe releases the hold on the buyer's card. They are not charged.
 *   2. Mark offer status → "rejected".
 */
export async function PATCH(
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

    // ── 2. Load the offer and its listing ──────────────────────────────────
    const offer = await prisma.offer.findUnique({
      where: { id: params.id },
      include: {
        listing: { include: { ...listingCatalogInclude } },
      },
    });

    if (!offer)
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });

    // Only the card owner (seller) can accept or reject — prevent other users
    // from acting on offers that aren't on their card.
    if (offer.listing.ownerId !== userId)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Archived offers belong to a card that has already been sold — they are
    // read-only history at this point.
    if (offer.archivedAt)
      return NextResponse.json({ error: "Offer is archived" }, { status: 409 });

    // Only pending offers can be acted on. Accepted/rejected/paid/expired are
    // terminal states (or mid-processing).
    if (offer.status !== "pending") {
      return NextResponse.json(
        { error: "Offer is not pending" },
        { status: 409 }
      );
    }

    // On-demand expiry guard — catches the window between expiresAt passing
    // and the cron job running. If the seller tries to accept/reject an offer
    // that has already passed its deadline (but is still "pending" in the DB
    // because the cron hasn't fired yet), we expire it right now — same two
    // steps as the cron: cancel the Stripe PI, then mark status → "expired".
    if (offer.expiresAt && offer.expiresAt < new Date()) {
      await expireOffer({
        id: offer.id,
        paymentIntentId: offer.paymentIntentId,
      });
      return NextResponse.json(
        { error: "This offer has expired" },
        { status: 409 }
      );
    }

    // The offer must have a PaymentIntent — it was created when the buyer
    // submitted the offer form. If it's missing, something went wrong upstream.
    if (!offer.paymentIntentId) {
      return NextResponse.json(
        { error: "No payment intent found for this offer" },
        { status: 409 }
      );
    }

    const listingId = offer.listing.id;
    const listingTitle = withListingDisplay(offer.listing).title;
    // withListingDisplay's tcgPlayerId falls back to "" (never null/undefined)
    // for a listing whose catalog row has none — the `|| undefined` here keeps
    // that as a real NULL in CardTransaction.tcgPlayerId rather than storing
    // "", which would otherwise pass the `IS NOT NULL` filter in the
    // "highest transacted" query (GET /api/home/featured) as a phantom
    // product with an empty id.
    const listingTcgPlayerId = withListingDisplay(offer.listing).tcgPlayerId || undefined;

    // ══════════════════════════════════════════════════════════════════════════
    // ACCEPT
    // ══════════════════════════════════════════════════════════════════════════
    if (action === "accept") {
      // ── 3. Guard: check card is not reserved by an active Buy Now checkout ──
      // Must run BEFORE capturing the PI. The checkout flow sets reservedById +
      // reservedUntil but leaves forSale: true until the webhook fires. If we
      // captured the PI first and then found the card was reserved, money would
      // have already moved with no way to roll it back cleanly.
      const currentListing = await prisma.listing.findUnique({
        where: { id: listingId },
        select: { reservedById: true, reservedUntil: true, inAuction: true },
      });
      if (
        currentListing?.reservedById &&
        currentListing.reservedUntil &&
        currentListing.reservedUntil > new Date()
      ) {
        return NextResponse.json(
          { error: "Card is currently reserved by a pending checkout" },
          { status: 409 }
        );
      }

      // ── 3b. Guard: check card is not in an active auction ────────────────
      // A card mid-auction must not also be sellable via an accepted offer —
      // settleAuction() transfers ownership unconditionally when the auction
      // ends, which would silently overwrite this accept's transfer.
      if (currentListing?.inAuction) {
        return NextResponse.json(
          { error: "Card is currently in an active auction" },
          { status: 409 }
        );
      }

      // ── 4. Capture the PaymentIntent ──────────────────────────────────────
      // This is the moment money moves. Stripe will charge the buyer's card
      // for the amount that was authorised when they placed the offer.
      // If capture fails (e.g. card issuer declined at capture time), we catch
      // the error and return 500 — the offer stays "pending" and the seller can
      // try again or the buyer can re-place the offer.
      const captured = await stripe.paymentIntents.capture(
        offer.paymentIntentId
      );

      // The PI should now be "succeeded" — just for logging/debugging.
      console.log(
        `[offers PATCH] PI captured: ${captured.id} → ${captured.status}`
      );

      // ── 5. Atomic DB transaction ───────────────────────────────────────────
      // Everything below must either all succeed or all roll back.
      // We cannot have money captured but the card not transferred.
      let order: { id: string };
      try {
        const result = await prisma.$transaction(async (tx) => {
          // 5a. Create an Order record to represent this sale.
          //     This links the offer, buyer, seller, and amount for history/display.
          const order = await tx.order.create({
            data: {
              listingId,
              sellerId: userId, // seller = card owner = current user
              buyerId: offer.buyerId,
              amount: offer.price!, // already in cents
              currency: "sgd",
              status: "PAID",
              stripePaymentIntentId: offer.paymentIntentId,
            },
          });

          // 5b. Mark the offer as paid and link it to the Order.
          //     "paid" is the final happy-path status — the buyer got the card.
          await tx.offer.update({
            where: { id: params.id },
            data: {
              status: "paid",
              orderId: order.id,
            },
          });

          // 5c. Archive ALL offers on this card (pending, rejected, expired, etc.)
          //     The card is now sold — neither the new owner nor old buyers should
          //     see these in their active views. History is preserved via archivedAt.
          await tx.offer.updateMany({
            where: { listingId, archivedAt: null },
            data: { archivedAt: new Date() },
          });

          // 5d. Transfer card ownership to the buyer.
          //     - ownerId changes to the buyer
          //     - forSale = false (card is sold, shouldn't appear in marketplace)
          //     - price = null (listing price is cleared — card has a new owner)
          //     - Clear any reservation fields (no longer needed)
          await tx.listing.update({
            where: { id: listingId },
            data: {
              ownerId: offer.buyerId,
              forSale: false,
              price: null,
              reservedById: null,
              reservedUntil: null,
              reservedCheckoutSessionId: null,
            },
          });

          // 5e. Create a CardTransaction — permanent audit trail of who sold what,
          //     for how much, and which Stripe PI was used.
          //     (stripeEventId uses the PI id since there's no webhook event here)
          await tx.cardTransaction.create({
            data: {
              orderId: order.id,
              listingId,
              sellerId: userId,
              buyerId: offer.buyerId,
              amount: offer.price!,
              currency: "sgd",
              // Use the PI id as a unique key — there's one PI per offer,
              // so this prevents duplicate transaction records if PATCH is retried.
              stripeEventId: offer.paymentIntentId!,
              tcgPlayerId: listingTcgPlayerId,
            },
          });

          return { order };
        });
        order = result.order;
      } catch (txErr) {
        // DB failed AFTER the PI was captured — refund the buyer so they're
        // not charged for a card that never transferred. Mirrors the same
        // safety net in lib/auctionSettlement.ts's settleAuction().
        console.error(
          "[offers PATCH] DB transaction failed after capture, issuing refund:",
          txErr
        );
        try {
          await stripe.refunds.create({ payment_intent: offer.paymentIntentId! });
        } catch (refundErr) {
          console.error(
            "[offers PATCH] Refund also failed — manual intervention required:",
            refundErr
          );
        }
        throw txErr;
      }

      console.log(
        `[offers PATCH] Card ${listingId} transferred to buyer ${offer.buyerId}. Order: ${order.id}`
      );

      // Notify the buyer — fire-and-forget.
      notifyAsync({
        userId:  offer.buyerId,
        type:    "offer_accepted",
        title:   `Your offer on "${listingTitle}" was accepted`,
        body:    `Great news! The seller accepted your offer. "${listingTitle}" is now yours.`,
        offerId: params.id,
        cardId:  listingId,
        orderId: order.id,
      });

      return NextResponse.json({ success: true });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // REJECT
    // ══════════════════════════════════════════════════════════════════════════

    // ── 5. Cancel the PaymentIntent ───────────────────────────────────────────
    // This releases the hold on the buyer's card. No money moves.
    try {
      await stripe.paymentIntents.cancel(offer.paymentIntentId);
      console.log(`[offers PATCH] PI cancelled: ${offer.paymentIntentId}`);
    } catch (cancelErr) {
      // If the PI was already cancelled (e.g. expired, duplicate reject call),
      // log and continue — we still want to update our DB status.
      console.warn(
        "[offers PATCH] Could not cancel PI (may already be cancelled):",
        offer.paymentIntentId,
        cancelErr
      );
    }

    // ── 6. Mark the offer as rejected in the DB ───────────────────────────────
    await prisma.offer.update({
      where: { id: params.id },
      data: { status: "rejected" },
    });

    // Notify the buyer — fire-and-forget.
    notifyAsync({
      userId:  offer.buyerId,
      type:    "offer_rejected",
      title:   `Your offer on "${listingTitle}" was declined`,
      body:    `The seller declined your offer on "${listingTitle}". Your payment hold has been released.`,
      offerId: params.id,
      cardId:  listingId,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[offers PATCH] error:", err);
    return NextResponse.json(
      { error: "Failed to update offer" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/api/offers/patch-offer.test.ts`
Expected: PASS (16 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/offers/[id]/route.ts src/__tests__/api/offers/patch-offer.test.ts
git commit -m "fix: rewire PATCH /api/offers/[id] onto Listing + catalog tables"
```

---

### Task 3: `src/app/api/offers/payment-intent/route.ts` — POST (create PI)

**Files:**
- Modify: `src/app/api/offers/payment-intent/route.ts`
- Modify: `src/__tests__/api/offers/payment-intent.test.ts`

**Interfaces:**
- Consumes: `listingCatalogInclude`, `withListingDisplay` from `@/lib/listingDisplay` — needed to resolve the listing's title for the Stripe PI's `metadata.cardTitle` (informational only, not used for any authorization logic).

- [ ] **Step 1: Update the failing test**

Replace the full contents of `src/__tests__/api/offers/payment-intent.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * POST /api/offers/payment-intent
 *
 * The buyer's frontend calls this BEFORE submitting an offer. Creates a
 * Stripe PaymentIntent with capture_method: "manual" — Stripe authorises
 * (holds) the funds on the buyer's card but does NOT charge them yet.
 */

// ── STEP 1: Create the mock objects ──────────────────────────────────────────

const mockStripeInstance = vi.hoisted(() => ({
  paymentIntents: { create: vi.fn() },
}));

const mockPrisma = vi.hoisted(() => ({
  listing: { findUnique: vi.fn() },
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

// ── STEP 2: Register the fakes ────────────────────────────────────────────────

vi.mock("stripe", () => ({ default: vi.fn(() => mockStripeInstance) }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

// ── STEP 3: Import the code under test ───────────────────────────────────────

import { POST } from "@/app/api/offers/payment-intent/route";

// ── Test helpers + shared data ────────────────────────────────────────────────

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/offers/payment-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const LISTING = {
  id: "card-1",
  forSale: true,
  ownerId: "seller-1",
  pokemonCard: {
    nameEn: "Charizard", rarity: "Rare Holo", setNameEn: "Base Set",
    language: "English", localId: "4/102", tcgPlayerId: "tcg-1",
  },
  riftboundCard: null,
};

describe("POST /api/offers/payment-intent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: "buyer-1" } });
    mockPrisma.listing.findUnique.mockResolvedValue(LISTING);
    mockStripeInstance.paymentIntents.create.mockResolvedValue({
      id: "pi_123",
      client_secret: "pi_123_secret_abc",
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(makeRequest({ cardId: "card-1", price: 5000 }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when cardId is missing", async () => {
    const res = await POST(makeRequest({ price: 5000 }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("cardId") });
  });

  it("returns 400 when price is zero", async () => {
    const res = await POST(makeRequest({ cardId: "card-1", price: 0 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when price is negative", async () => {
    const res = await POST(makeRequest({ cardId: "card-1", price: -1 }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when card does not exist", async () => {
    mockPrisma.listing.findUnique.mockResolvedValue(null);
    const res = await POST(makeRequest({ cardId: "card-x", price: 5000 }));
    expect(res.status).toBe(404);
  });

  it("returns 409 when card is not for sale", async () => {
    mockPrisma.listing.findUnique.mockResolvedValue({ ...LISTING, forSale: false });
    const res = await POST(makeRequest({ cardId: "card-1", price: 5000 }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "Card is not for sale" });
  });

  it("returns 403 when buyer tries to offer on their own card", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "seller-1" } });
    const res = await POST(makeRequest({ cardId: "card-1", price: 5000 }));
    expect(res.status).toBe(403);
  });

  it("creates a manual-capture PaymentIntent with the resolved card title and returns clientSecret + paymentIntentId", async () => {
    const res = await POST(makeRequest({ cardId: "card-1", price: 5000 }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.clientSecret).toBe("pi_123_secret_abc");
    expect(data.paymentIntentId).toBe("pi_123");

    expect(mockStripeInstance.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 5000,
        currency: "sgd",
        capture_method: "manual",
        metadata: expect.objectContaining({
          buyerId: "buyer-1",
          cardId: "card-1",
          cardTitle: "Charizard",
        }),
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/api/offers/payment-intent.test.ts`
Expected: FAIL — the route still calls `prisma.card.findUnique` and reads `card.title` directly.

- [ ] **Step 3: Rewrite the route**

Replace the full contents of `src/app/api/offers/payment-intent/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listingCatalogInclude, withListingDisplay } from "@/lib/listingDisplay";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-02-24.acacia",
});

/**
 * POST /api/offers/payment-intent
 *
 * STEP 1 of placing an offer:
 * The buyer fills in their price + message AND provides their card details via
 * Stripe Elements. Before we even store the offer in our DB, we need a
 * PaymentIntent from Stripe so the buyer's card can be authorised (funds held).
 *
 * Flow:
 *   1. Buyer fills in offer form (price, message) + Stripe CardElement
 *   2. Frontend calls this endpoint → we create a PaymentIntent with
 *      capture_method: "manual" → Stripe returns a clientSecret
 *   3. Frontend uses the clientSecret to call stripe.confirmCardPayment()
 *      → Stripe authorises (holds) the funds on the buyer's card
 *   4. Frontend then calls POST /api/offers with { cardId, price, message, paymentIntentId }
 *      → we save the offer in the DB, linked to this PaymentIntent
 *
 * Why manual capture?
 *   - Stripe "authorises" the charge immediately (funds are held / ring-fenced)
 *     but does NOT move money yet.
 *   - If the seller accepts → we call stripe.paymentIntents.capture() → money moves.
 *   - If the seller rejects or the offer expires → we call stripe.paymentIntents.cancel()
 *     → funds are released back to the buyer with no charge.
 *
 * Body: { cardId: string, price: number }   (price in cents)
 */
export async function POST(req: NextRequest) {
  // ── 1. Auth check ──────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const buyerId = session.user.id;

  try {
    const { cardId, price } = await req.json();

    // ── 2. Validate inputs ──────────────────────────────────────────────────
    if (!cardId || typeof price !== "number" || price <= 0) {
      return NextResponse.json(
        { error: "Missing or invalid cardId / price" },
        { status: 400 }
      );
    }

    // ── 3. Verify the card exists and is still for sale ─────────────────────
    // We check this early so we don't create a dangling PaymentIntent for a
    // card the buyer can't actually buy.
    const listing = await prisma.listing.findUnique({
      where: { id: cardId },
      include: listingCatalogInclude,
    });

    if (!listing) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
    if (!listing.forSale) {
      return NextResponse.json(
        { error: "Card is not for sale" },
        { status: 409 }
      );
    }
    // Prevent the card owner from placing an offer on their own card
    if (listing.ownerId === buyerId) {
      return NextResponse.json(
        { error: "You cannot place an offer on your own card" },
        { status: 403 }
      );
    }

    // ── 4. Create the Stripe PaymentIntent with capture_method: "manual" ────
    // This authorises the buyer's card without charging it.
    // The `amount` must be in the smallest currency unit (cents for SGD).
    // `currency` must be lowercase.
    const paymentIntent = await stripe.paymentIntents.create({
      amount: price,          // already in cents (the frontend sends cents)
      currency: "sgd",
      capture_method: "manual", // <── KEY: authorise now, charge only on accept
      metadata: {
        // Store context so we can trace this PI back to the offer later.
        // Note: these are informational — the authoritative link is
        // Offer.paymentIntentId in our DB.
        buyerId,
        cardId,
        cardTitle: withListingDisplay(listing).title,
      },
    });

    // ── 5. Return the clientSecret to the frontend ──────────────────────────
    // The frontend passes this to stripe.confirmCardPayment(clientSecret, {
    //   payment_method: { card: cardElement }
    // }) to collect and authorise the buyer's card details.
    // After confirmation, the PI status moves from "requires_payment_method"
    // → "requires_capture", meaning funds are held.
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error("[offers/payment-intent] error:", err);
    return NextResponse.json(
      { error: "Failed to create payment intent" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/api/offers/payment-intent.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/offers/payment-intent/route.ts src/__tests__/api/offers/payment-intent.test.ts
git commit -m "fix: rewire POST /api/offers/payment-intent onto Listing + catalog tables"
```

---

### Task 4: `src/app/api/cron/expire-offers/route.ts` — GET/POST cron

**Files:**
- Modify: `src/app/api/cron/expire-offers/route.ts`
- Modify: `src/__tests__/api/cron/expire-offers.test.ts`

**Interfaces:** None — `expireOffer()` (from `@/lib/offerExpiry`, unmodified) only reads `id`/`paymentIntentId` off the offer objects this route passes it; the `cardId: true` field in this route's `select` is otherwise unused dead weight already, but selecting a field that no longer exists on the model throws a Prisma validation error at query time, so it must still be renamed to `listingId: true`.

- [ ] **Step 1: Update the failing test**

Replace the full contents of `src/__tests__/api/cron/expire-offers.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * GET /api/cron/expire-offers is called by Vercel's cron scheduler every
 * 5 minutes. It:
 *   1. Verifies the bearer token matches CRON_SECRET (set in Vercel env vars)
 *   2. Queries for offers with status:"pending" and expiresAt in the past
 *   3. Calls expireOffer() for each one (cancel PI + mark DB expired)
 *   4. Returns a summary: { expired, failed, errors }
 *
 * expireOffer is mocked here (its internals are covered in offerExpiry.test.ts) —
 * this file only verifies the cron queries the right offers and calls
 * expireOffer correctly for each one.
 */

// ── STEP 1: Create the mock objects ──────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  offer: { findMany: vi.fn() },
}));

const mockExpireOffer = vi.hoisted(() => vi.fn());

// ── STEP 2: Register the fakes ────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/offerExpiry", () => ({ expireOffer: mockExpireOffer }));

// ── STEP 3: Import the code under test ───────────────────────────────────────

import { GET, POST } from "@/app/api/cron/expire-offers/route";

// ── Test helpers + shared data ────────────────────────────────────────────────

function makeRequest(authToken?: string) {
  return new NextRequest("http://localhost/api/cron/expire-offers", {
    headers: authToken ? { authorization: `Bearer ${authToken}` } : {},
  });
}

// Each expired offer's card reference is now `listingId` (renamed from `cardId`).
const EXPIRED_OFFER_1 = { id: "offer-1", paymentIntentId: "pi_1", buyerId: "buyer-1", listingId: "card-1" };
const EXPIRED_OFFER_2 = { id: "offer-2", paymentIntentId: "pi_2", buyerId: "buyer-2", listingId: "card-2" };

describe("GET /api/cron/expire-offers (Vercel Cron)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExpireOffer.mockResolvedValue(undefined);
  });

  it("returns 401 when bearer token is wrong", async () => {
    const res = await GET(makeRequest("wrong-secret"));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "Unauthorized" });
  });

  it("returns 401 when Authorization header is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns expired:0 and a message when no offers have passed their deadline", async () => {
    mockPrisma.offer.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest("test-cron-secret"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.expired).toBe(0);
    expect(data.message).toBe("Nothing to expire");
    expect(mockExpireOffer).not.toHaveBeenCalled();
  });

  it("calls expireOffer for each expired offer and returns the count", async () => {
    mockPrisma.offer.findMany.mockResolvedValue([EXPIRED_OFFER_1, EXPIRED_OFFER_2]);

    const res = await GET(makeRequest("test-cron-secret"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.expired).toBe(2);
    expect(data.failed).toBe(0);

    expect(mockExpireOffer).toHaveBeenCalledTimes(2);
    expect(mockExpireOffer).toHaveBeenCalledWith(EXPIRED_OFFER_1);
    expect(mockExpireOffer).toHaveBeenCalledWith(EXPIRED_OFFER_2);
  });

  it("queries only pending offers with expiresAt in the past, selecting the renamed listingId field", async () => {
    mockPrisma.offer.findMany.mockResolvedValue([]);
    await GET(makeRequest("test-cron-secret"));

    expect(mockPrisma.offer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "pending",
          expiresAt: { lt: expect.any(Date) },
        },
        select: {
          id: true,
          paymentIntentId: true,
          buyerId: true,
          listingId: true,
        },
      })
    );
  });

  it("continues processing remaining offers when one fails, reports failed count", async () => {
    mockPrisma.offer.findMany.mockResolvedValue([EXPIRED_OFFER_1, EXPIRED_OFFER_2]);

    mockExpireOffer
      .mockRejectedValueOnce(new Error("Stripe timeout"))
      .mockResolvedValueOnce(undefined);

    const res = await GET(makeRequest("test-cron-secret"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.expired).toBe(1);
    expect(data.failed).toBe(1);
    expect(data.errors).toHaveLength(1);
    expect(data.errors[0]).toContain("offer-1");
    expect(data.errors[0]).toContain("Stripe timeout");
  });

  it("also works via POST (for local curl testing)", async () => {
    mockPrisma.offer.findMany.mockResolvedValue([]);
    const req = new NextRequest("http://localhost/api/cron/expire-offers", {
      method: "POST",
      headers: { authorization: "Bearer test-cron-secret" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/api/cron/expire-offers.test.ts`
Expected: FAIL — the route's `select` still requests the nonexistent `cardId` field, which Prisma would reject (the mock doesn't enforce this, but the exact-shape assertion in the "queries only pending offers..." test fails since the route still passes `cardId: true`).

- [ ] **Step 3: Rewrite the route**

In `src/app/api/cron/expire-offers/route.ts`, change only the `select` object inside the Pass-2 query:

```ts
  const expiredOffers = await prisma.offer.findMany({
    where: {
      status: "pending",
      expiresAt: { lt: now },
    },
    select: {
      id: true,
      paymentIntentId: true,
      buyerId: true,
      listingId: true,
    },
  });
```

(Everything else in the file — comments, the loop, the response shape — is unchanged. The full file for reference after this edit:)

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { expireOffer } from "@/lib/offerExpiry";

/**
 * GET /api/cron/expire-offers  ← called by Vercel Cron Jobs (vercel.json)
 * POST /api/cron/expire-offers ← kept for local curl testing
 *
 * Background job that cleans up overdue pending offers.
 *
 * Why is this needed?
 * ───────────────────
 * When a buyer places an offer, Stripe authorises (holds) the funds on their
 * card. If the seller never responds, that hold must eventually be released —
 * otherwise the buyer's money is stuck indefinitely.
 *
 * This job:
 *   1. Finds all pending offers where expiresAt has passed (seller didn't respond
 *      within 24h).
 *   2. For each one, calls expireOffer() which:
 *        a. Cancels the Stripe PaymentIntent → releases the hold on buyer's card
 *        b. Sets offer status → "expired" in the DB
 *
 * How to run it:
 * ──────────────
 * Vercel Cron Jobs (vercel.json) call this via GET every 5 minutes on Pro plan.
 * Vercel automatically sends Authorization: Bearer <CRON_SECRET> for you.
 *
 * For local testing:
 *   curl http://localhost:3000/api/cron/expire-offers \
 *     -H "Authorization: Bearer <CRON_SECRET>"
 *
 * Security:
 * ─────────
 * Protected by CRON_SECRET env var. Set it in Vercel → Settings → Environment
 * Variables AND in your local .env file with the same value.
 */
async function runExpiry(req: NextRequest): Promise<NextResponse> {
  // ── 1. Authorise the cron caller ──────────────────────────────────────────
  // The secret must match CRON_SECRET in env. Use a long random string.
  const authHeader = req.headers.get("authorization");
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken) {
    // Misconfiguration — log loudly and refuse
    console.error("[cron/expire-offers] CRON_SECRET env var is not set");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Find all pending offers that have passed their expiry time ──────────
  // "pending" = seller hasn't responded yet
  // expiresAt < now = the 24h window has passed
  const now = new Date();
  const expiredOffers = await prisma.offer.findMany({
    where: {
      status: "pending",
      expiresAt: { lt: now },
    },
    select: {
      id: true,
      paymentIntentId: true,
      buyerId: true,
      listingId: true,
    },
  });

  if (expiredOffers.length === 0) {
    return NextResponse.json({ expired: 0, message: "Nothing to expire" });
  }

  // ── 3. Expire each offer one by one ───────────────────────────────────────
  // We process sequentially (not in parallel) to avoid hammering Stripe's API
  // with a burst of concurrent requests. If one fails, we log and continue so
  // the rest still get processed.
  const results = { success: 0, failed: 0, errors: [] as string[] };

  for (const offer of expiredOffers) {
    try {
      // expireOffer: cancels the PI then marks offer "expired" in DB
      await expireOffer(offer);
      results.success++;
    } catch (err) {
      results.failed++;
      results.errors.push(
        `Offer ${offer.id}: ${err instanceof Error ? err.message : String(err)}`
      );
      console.error("[cron/expire-offers] Failed to expire offer:", offer.id, err);
    }
  }

  // ── 4. Return a summary ───────────────────────────────────────────────────
  // Useful for monitoring / alerting. Check these in your cron service logs.
  console.log(
    `[cron/expire-offers] Done. Success: ${results.success}, Failed: ${results.failed}`
  );

  return NextResponse.json({
    expired: results.success,
    failed: results.failed,
    ...(results.errors.length > 0 && { errors: results.errors }),
  });
}

// Vercel Cron Jobs call via GET — export both so local curl testing still works.
export const GET = runExpiry;
export const POST = runExpiry;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/api/cron/expire-offers.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, all tests green (this is the last task in the plan).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/expire-offers/route.ts src/__tests__/api/cron/expire-offers.test.ts
git commit -m "fix: select the renamed listingId field in the expire-offers cron"
```

---

## Manual Verification (after all tasks complete)

1. Place an offer on a seeded for-sale listing (both a Pokémon and the seeded Riftbound listing) against the live dev database; confirm the offer is created with the correct catalog-resolved title in the seller notification.
2. Accept an offer end-to-end (test-mode PI) and confirm the `Order`/`CardTransaction` rows are created with `listingId` set, and the listing's ownership actually transfers in the database.
3. Confirm a `GET /api/offers?mine=true` call returns the resolved `card.title`/`cardId` (not `listingId`) for a real buyer's offer history.
