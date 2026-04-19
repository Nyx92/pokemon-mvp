import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * HOW THIS FILE EXECUTES (what Vitest does before a single test runs)
 *
 * Same hoisting rules as offerExpiry.test.ts — Vitest moves certain calls to
 * the top before imports run. Here is the actual execution order:
 *
 * 1. vi.hoisted() blocks run first — creates the three mock objects in memory:
 *      mockStripeInstance  — fake Stripe client (checkout.sessions.create)
 *      mockPrisma          — fake Prisma client (card, order, $transaction)
 *      mockGetServerSession — fake auth function (controls who is "logged in")
 *
 * 2. vi.mock() factories run second — registers the fakes so that any module
 *    importing "stripe", "@/lib/prisma", "next-auth", or "@/lib/auth" gets
 *    the fake version instead of the real one:
 *      "stripe"         → returns mockStripeInstance when new Stripe() is called
 *      "@/lib/prisma"   → replaces the real DB client with mockPrisma
 *      "next-auth"      → replaces getServerSession with mockGetServerSession
 *      "@/lib/auth"     → replaces authOptions with an empty object (not needed)
 *
 * 3. import { POST } runs last — the real checkout route handler is loaded.
 *    When it internally imports stripe, prisma, and next-auth it gets the fakes.
 *    So when POST runs in a test, it calls mockStripeInstance, mockPrisma, and
 *    mockGetServerSession — never the real services.
 *
 * New concepts vs offerExpiry.test.ts:
 *
 *   mockGetServerSession — your checkout route calls getServerSession() to check
 *   who is logged in. This mock lets each test control that answer:
 *     logged in  → mockGetServerSession.mockResolvedValue({ user: { id: "..." } })
 *     logged out → mockGetServerSession.mockResolvedValue(null)
 *
 *   NextRequest — your route handler expects a real HTTP request object.
 *   makeRequest() builds one so tests don't repeat the boilerplate every time.
 *
 *   $transaction — your checkout route uses Prisma transactions in two forms:
 *     callback form: $transaction(async (tx) => { ... }) — atomic reservation
 *     array form:    $transaction([op1, op2])             — update order + card
 *   The $transaction mock in beforeEach handles both.
 */

// ── STEP 1: Create the mock objects ──────────────────────────────────────────
// vi.hoisted() moves these to the very top (before imports).
// We define them here so vi.mock() factories below can reference them,
// and individual tests can set return values per test.

const mockStripeInstance = vi.hoisted(() => ({
  checkout: {
    sessions: { create: vi.fn() },
  },
}));

