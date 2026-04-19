import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * HOW THIS FILE EXECUTES (what Vitest does before a single test runs)
 *
 * 1. vi.hoisted() blocks run first — creates three mock objects in memory:
 *      mockStripeInstance  — fake Stripe client (paymentIntents.create)
 *      mockPrisma          — fake Prisma client (card.findUnique)
 *      mockGetServerSession — fake auth function (controls who is "logged in")
 *
 * 2. vi.mock() factories run second — registers the fakes so any module that
 *    imports these packages gets the fake version instead of the real one:
 *      "stripe"       → new Stripe() returns mockStripeInstance
 *      "@/lib/prisma" → replaces the real DB client with mockPrisma
 *      "next-auth"    → replaces getServerSession with mockGetServerSession
 *      "@/lib/auth"   → replaces authOptions with an empty object (not needed)
 *
 * 3. import { POST } runs last — the real payment-intent route is loaded.
 *    When it internally calls stripe, prisma, and next-auth it gets the fakes.
 *
 * What this endpoint does:
 *   The buyer's frontend calls POST /api/offers/payment-intent BEFORE submitting
 *   an offer. This creates a Stripe PaymentIntent with capture_method: "manual"
 *   — Stripe authorises (holds) the funds on the buyer's card but does NOT
 *   charge them yet. The PI id and client_secret are returned to the frontend,
 *   which uses the client_secret to confirm the PI via Stripe.js. Then the
 *   buyer submits the offer form with the paymentIntentId. This way the seller
 *   knows the buyer's funds are ready before deciding to accept.
 */

// ── STEP 1: Create the mock objects ──────────────────────────────────────────

const mockStripeInstance = vi.hoisted(() => ({
  paymentIntents: { create: vi.fn() },
}));

const mockPrisma = vi.hoisted(() => ({
  card: { findUnique: vi.fn() },
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

// The card the buyer wants to make an offer on
const CARD = {
  id: "card-1",
  title: "Charizard",
  forSale: true,
  ownerId: "seller-1",
};

describe("POST /api/offers/payment-intent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated as buyer-1 (not the card owner)
    mockGetServerSession.mockResolvedValue({ user: { id: "buyer-1" } });
    // Default: card exists and is for sale
    mockPrisma.card.findUnique.mockResolvedValue(CARD);
    // Default: Stripe creates the PI successfully
    mockStripeInstance.paymentIntents.create.mockResolvedValue({
      id: "pi_123",
      client_secret: "pi_123_secret_abc",
    });
  });

  // ── Auth ────────────────────────────────────────────────────────────────────

  // What's being tested: the auth gate — only logged-in users can create a PI.
  //
  // An anonymous user clicking "Make Offer" must be rejected before any Stripe
  // API call is made. Without this guard, anyone could create a PI that
  // charges a real card with no user tied to it.

  it("returns 401 when not authenticated", async () => {
    // Override default: no session → nobody logged in
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(makeRequest({ cardId: "card-1", price: 5000 }));
    expect(res.status).toBe(401);
  });

  // ── Input validation ────────────────────────────────────────────────────────

  // What's being tested: the request body validation for missing cardId.
  //
  // The route must validate the body before touching Stripe or the DB.
  // A missing cardId means there's no card to create a PI for — the error
  // message should mention "cardId" so the client knows exactly what's wrong.

  it("returns 400 when cardId is missing", async () => {
    const res = await POST(makeRequest({ price: 5000 })); // no cardId
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("cardId") });
  });

  // What's being tested: the price guard for a zero value.
  //
  // Stripe requires unit_amount to be >= 1 cent. A price of 0 must be rejected
  // before calling Stripe, otherwise Stripe's API would return an error.

  it("returns 400 when price is zero", async () => {
    const res = await POST(makeRequest({ cardId: "card-1", price: 0 }));
    expect(res.status).toBe(400);
  });

  // What's being tested: the price guard for a negative value.
  //
  // A negative price makes no sense for a payment and Stripe would reject it.
  // This guard ensures bad data is caught early at the application layer
  // before it ever reaches Stripe.

  it("returns 400 when price is negative", async () => {
    const res = await POST(makeRequest({ cardId: "card-1", price: -1 }));
    expect(res.status).toBe(400);
  });

  // ── Card validation ─────────────────────────────────────────────────────────

  // What's being tested: the card existence check.
  //
  // If the card doesn't exist in the DB there's nothing to make an offer on.
  // The route must return 404 before calling Stripe.

  it("returns 404 when card does not exist", async () => {
    mockPrisma.card.findUnique.mockResolvedValue(null);
    const res = await POST(makeRequest({ cardId: "card-x", price: 5000 }));
    expect(res.status).toBe(404);
  });

  // What's being tested: the forSale guard.
  //
  // A buyer can only make an offer on a card that is currently listed for sale.
  // If the seller pulled the card from sale between the buyer opening the page
  // and clicking "Make Offer", the route must reject the PI creation.

  it("returns 409 when card is not for sale", async () => {
    // Override default: card exists but is no longer listed
    mockPrisma.card.findUnique.mockResolvedValue({ ...CARD, forSale: false });
    const res = await POST(makeRequest({ cardId: "card-1", price: 5000 }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "Card is not for sale" });
  });

  // What's being tested: the self-offer guard.
  //
  // A seller cannot make an offer on their own card — that would be
  // meaningless and could inflate perceived demand. The route checks whether
  // the authenticated user is the card's owner and rejects with 403.

  it("returns 403 when buyer tries to offer on their own card", async () => {
    // Override default: authenticated as seller-1, who also owns the card
    mockGetServerSession.mockResolvedValue({ user: { id: "seller-1" } });
    const res = await POST(makeRequest({ cardId: "card-1", price: 5000 }));
    expect(res.status).toBe(403);
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  // What's being tested: the full successful PI creation flow.
  //
  // All validations pass (auth, price, card exists, for sale, not self-offer).
  // The route must:
  //   1. Call Stripe with the correct amount, currency, and capture_method
  //   2. Return the client_secret (used by Stripe.js on the frontend to confirm
  //      the PI and place the hold on the buyer's card)
  //   3. Return the paymentIntentId (stored in the offer record for later capture)
  //
  // capture_method: "manual" is the critical field here. It means Stripe
  // authorises the charge (holds the funds) but does NOT collect the money yet.
  // The money only moves when the seller accepts and we call paymentIntents.capture.

  it("creates a manual-capture PaymentIntent and returns clientSecret + paymentIntentId", async () => {
    const res = await POST(makeRequest({ cardId: "card-1", price: 5000 }));
    const data = await res.json();

    expect(res.status).toBe(200);
    // client_secret goes to the frontend for Stripe.js confirmation
    expect(data.clientSecret).toBe("pi_123_secret_abc");
    // paymentIntentId stored on the offer row for later capture or cancel
    expect(data.paymentIntentId).toBe("pi_123");

    // Must use manual capture — funds held, not immediately charged
    expect(mockStripeInstance.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 5000,
        currency: "sgd",
        capture_method: "manual",
        metadata: expect.objectContaining({
          buyerId: "buyer-1",
          cardId: "card-1",
        }),
      })
    );
  });
});
