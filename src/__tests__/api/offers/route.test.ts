import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * HOW THIS FILE EXECUTES (what Vitest does before a single test runs)
 *
 * 1. vi.hoisted() blocks run first — creates four mock objects in memory:
 *      mockStripeInstance   — fake Stripe client (paymentIntents.retrieve, cancel)
 *      mockPrisma           — fake Prisma client (card, offer)
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
 */

// ── STEP 1: Create the mock objects ──────────────────────────────────────────

const mockStripeInstance = vi.hoisted(() => ({
  paymentIntents: {
    retrieve: vi.fn(), // POST: validates PI is authorised before saving offer
    cancel: vi.fn(),   // POST: cancels old PI when buyer amends an existing offer
  },
}));

const mockPrisma = vi.hoisted(() => ({
  card: { findUnique: vi.fn() },
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

// ── STEP 3: Import the code under test ───────────────────────────────────────

import { GET, POST } from "@/app/api/offers/route";

// ── Test helpers + shared data ────────────────────────────────────────────────

const CARD = { id: "card-1", title: "Charizard", forSale: true, ownerId: "seller-1" };

// A PaymentIntent that has been authorised — funds held, ready to capture
const PI_REQUIRES_CAPTURE = { status: "requires_capture", metadata: { buyerId: "buyer-1" } };

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
    // Default: card exists and is for sale
    mockPrisma.card.findUnique.mockResolvedValue(CARD);
    // Default: PI is authorised and belongs to this buyer
    mockStripeInstance.paymentIntents.retrieve.mockResolvedValue(PI_REQUIRES_CAPTURE);
    // Default: no existing offer from this buyer
    mockPrisma.offer.findFirst.mockResolvedValue(null);
    // Default: PI cancel succeeds (used in amend path)
    mockStripeInstance.paymentIntents.cancel.mockResolvedValue({});
  });

  // ── Auth ──────────────────────────────────────────────────────────────────

  // What's being tested: the auth gate — unauthenticated buyers must be rejected.
  //
  // Without this guard an anonymous user could create offers tied to no account,
  // leaving orphaned PaymentIntents on real buyer cards.

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(postRequest({ cardId: "card-1", price: 50, paymentIntentId: "pi_1" }));
    expect(res.status).toBe(401);
  });

  // ── Input validation ──────────────────────────────────────────────────────

  // What's being tested: body validation when cardId is missing.
  //
  // The route must reject the request before touching Stripe or the DB.
  // The error should say "Invalid offer data" so the frontend knows the request
  // body is malformed.

  it("returns 400 when cardId is missing", async () => {
    const res = await POST(postRequest({ price: 50, paymentIntentId: "pi_1" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "Invalid offer data" });
  });

  // What's being tested: the price validation guard for zero / negative prices.
  //
  // An offer of S$0 makes no sense. This must be caught before the offer is
  // saved to the DB.

  it("returns 400 when price is zero or negative", async () => {
    const res = await POST(postRequest({ cardId: "card-1", price: 0, paymentIntentId: "pi_1" }));
    expect(res.status).toBe(400);
  });

  // What's being tested: the paymentIntentId presence check.
  //
  // The offer route requires a paymentIntentId from the payment-intent step
  // to have already run. If it's missing the buyer skipped that step and
  // there's no hold on their card — the offer must be rejected.

  it("returns 400 when paymentIntentId is missing", async () => {
    const res = await POST(postRequest({ cardId: "card-1", price: 50 }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "Missing paymentIntentId" });
  });

  // ── Card validation ───────────────────────────────────────────────────────

  // What's being tested: the card existence check before saving an offer.
  //
  // The card the buyer is offering on must exist. Without this check, an offer
  // could be saved for a card that was deleted between page load and submission.

  it("returns 404 when card does not exist", async () => {
    mockPrisma.card.findUnique.mockResolvedValue(null);
    const res = await POST(postRequest({ cardId: "x", price: 50, paymentIntentId: "pi_1" }));
    expect(res.status).toBe(404);
  });

  // What's being tested: the forSale guard.
  //
  // If the seller unlisted the card between the buyer opening the page and
  // submitting the offer, the route must reject it.

  it("returns 409 when card is not for sale", async () => {
    mockPrisma.card.findUnique.mockResolvedValue({ ...CARD, forSale: false });
    const res = await POST(postRequest({ cardId: "card-1", price: 50, paymentIntentId: "pi_1" }));
    expect(res.status).toBe(409);
  });

  // What's being tested: the self-offer guard.
  //
  // A seller cannot offer on their own card. The route checks whether the
  // authenticated user is the card's owner and rejects with 400.

  it("returns 400 when buyer tries to offer on their own card", async () => {
    // Authenticate as seller-1, who is also the card owner
    mockGetServerSession.mockResolvedValue({ user: { id: "seller-1" } });
    const res = await POST(postRequest({ cardId: "card-1", price: 50, paymentIntentId: "pi_1" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "Cannot offer on your own card" });
  });

  // ── PaymentIntent validation ──────────────────────────────────────────────

  // What's being tested: the PI status guard.
  //
  // Before saving the offer, the route fetches the PI from Stripe to confirm
  // it's in "requires_capture" state (funds authorised). If the buyer's card
  // was declined (status: "canceled"), the offer must be rejected — there are
  // no funds to hold and the seller would accept an offer that can never pay.
  //
  // This test simulates a declined card by setting the PI status to "canceled".

  it("returns 409 when PI is not in requires_capture state (card declined etc.)", async () => {
    mockStripeInstance.paymentIntents.retrieve.mockResolvedValue({
      status: "canceled",
      metadata: {},
    });
    const res = await POST(postRequest({ cardId: "card-1", price: 50, paymentIntentId: "pi_1" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("status: canceled") });
  });

  // What's being tested: the PI ownership guard.
  //
  // The route checks that the PI's metadata.buyerId matches the authenticated
  // buyer. Without this, a malicious user could steal another buyer's PI id
  // and attach it to their own offer — effectively charging someone else's card.

  it("returns 403 when PI buyerId metadata does not match the authenticated buyer", async () => {
    mockStripeInstance.paymentIntents.retrieve.mockResolvedValue({
      status: "requires_capture",
      metadata: { buyerId: "someone-else" }, // PI belongs to a different buyer
    });
    const res = await POST(postRequest({ cardId: "card-1", price: 50, paymentIntentId: "pi_1" }));
    expect(res.status).toBe(403);
  });

  // ── New offer (happy path) ────────────────────────────────────────────────

  // What's being tested: the full successful new offer creation flow.
  //
  // All validations pass. The offer is the buyer's first on this card (no
  // existing offer). The route must:
  //   1. Create a new offer row with status "pending" and a 24h expiresAt
  //   2. Return 201 with amended:false and the offer data
  //   3. Return the price in dollars (centsToDollars), not cents
  //
  // The DB stores prices in cents (5000 = S$50.00). The API must convert back
  // to dollars for the client (50). This test verifies that conversion.

  it("creates a new pending offer and returns 201", async () => {
    const createdOffer = {
      id: "offer-1",
      cardId: "card-1",
      buyerId: "buyer-1",
      price: 5000, // stored in cents
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
    expect(data.amended).toBe(false); // new offer, not an amendment
    // Price returned in dollars (centsToDollars: 5000 → 50)
    expect(data.offer.price).toBe(50);
    expect(data.offer.status).toBe("pending");

    // Verify the offer was saved with the correct fields
    expect(mockPrisma.offer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cardId: "card-1",
          buyerId: "buyer-1",
          status: "pending",
          paymentIntentId: "pi_1",
          expiresAt: expect.any(Date), // 24h from now
        }),
      })
    );
  });

  // ── Existing accepted offer ───────────────────────────────────────────────

  // What's being tested: the guard against amending an already-accepted offer.
  //
  // If the seller just accepted the buyer's offer, the capture is in flight.
  // The buyer should not be able to replace the offer mid-capture — that would
  // result in a new PI replacing the one being charged, breaking the transaction.

  it("returns 409 when buyer already has an accepted offer (mid-capture)", async () => {
    // Override default: buyer already has an accepted offer on this card
    mockPrisma.offer.findFirst.mockResolvedValue({ id: "offer-old", status: "accepted" });

    const res = await POST(postRequest({ cardId: "card-1", price: 50, paymentIntentId: "pi_1" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("accepted offer") });
  });

  // ── Amend existing pending offer ──────────────────────────────────────────

  // What's being tested: the offer amendment flow — buyer changes their price.
  //
  // When a buyer already has a pending offer and submits a new one:
  //   1. The old PI is cancelled (releases the hold on their card for the old amount)
  //   2. The existing offer row is updated in-place with the new price, new PI,
  //      and a fresh 24h expiry (resetting the clock)
  //   3. The response returns amended:true so the frontend knows it was an update
  //
  // Why update in-place instead of creating a new row? It keeps the seller's
  // offer inbox clean — the seller sees one offer per buyer, not a pile of
  // revisions. The amended flag lets the frontend show "Updated offer" in the UI.

  it("cancels the old PI and updates the existing pending offer (amended: true)", async () => {
    // Override default: buyer already has a pending offer with an old PI
    const existingOffer = {
      id: "offer-old",
      status: "pending",
      paymentIntentId: "pi_old",
    };
    mockPrisma.offer.findFirst.mockResolvedValue(existingOffer);

    const updatedOffer = {
      id: "offer-old",
      price: 6000, // new price in cents
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
    expect(data.amended).toBe(true); // flag shows this was an update

    // Old PI cancelled first — releases the old fund hold on the buyer's card
    expect(mockStripeInstance.paymentIntents.cancel).toHaveBeenCalledWith("pi_old");

    // Offer updated with new PI and a fresh 24h expiry
    expect(mockPrisma.offer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "offer-old" },
        data: expect.objectContaining({
          paymentIntentId: "pi_new",
          expiresAt: expect.any(Date),
        }),
      })
    );
  });

  // What's being tested: resilience when the old PI cancel fails during an amend.
  //
  // The old PI might already be cancelled (if it expired on Stripe's side) or
  // might be in a terminal state. In that case cancelling it would throw, but
  // the amendment should still go through — the old hold is already gone anyway.
  //
  // The route swallows the cancel error (logs a warning) and continues with
  // the DB update. This test verifies the route still returns 200 and calls
  // offer.update even when the PI cancel throws.

  it("continues amending even if cancelling old PI fails (logs warning)", async () => {
    // Override default: buyer has an existing pending offer
    mockPrisma.offer.findFirst.mockResolvedValue({
      id: "offer-old",
      status: "pending",
      paymentIntentId: "pi_old",
    });
    // Old PI cancel throws — already in terminal state
    mockStripeInstance.paymentIntents.cancel.mockRejectedValue(new Error("already cancelled"));
    mockPrisma.offer.update.mockResolvedValue({
      id: "offer-old", price: 6000, message: null, status: "pending",
      paymentIntentId: "pi_new", expiresAt: new Date(),
    });

    // Must not throw — the error is swallowed and the amendment continues
    const res = await POST(
      postRequest({ cardId: "card-1", price: 60, paymentIntentId: "pi_new" })
    );
    expect(res.status).toBe(200);
    // DB update still ran — offer was amended successfully
    expect(mockPrisma.offer.update).toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/offers
// ═════════════════════════════════════════════════════════════════════════════
describe("GET /api/offers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated as buyer-1
    mockGetServerSession.mockResolvedValue({ user: { id: "buyer-1" } });
  });

  // ── Auth ──────────────────────────────────────────────────────────────────

  // What's being tested: the auth gate — all GET endpoints require login.
  //
  // An anonymous user should not be able to see any offer data.

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET(getRequest({ mine: "true" }));
    expect(res.status).toBe(401);
  });

  // What's being tested: the query param requirement.
  //
  // The GET handler supports multiple query modes (myOffer, mine, cardId).
  // If none are provided, the route doesn't know what to return — it should
  // reject with 400 rather than returning all offers in the system.

  it("returns 400 when no recognised query param is provided", async () => {
    const res = await GET(getRequest({})); // no params at all
    expect(res.status).toBe(400);
  });

  // ── Buyer: my offer on a specific card ────────────────────────────────────

  // What's being tested: the buyer fetching their own offer on a specific card.
  //
  // Used by the BuyBox component to show the buyer their current offer status.
  // Query: ?cardId=card-1&myOffer=true
  //
  // The price must be converted from cents (5000) to dollars (50) for the UI.

  it("returns buyer's own offer when cardId + myOffer=true", async () => {
    const offer = { id: "offer-1", price: 5000, status: "pending" };
    mockPrisma.offer.findFirst.mockResolvedValue(offer);

    const res = await GET(getRequest({ cardId: "card-1", myOffer: "true" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    // Price converted from cents to dollars (5000 → 50)
    expect(data.offer.price).toBe(50);
  });

  // What's being tested: the null response when the buyer has no offer yet.
  //
  // If the buyer hasn't made an offer yet, offer.findFirst returns null.
  // The route should return { offer: null } rather than a 404 — the absence
  // of an offer is not an error, just the initial state before the buyer acts.

  it("returns null when buyer has no offer on the card", async () => {
    mockPrisma.offer.findFirst.mockResolvedValue(null); // no offer yet

    const res = await GET(getRequest({ cardId: "card-1", myOffer: "true" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.offer).toBeNull();
  });

  // ── Seller: all offers on their card ─────────────────────────────────────

  // What's being tested: the seller viewing all pending offers on their card.
  //
  // Used by the SellerOffersDialog. The route checks that the authenticated
  // user is the card's owner before returning the full list of offers.
  // Each offer must include buyer details and have its price converted to dollars.

  it("returns all offers for the seller who owns the card", async () => {
    // Authenticate as the card owner
    mockGetServerSession.mockResolvedValue({ user: { id: "seller-1" } });
    mockPrisma.card.findUnique.mockResolvedValue({ ownerId: "seller-1" });
    mockPrisma.offer.findMany.mockResolvedValue([
      { id: "offer-1", price: 5000, status: "pending", buyer: { id: "buyer-1", username: "bob", email: "bob@x.com" } },
    ]);

    const res = await GET(getRequest({ cardId: "card-1" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.offers).toHaveLength(1);
    // Price converted from cents to dollars (5000 → 50)
    expect(data.offers[0].price).toBe(50);
  });

  // What's being tested: the ownership guard for the seller view.
  //
  // A buyer (or any non-owner) must not be able to see all offers on someone
  // else's card. Without this check, any logged-in user could scrape all
  // offers and price data for any card.

  it("returns 403 when a non-owner tries to view offers on a card", async () => {
    // Authenticated as buyer-1 but card is owned by seller-1
    mockPrisma.card.findUnique.mockResolvedValue({ ownerId: "seller-1" });

    const res = await GET(getRequest({ cardId: "card-1" }));
    expect(res.status).toBe(403);
  });

  // What's being tested: the 404 response when the card doesn't exist.
  //
  // If the card was deleted, the seller view should return 404.
  // (The myOffer=true path doesn't need a 404 — a null offer is the right response.)

  it("returns 404 when the card does not exist (seller view)", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "seller-1" } });
    mockPrisma.card.findUnique.mockResolvedValue(null);

    const res = await GET(getRequest({ cardId: "missing-card" }));
    expect(res.status).toBe(404);
  });

  // ── Buyer: full offer history ─────────────────────────────────────────────

  // What's being tested: the buyer fetching all their offers across all cards.
  //
  // Used by the buyer's offer history page. Query: ?mine=true
  //
  // Returns all offers the authenticated buyer has placed — regardless of status
  // (pending, expired, rejected, paid). All prices must be converted to dollars.
  // The card details (title, imageUrls, etc.) are included for display in the UI.

  it("returns all of the buyer's offers when mine=true", async () => {
    mockPrisma.offer.findMany.mockResolvedValue([
      {
        id: "offer-1", price: 5000, status: "pending",
        card: { id: "card-1", title: "Charizard", imageUrls: [], condition: "NM", forSale: true, owner: { id: "seller-1", username: "alice", email: "a@x.com" } },
      },
      {
        id: "offer-2", price: 3000, status: "expired",
        card: { id: "card-2", title: "Blastoise", imageUrls: [], condition: "LP", forSale: false, owner: { id: "seller-1", username: "alice", email: "a@x.com" } },
      },
    ]);

    const res = await GET(getRequest({ mine: "true" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.offers).toHaveLength(2);
    // Prices converted from cents to dollars
    expect(data.offers[0].price).toBe(50);  // 5000 → 50
    expect(data.offers[1].price).toBe(30);  // 3000 → 30
  });
});