const mockPrisma = vi.hoisted(() => ({
  card: {
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  order: {
    create: vi.fn(),
    update: vi.fn(),
  },
  user: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

// Controls what getServerSession() returns — i.e. who is "logged in"
const mockGetServerSession = vi.hoisted(() => vi.fn());

// ── STEP 2: Register the fakes ────────────────────────────────────────────────
// vi.mock() is also hoisted. Any module that imports these packages gets the
// fake version. The checkout route imports all four of these.

vi.mock("stripe", () => ({ default: vi.fn(() => mockStripeInstance) }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
// authOptions is just passed into getServerSession() — we don't need its real
// value since getServerSession itself is mocked. Empty object is enough.
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

// ── STEP 3: Import the code under test ───────────────────────────────────────
// Runs after the fakes are in place. The real POST handler is loaded but all
// its dependencies (stripe, prisma, next-auth) are now the mocked versions.

import { POST } from "@/app/api/checkout/route";

// ── Test helpers + shared data ────────────────────────────────────────────────

// Builds a fake HTTP POST request so tests don't repeat this boilerplate.
// NextRequest is Next.js's own request class — the route handler expects it.
function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Shared test data — reused across tests. Spread and override individual
// fields to simulate different card states (e.g. { ...CARD, forSale: false })
const CARD = {
  id: "card-1",
  title: "Charizard Base Set",
  price: 5000, // S$50.00 in cents — matches how prices are stored in the DB
  forSale: true,
  ownerId: "seller-1",
  imageUrls: ["https://example.com/img.png"],
};

const MOCK_ORDER = { id: "order-1" };
const MOCK_SESSION = {
  id: "cs_test_123",
  url: "https://checkout.stripe.com/pay/cs_test_123",
};

describe("POST /api/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: authenticated buyer
    mockGetServerSession.mockResolvedValue({ user: { id: "buyer-1" } });

    // Default: card found and for sale
    mockPrisma.card.findUnique.mockResolvedValue(CARD);

    // Default: $transaction calls the callback (interactive form) or resolves array
    mockPrisma.$transaction.mockImplementation(async (fnOrOps) => {
      if (typeof fnOrOps === "function") {
        // Mock tx client for the reservation transaction
        const mockTx = {
          card: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
          order: { create: vi.fn().mockResolvedValue(MOCK_ORDER) },
          user: { findUnique: vi.fn().mockResolvedValue({ id: "buyer-1" }) },
        };
        return fnOrOps(mockTx);
      }
      // Sequential array form (updating order + card with session id)
      return Promise.all(fnOrOps);
    });

    // Default: Stripe checkout session created
    mockStripeInstance.checkout.sessions.create.mockResolvedValue(MOCK_SESSION);

    // Default: order + card updated with session id
    mockPrisma.order.update.mockResolvedValue({});
    mockPrisma.card.update.mockResolvedValue({});
  });

  // ── Auth ────────────────────────────────────────────────────────────────────

  // What's being tested: the auth guard at the top of your checkout route.
  //
  // Your route calls getServerSession() first thing. If it returns null (no
  // session), the request must be rejected immediately — before any DB query or
  // Stripe call. This test overrides the beforeEach default (logged in) to
  // simulate a visitor who is not logged in, then verifies the route refuses them.
  //
  // Why this matters: without this guard, any anonymous user could trigger a
  // Stripe checkout session and a DB order — a serious security and billing risk.

  it("returns 401 when not authenticated", async () => {
    // Override default: no session means nobody is logged in
    mockGetServerSession.mockResolvedValue(null);

    const res = await POST(makeRequest({ cardId: "card-1" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "Not authenticated" });
  });

  // ── Card validation ─────────────────────────────────────────────────────────

  // What's being tested: the pokemon card existence check after auth passes.
  //
  // Your route does a DB lookup with card.findUnique(). If the pokemon card ID from the
  // request body doesn't exist in the DB, the route must return 404 before
  // touching Stripe. This test makes findUnique return null (card not found).
  //
  // Why this matters: without this check, the route would try to pass undefined
  // values into Stripe — which would either crash or create a broken session.

  it("returns 404 when card does not exist", async () => {
    // Override default: pokemon card lookup returns nothing — pokemon card does not exist
    mockPrisma.card.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest({ cardId: "card-x" }));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "Card not found" });
  });

  // What's being tested: the forSale guard — a card must be listed for sale
  // before a buyer can check out.
  //
  // { ...CARD, forSale: false } spreads the shared CARD constant and overrides
  // just the forSale field. The rest of the card data stays the same.
  // This simulates a card that exists in the DB but has been unlisted by the
  // seller (or was never listed in the first place).
  //
  // Why this matters: without this check, a buyer could buy a card the seller
  // already pulled from sale — triggering a charge for an item no longer available.

  it("returns 409 when card is not for sale", async () => {
    // Override default: card exists but forSale is false
    mockPrisma.card.findUnique.mockResolvedValue({ ...CARD, forSale: false });

    const res = await POST(makeRequest({ cardId: "card-1" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "Card is not for sale" });
  });

  // What's being tested: the price validation guard — Stripe requires a
  // positive integer amount. A null price would crash Stripe's API call.
  //
  // { ...CARD, price: null } simulates a card that was saved to the DB without
  // a price (shouldn't happen in practice, but defensive code must handle it).
  //
  // Why this matters: passing null as unit_amount to Stripe throws a Stripe
  // error in production. This guard catches it early with a clean 400 instead.

  it("returns 400 when card has no price", async () => {
    // Override default: card exists and is for sale but has no price set
    mockPrisma.card.findUnique.mockResolvedValue({ ...CARD, price: null });

    const res = await POST(makeRequest({ cardId: "card-1" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "Card has invalid price" });
  });

  // What's being tested: the zero-price guard — same logic as above but for
  // a price that is technically set (not null) but still invalid for Stripe.
  //
  // Stripe requires unit_amount to be >= 1 cent. Passing 0 would be rejected
  // by Stripe's API. Your route must catch this before calling Stripe.
  //
  // Note: only status is asserted here. The exact error message is not checked
  // because the key requirement is simply "reject zero-price checkouts early."

  it("returns 400 when card price is zero", async () => {
    // Override default: card exists and is for sale but price is 0
    mockPrisma.card.findUnique.mockResolvedValue({ ...CARD, price: 0 });

    const res = await POST(makeRequest({ cardId: "card-1" }));
    expect(res.status).toBe(400);
  });

  // ── Race condition (card snatched by another buyer) ─────────────────────────

  // What's being tested: the atomic reservation guard against a race condition.
  //
  // Your route uses $transaction with updateMany to reserve the card:
  //   card.updateMany({ where: { id, forSale: true }, data: { forSale: false } })
  //
  // If two buyers click "Buy Now" at nearly the same moment, one will win and
  // one will lose. The winner's updateMany returns { count: 1 } (card updated).
  // The loser's updateMany returns { count: 0 } — the card was already set to
  // forSale: false by the winner, so there was nothing left to update.
  //
  // Your code checks the count and throws if it's 0, which causes the
  // $transaction to roll back and the route to return 500.
  //
  // Why this matters: without the atomic updateMany guard, two buyers could both
  // think they own the same card — one would pay and never receive it.
  //
  // How the test simulates the race: override $transaction so the mockTx it
  // passes to your callback has updateMany returning { count: 0 } — as if the
  // card was just grabbed by the other buyer a split second earlier.

  it("returns 500 when the card was just reserved by another buyer", async () => {
    mockPrisma.$transaction.mockImplementation(async (fnOrOps) => {
      if (typeof fnOrOps === "function") {
        const mockTx = {
          card: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) }, // race lost — other buyer was first
          order: { create: vi.fn() },
          user: { findUnique: vi.fn().mockResolvedValue({ id: "buyer-1" }) },
        };
        return fnOrOps(mockTx);
      }
      return Promise.all(fnOrOps);
    });

    const res = await POST(makeRequest({ cardId: "card-1" }));
    expect(res.status).toBe(500);
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  // What's being tested: the full successful checkout flow end to end.
  //
  // All the mocks are already set to succeed in beforeEach — the card exists,
  // the buyer is logged in, the $transaction succeeds (count: 1), and Stripe
  // creates a session. This test runs the real POST handler and verifies:
  //
  //   1. The response is 200 with the Stripe checkout URL in the body
  //   2. Stripe was called with the correct amount, currency, and metadata
  //
  // The second assertion is the most important here. It proves your code wires
  // up the Stripe session correctly — right amount (in cents), right currency
  // (sgd), and the metadata contains the cardId, buyerId, and sellerId that
  // the webhook handler needs later to fulfil the order.
  //
  // expect.objectContaining() lets us assert on just the fields we care about
  // without specifying every field in the Stripe call (like success_url etc.).

  it("reserves card, creates order, creates Stripe session, returns checkout URL", async () => {
    const res = await POST(makeRequest({ cardId: "card-1" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.url).toBe(MOCK_SESSION.url);

    // Stripe checkout session created with correct amount and currency
    expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              currency: "sgd",
              unit_amount: CARD.price,
            }),
            quantity: 1,
          }),
        ],
        metadata: expect.objectContaining({
          cardId: "card-1",
          buyerId: "buyer-1",
          sellerId: CARD.ownerId,
        }),
      })
    );
  });
});
