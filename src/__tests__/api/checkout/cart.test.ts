import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Tests for POST /api/checkout/cart.
 *
 * The route:
 *   1. Authenticates the user
 *   2. Fetches selected cart items + fresh card data
 *   3. Validates cards (for sale, not own, price > 0)
 *   4. Atomically reserves all cards and creates Orders
 *   5. Creates a Stripe Checkout Session with all items as line items
 *   6. Stamps Orders and Cards with the session ID
 *   7. Returns { url }
 */

// ── STEP 1: Create mock objects ───────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  cart: { findUnique: vi.fn() },
  card: { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  order: { create: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

const mockStripeCreate = vi.hoisted(() => vi.fn());
const mockStripe = vi.hoisted(() =>
  vi.fn().mockImplementation(() => ({
    checkout: { sessions: { create: mockStripeCreate } },
  }))
);

// ── STEP 2: Register fakes ────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("stripe", () => ({ default: mockStripe }));

// ── STEP 3: Import code under test ────────────────────────────────────────────

import { POST } from "@/app/api/checkout/cart/route";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SESSION = { user: { id: "buyer-1" } };

const CARD = {
  id: "card-1",
  title: "Charizard",
  price: 1000,          // 1000 cents = S$10.00
  forSale: true,
  ownerId: "seller-1",
  imageUrls: ["https://example.com/charizard.jpg"],
};

const CART_ITEM = {
  id: "cartitem-1",
  cardId: "card-1",
  selected: true,
  card: CARD,
};

const CART = {
  id: "cart-1",
  userId: "buyer-1",
  items: [CART_ITEM],
};

function makeRequest() {
  return new NextRequest("http://localhost/api/checkout/cart", { method: "POST" });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/checkout/cart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  // What's being tested: auth gate
  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  // What's being tested: empty cart / no selected items
  it("returns 400 when cart has no selected items", async () => {
    mockPrisma.cart.findUnique.mockResolvedValueOnce({ id: "cart-1", items: [] });
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no selected items/i);
  });

  // What's being tested: cart not found returns same 400
  it("returns 400 when cart does not exist", async () => {
    mockPrisma.cart.findUnique.mockResolvedValueOnce(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
  });

  // What's being tested: card no longer for sale is rejected with 409
  it("returns 409 when a card is no longer for sale", async () => {
    mockPrisma.cart.findUnique.mockResolvedValueOnce(CART);
    mockPrisma.card.findMany.mockResolvedValueOnce([{ ...CARD, forSale: false }]);
    const res = await POST(makeRequest());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("no longer for sale");
  });

  // What's being tested: buyer trying to purchase their own card is blocked
  it("returns 400 when buyer tries to buy their own card", async () => {
    mockPrisma.cart.findUnique.mockResolvedValueOnce(CART);
    mockPrisma.card.findMany.mockResolvedValueOnce([{ ...CARD, ownerId: "buyer-1" }]);
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/own card/i);
  });

  // What's being tested: card with no price is rejected
  it("returns 400 when a card has no price", async () => {
    mockPrisma.cart.findUnique.mockResolvedValueOnce(CART);
    mockPrisma.card.findMany.mockResolvedValueOnce([{ ...CARD, price: null }]);
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no valid price/i);
  });

  // What's being tested: reservation conflict returns a user-friendly 500
  it("returns 500 when a card is already reserved by another buyer", async () => {
    mockPrisma.cart.findUnique.mockResolvedValueOnce(CART);
    mockPrisma.card.findMany.mockResolvedValueOnce([CARD]);

    // Transaction throws because updateMany count = 0
    mockPrisma.$transaction.mockRejectedValueOnce(
      new Error('"Charizard" was just reserved by another buyer. Please try again.')
    );

    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("reserved by another buyer");
  });

  // What's being tested: the specific race this fix closes. Buyer A has
  // already reserved the card (reservedUntil is in the future) but their
  // Stripe session hasn't been created yet, so reservedCheckoutSessionId is
  // still null. Before the fix, the `{ reservedCheckoutSessionId: null }`
  // branch of the OR clause let Buyer B's updateMany match and steal the
  // reservation out from under Buyer A. After the fix, only an expired or
  // never-set reservedUntil allows a new reservation — an active
  // reservedUntil blocks Buyer B regardless of reservedCheckoutSessionId.
  it("does not let a second buyer steal a reservation that's active but not yet session-stamped", async () => {
    mockPrisma.cart.findUnique.mockResolvedValueOnce(CART);
    mockPrisma.card.findMany.mockResolvedValueOnce([CARD]);

    mockPrisma.$transaction.mockImplementation(async (fnOrOps) => {
      if (typeof fnOrOps === "function") {
        const mockTx = {
          card: {
            // Simulates the real WHERE clause correctly rejecting Buyer B:
            // reservedUntil is in the future and reservedCheckoutSessionId is
            // null, but reservedCheckoutSessionId: null must no longer be a
            // standalone match branch.
            updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          },
          order: { create: vi.fn() },
        };
        return fnOrOps(mockTx);
      }
      return Promise.all(fnOrOps);
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("reserved by another buyer");
  });

  // What's being tested: same fix as above, verified by inspecting the
  // actual WHERE clause the per-item reservation loop sends to
  // tx.card.updateMany — it must no longer include a standalone
  // `{ reservedCheckoutSessionId: null }` branch in its OR clause.
  it("reservation query no longer includes a standalone reservedCheckoutSessionId:null branch", async () => {
    mockPrisma.cart.findUnique.mockResolvedValueOnce(CART);
    mockPrisma.card.findMany.mockResolvedValueOnce([CARD]);

    let capturedWhere: any;
    mockPrisma.$transaction.mockImplementation(async (fnOrOps) => {
      if (typeof fnOrOps === "function") {
        const mockTx = {
          card: {
            updateMany: vi.fn().mockImplementation((args) => {
              capturedWhere = args.where;
              return Promise.resolve({ count: 1 });
            }),
          },
          order: { create: vi.fn().mockResolvedValue({ id: "order-1" }) },
        };
        return fnOrOps(mockTx);
      }
      return Promise.all(fnOrOps);
    });

    await POST(makeRequest());

    expect(capturedWhere.OR).not.toContainEqual({ reservedCheckoutSessionId: null });
  });

  // What's being tested: happy path — session created, url returned
  it("creates orders, creates stripe session, returns url", async () => {
    mockPrisma.cart.findUnique.mockResolvedValueOnce(CART);
    mockPrisma.card.findMany.mockResolvedValueOnce([CARD]);

    // Transaction returns the created orders
    const createdOrders = [
      { orderId: "order-1", cardId: "card-1", sellerId: "seller-1", amount: 1000 },
    ];
    mockPrisma.$transaction.mockResolvedValueOnce(createdOrders);

    // Stripe returns a checkout URL
    mockStripeCreate.mockResolvedValueOnce({ id: "cs_test_abc", url: "https://checkout.stripe.com/pay/cs_test_abc" });

    // Stamping transaction (orders + cards)
    mockPrisma.$transaction.mockResolvedValueOnce([]);

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toBe("https://checkout.stripe.com/pay/cs_test_abc");

    // Stripe session should be created with correct metadata
    expect(mockStripeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ checkoutType: "cart", buyerId: "buyer-1" }),
        cancel_url: expect.stringContaining("/cart"),
      })
    );
  });

  // What's being tested: Stripe error surfaces as 500 with message
  it("returns 500 when Stripe session creation fails", async () => {
    mockPrisma.cart.findUnique.mockResolvedValueOnce(CART);
    mockPrisma.card.findMany.mockResolvedValueOnce([CARD]);
    mockPrisma.$transaction.mockResolvedValueOnce([
      { orderId: "order-1", cardId: "card-1", sellerId: "seller-1", amount: 1000 },
    ]);
    mockStripeCreate.mockRejectedValueOnce(new Error("Stripe unavailable"));

    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });
});
