import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * HOW THIS FILE EXECUTES (what Vitest does before a single test runs)
 *
 * 1. vi.hoisted() blocks run first — creates two mock objects in memory:
 *      mockPrisma           — fake Prisma client (order.findMany)
 *      mockGetServerSession — fake auth function
 *
 * 2. vi.mock() factories run second — registers the fakes. No Stripe mock
 *    needed here because the orders endpoint is read-only — it just fetches
 *    existing order records from the DB, it never calls Stripe.
 *
 * 3. import { GET } runs last — the real orders route is loaded with fakes.
 *
 * What this endpoint does:
 *   GET /api/orders returns a user's order history. The type query param
 *   controls which side of the transaction to show:
 *
 *     ?type=purchases (default) → orders where buyerId = current user
 *     ?type=sold               → orders where sellerId = current user
 *
 *   All amounts are stored in cents in the DB and converted to dollars in
 *   the response. Each order includes card details, seller info, and buyer
 *   info for display in the transaction history UI.
 *
 *   The viaOffer flag indicates how the sale happened:
 *     viaOffer: false → direct Buy Now checkout (Stripe Checkout)
 *     viaOffer: true  → accepted offer flow (manual PI capture)
 */

// ── STEP 1: Create the mock objects ──────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  order: { findMany: vi.fn() },
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

// ── STEP 2: Register the fakes ────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

// ── STEP 3: Import the code under test ───────────────────────────────────────

import { GET } from "@/app/api/orders/route";

// ── Test helpers + shared data ────────────────────────────────────────────────

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/orders");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

// makeOrder() produces a full order object as Prisma would return it (with
// relations included). Pass overrides to change specific fields per test.
function makeOrder(overrides = {}) {
  return {
    id: "order-1",
    status: "PAID",
    amount: 5000, // S$50.00 in cents — API must convert to dollars for response
    currency: "sgd",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    offer: null, // null = Buy Now flow (not via offer)
    card: {
      id: "card-1",
      title: "Charizard",
      imageUrls: ["https://example.com/img.png"],
      condition: "NM",
      tcgPlayerId: "xy1-4",
    },
    seller: { id: "seller-1", username: "alice", email: "alice@x.com" },
    buyer: { id: "buyer-1", username: "bob", email: "bob@x.com" },
    ...overrides,
  };
}

describe("GET /api/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated as buyer-1
    mockGetServerSession.mockResolvedValue({ user: { id: "buyer-1" } });
  });

  // ── Auth ──────────────────────────────────────────────────────────────────

  // What's being tested: the auth gate — order history requires login.
  //
  // An anonymous user must not be able to see any order data. Without this
  // guard, anyone could query orders and see purchase history and pricing data.

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  // ── Purchases (buyer) ─────────────────────────────────────────────────────

  // What's being tested: the purchases view — orders where I am the buyer.
  //
  // When ?type=purchases (or no type param, since purchases is the default),
  // the route queries by buyerId = current user and returns their purchase history.
  //
  // Two things to verify:
  //   1. The DB query uses { where: { buyerId: "buyer-1" } } (not sellerId)
  //   2. The amount is converted from cents (5000) to dollars (50) in the response

  it("returns purchases (buyerId = user) when type=purchases", async () => {
    mockPrisma.order.findMany.mockResolvedValue([makeOrder()]);

    const res = await GET(makeRequest({ type: "purchases" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.orders).toHaveLength(1);

    // Must query by buyerId — not sellerId
    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { buyerId: "buyer-1" },
      })
    );

    // Amount converted from cents to dollars (5000 → 50)
    expect(data.orders[0].amount).toBe(50);
    expect(data.orders[0].status).toBe("PAID");
  });

  // What's being tested: the default behaviour when no type param is given.
  //
  // The transaction history page uses GET /api/orders with no params to load
  // the initial view. The route should default to "purchases" so the buyer
  // sees their purchase history first. This test verifies that default.

  it("defaults to purchases when no type param is provided", async () => {
    mockPrisma.order.findMany.mockResolvedValue([]);

    await GET(makeRequest()); // no type param

    // Even without ?type=purchases, the query uses buyerId
    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { buyerId: "buyer-1" } })
    );
  });

  // ── Sold (seller) ─────────────────────────────────────────────────────────

  // What's being tested: the sold view — orders where I am the seller.
  //
  // When ?type=sold the route switches the DB query to sellerId = current user.
  // Without this test, a bug where the route always queries by buyerId would
  // make the sold tab always show an empty list (or someone else's sales).

  it("returns sold orders (sellerId = user) when type=sold", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "seller-1" } });
    mockPrisma.order.findMany.mockResolvedValue([makeOrder()]);

    const res = await GET(makeRequest({ type: "sold" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    // Must query by sellerId — not buyerId
    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sellerId: "seller-1" } })
    );
  });

  // ── Response shape ────────────────────────────────────────────────────────

  // What's being tested: the exact shape of the order response object.
  //
  // The transaction history UI depends on specific fields being present and
  // correctly named. This test verifies the full response shape in one go:
  //   - id, status, amount (dollars), currency, createdAt
  //   - viaOffer: false (offer field is null → this was a Buy Now purchase)
  //   - card: id, title, condition
  //   - seller: id, username
  //   - buyer: id, username

  it("returns correct response shape with card, seller, and buyer details", async () => {
    mockPrisma.order.findMany.mockResolvedValue([makeOrder()]);

    const res = await GET(makeRequest({ type: "purchases" }));
    const { orders } = await res.json();
    const order = orders[0];

    expect(order).toMatchObject({
      id: "order-1",
      status: "PAID",
      amount: 50,         // converted from 5000 cents
      currency: "sgd",
      viaOffer: false,    // offer is null → not via offer flow
      card: { id: "card-1", title: "Charizard", condition: "NM" },
      seller: { id: "seller-1", username: "alice" },
      buyer: { id: "buyer-1", username: "bob" },
    });
  });

  // What's being tested: the viaOffer flag when the order came from an offer.
  //
  // Orders can be placed two ways: Buy Now (Stripe Checkout) or accepted offer
  // (manual PI capture). The UI shows different labels for each. The route
  // sets viaOffer = !!order.offer — true when the offer relation is present.
  //
  // This test uses makeOrder({ offer: { id: "offer-1", ... } }) to simulate
  // an order that was created through the offer accept flow.

  it("marks viaOffer=true when the order was placed through the offer flow", async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      makeOrder({ offer: { id: "offer-1", price: 5000, message: "Can meet up" } }),
    ]);

    const res = await GET(makeRequest({ type: "purchases" }));
    const { orders } = await res.json();

    // offer field is present → viaOffer must be true
    expect(orders[0].viaOffer).toBe(true);
  });

  // What's being tested: the empty-list response when the user has no orders.
  //
  // A new user with no purchase history should receive { orders: [] }, not a
  // 404 or an error. An empty list is the correct response for "no results".

  it("returns empty array when user has no orders", async () => {
    mockPrisma.order.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest({ type: "purchases" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.orders).toEqual([]);
  });
});
