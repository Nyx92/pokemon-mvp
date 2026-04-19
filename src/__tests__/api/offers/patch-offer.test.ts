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
 * 2. vi.mock() factories run second — registers the fakes. Note the extra mock
 *    for "@/lib/offerExpiry" — the PATCH handler imports expireOffer to check
 *    whether the offer expired before the cron ran.
 *
 * 3. import { PATCH } runs last — the real handler is loaded with fakes in place.
 *
 * What this endpoint does:
 *   PATCH /api/offers/[id] handles two actions, controlled by { action } in the body:
 *
 *   "accept" — seller accepts the buyer's offer:
 *     1. Check on-demand expiry (if expiresAt passed, expire now and return 409)
 *     2. Check card is not reserved by an active Buy Now checkout (return 409)
 *     3. Capture the Stripe PI (charges the buyer's card)
 *     4. Inside a DB transaction:
 *        a. Create a PAID order record
 *        b. Mark the offer as "paid" and link it to the order
 *        c. Archive ALL offers on the card (so other buyers' offers are closed)
 *        d. Transfer card ownership to the buyer
 *        e. Create a CardTransaction audit record
 *
 *   "reject" — seller declines the buyer's offer:
 *     1. Cancel the Stripe PI (releases the hold on the buyer's card)
 *     2. Mark the offer as "rejected" in the DB
 *     (PI cancel failure is tolerated — offer is still rejected in the DB)
 */

// ── STEP 1: Create the mock objects ──────────────────────────────────────────

const mockStripeInstance = vi.hoisted(() => ({
  paymentIntents: {
    capture: vi.fn(), // accept: captures the held funds → actual charge
    cancel: vi.fn(),  // reject: releases the hold → no charge
  },
}));

// mockTx is the fake Prisma client passed into the $transaction callback.
// It mirrors the real tx client but every method is a vi.fn() we control.
const mockTx = vi.hoisted(() => ({
  order: { create: vi.fn() },
  offer: { update: vi.fn(), updateMany: vi.fn() },
  card: { update: vi.fn(), findUnique: vi.fn() },
  cardTransaction: { create: vi.fn() },
}));

const mockPrisma = vi.hoisted(() => ({
  card: { findUnique: vi.fn() }, // used by the Buy Now reservation guard (step 3)
  offer: { findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

// mockExpireOffer replaces the real expireOffer import. The PATCH handler calls
// it when the offer's expiresAt has already passed (on-demand expiry guard).
const mockExpireOffer = vi.hoisted(() => vi.fn());

// ── STEP 2: Register the fakes ────────────────────────────────────────────────

vi.mock("stripe", () => ({ default: vi.fn(() => mockStripeInstance) }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
// expireOffer is mocked separately — it's the function the PATCH handler calls
// when it detects the offer is expired and the cron hasn't cleaned it up yet.
vi.mock("@/lib/offerExpiry", () => ({ expireOffer: mockExpireOffer }));

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
  card: { id: "card-1", ownerId: "seller-1", title: "Charizard" },
};

const MOCK_ORDER = { id: "order-1" };

// ═════════════════════════════════════════════════════════════════════════════
// PATCH /api/offers/[id] — ACCEPT
// ═════════════════════════════════════════════════════════════════════════════
describe("PATCH /api/offers/[id] — accept", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated as the card's seller
    mockGetServerSession.mockResolvedValue({ user: { id: "seller-1" } });
    // Default: offer is pending and valid
    mockPrisma.offer.findUnique.mockResolvedValue(PENDING_OFFER);
    // Default: card is NOT reserved (no active Buy Now checkout in progress)
    mockPrisma.card.findUnique.mockResolvedValue({ reservedById: null, reservedUntil: null });
    // Default: Stripe PI capture succeeds
    mockStripeInstance.paymentIntents.capture.mockResolvedValue({
      id: "pi_123",
      status: "succeeded",
    });

    // Default: $transaction runs the callback with the mock tx client.
    // Each method on mockTx is pre-set to succeed so tests only override
    // the specific parts they want to control.
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      mockTx.order.create.mockResolvedValue(MOCK_ORDER);
      mockTx.offer.update.mockResolvedValue({});
      mockTx.offer.updateMany.mockResolvedValue({ count: 1 });
      mockTx.card.update.mockResolvedValue({});
      mockTx.card.findUnique.mockResolvedValue({ tcgPlayerId: "xy1-4" });
      mockTx.cardTransaction.create.mockResolvedValue({});
      return fn(mockTx);
    });
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  // What's being tested: the full accept flow — all 6 steps that must happen
  // when a seller accepts an offer.
  //
  // This is the most important test in the suite. It verifies the complete
  // transaction is wired up correctly:
  //
  //   Step 1 — PI captured: Stripe charges the buyer's card (not just holds it)
  //   Step 2 — Order created: a PAID order is created linking card, buyer, seller
  //   Step 3 — Offer updated: the offer row is marked "paid" and linked to the order
  //   Step 4 — All offers archived: every other offer on the card is closed (so
  //             other buyers are notified the card sold and can't be accepted after)
  //   Step 5 — Card transferred: card.ownerId changes to the buyer, forSale=false,
  //             reservation fields cleared
  //   Step 6 — CardTransaction created: immutable audit record of the sale
  //
  // All 6 steps are inside a single DB transaction so if any step fails,
  // all DB changes roll back and the buyer is not double-charged.

  it("captures PI, creates order (PAID), archives all offers, transfers card, creates transaction record", async () => {
    const res = await PATCH(patchRequest({ action: "accept" }), { params: { id: "offer-1" } });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);

    // 1. Stripe PI captured — funds move from hold to actual charge
    expect(mockStripeInstance.paymentIntents.capture).toHaveBeenCalledWith("pi_123");

    // 2. Order created with PAID status and all sale details
    expect(mockTx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cardId: "card-1",
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

    // 4. ALL offers on the card archived — so other buyers' pending offers are
    //    closed and new offers can't be placed on a card that's no longer for sale
    expect(mockTx.offer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cardId: "card-1", archivedAt: null },
        data: { archivedAt: expect.any(Date) },
      })
    );

    // 5. Card ownership transferred: buyer becomes the new owner, card unlisted
    expect(mockTx.card.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "card-1" },
        data: expect.objectContaining({
          ownerId: "buyer-1",
          forSale: false,
          reservedById: null,
          reservedUntil: null,
          reservedCheckoutSessionId: null,
        }),
      })
    );

    // 6. CardTransaction audit record created — immutable record of the sale
    //    stripeEventId uses the PI id as the idempotency key (prevents duplicates)
    expect(mockTx.cardTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: "order-1",
          cardId: "card-1",
          sellerId: "seller-1",
          buyerId: "buyer-1",
          amount: 5000,
          currency: "sgd",
          stripeEventId: "pi_123",
        }),
      })
    );
  });

  // ── Auth / ownership ──────────────────────────────────────────────────────

  // What's being tested: the auth gate on accept.
  //
  // Only authenticated users can accept offers. An anonymous request must
  // be rejected before any Stripe or DB operation.

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await PATCH(patchRequest({ action: "accept" }), { params: { id: "offer-1" } });
    expect(res.status).toBe(401);
  });

  // What's being tested: the ownership guard — only the card's seller can accept.
  //
  // A buyer must not be able to accept their own offer (that would let them
  // bypass the seller entirely and mark the card as sold without seller consent).
  // The route checks that the authenticated user is the card's ownerId.

  it("returns 403 when a non-owner tries to accept", async () => {
    // Authenticate as the buyer, not the seller who owns the card
    mockGetServerSession.mockResolvedValue({ user: { id: "buyer-1" } });
    const res = await PATCH(patchRequest({ action: "accept" }), { params: { id: "offer-1" } });
    expect(res.status).toBe(403);
  });

  // What's being tested: the offer existence check.
  //
  // If the offer id in the URL doesn't exist in the DB, the route returns 404.

  it("returns 404 when offer does not exist", async () => {
    mockPrisma.offer.findUnique.mockResolvedValue(null);
    const res = await PATCH(patchRequest({ action: "accept" }), { params: { id: "offer-x" } });
    expect(res.status).toBe(404);
  });

  // What's being tested: the action validation.
  //
  // The body must contain { action: "accept" } or { action: "reject" }.
  // Any other value (e.g. "delete", "approve") must return 400.

  it("returns 400 when action is not accept or reject", async () => {
    const res = await PATCH(patchRequest({ action: "delete" }), { params: { id: "offer-1" } });
    expect(res.status).toBe(400);
  });

  // ── Terminal states ───────────────────────────────────────────────────────

  // What's being tested: the archived guard.
  //
  // An archived offer means the card already sold (to this or another buyer).
  // The seller must not be able to accept an offer on a card they no longer own.
  // archivedAt is set on ALL offers when any one offer is accepted (step 4 above).

  it("returns 409 when offer is archived (already sold)", async () => {
    // Override default: offer has been archived (card sold)
    mockPrisma.offer.findUnique.mockResolvedValue({ ...PENDING_OFFER, archivedAt: new Date() });
    const res = await PATCH(patchRequest({ action: "accept" }), { params: { id: "offer-1" } });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "Offer is archived" });
  });

  // What's being tested: the status guard for already-rejected offers.
  //
  // If the seller already rejected this offer, they must not be able to
  // accidentally accept it again. Only "pending" offers can be accepted.

  it("returns 409 when offer is already rejected (not pending)", async () => {
    mockPrisma.offer.findUnique.mockResolvedValue({ ...PENDING_OFFER, status: "rejected" });
    const res = await PATCH(patchRequest({ action: "accept" }), { params: { id: "offer-1" } });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "Offer is not pending" });
  });

  // What's being tested: the status guard for already-paid offers.
  //
  // A "paid" offer means the PI was already captured and the card already
  // transferred. Accepting again would attempt a double-capture on Stripe.

  it("returns 409 when offer is already paid", async () => {
    mockPrisma.offer.findUnique.mockResolvedValue({ ...PENDING_OFFER, status: "paid" });
    const res = await PATCH(patchRequest({ action: "accept" }), { params: { id: "offer-1" } });
    expect(res.status).toBe(409);
  });

  // What's being tested: the PI guard — can't accept an offer with no PI.
  //
  // Every pending offer should have a paymentIntentId (the PI was created in
  // the payment-intent step). If it's null, there's nothing to capture and
  // the seller would accept an offer that can never collect payment.

  it("returns 409 when offer has no paymentIntentId", async () => {
    mockPrisma.offer.findUnique.mockResolvedValue({ ...PENDING_OFFER, paymentIntentId: null });
    const res = await PATCH(patchRequest({ action: "accept" }), { params: { id: "offer-1" } });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "No payment intent found for this offer" });
  });

  // ── Buy Now reservation guard ─────────────────────────────────────────────

  // What's being tested: the guard that prevents accepting an offer while a
  // Buy Now checkout is in progress for the same card.
  //
  // The checkout flow sets reservedById + reservedUntil on the card but leaves
  // forSale: true until the Stripe webhook fires. Without this guard, a seller
  // could accept an offer, transfer the card to the offer buyer, and then the
  // webhook would try to transfer it again to the Buy Now buyer — who already paid.
  //
  // This check runs BEFORE the PI capture so if the card is reserved, no money
  // moves and the seller just gets a 409 telling them checkout is in progress.

  it("returns 409 when card is actively reserved by a Buy Now checkout", async () => {
    // Override default: card has an active reservation (Buy Now in progress)
    mockPrisma.card.findUnique.mockResolvedValue({
      reservedById: "other-buyer",
      reservedUntil: new Date(Date.now() + 60_000), // expires 1 minute from now
    });

    const res = await PATCH(patchRequest({ action: "accept" }), { params: { id: "offer-1" } });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "Card is currently reserved by a pending checkout" });

    // PI capture must NOT be called — money must not move when card is reserved
    expect(mockStripeInstance.paymentIntents.capture).not.toHaveBeenCalled();
  });

  // ── On-demand expiry guard ─────────────────────────────────────────────────

  // What's being tested: the gap between offer expiry and the cron job running.
  //
  // Offers expire after 24 hours, but the cron only runs every 5 minutes. In
  // that window, the offer is technically expired but still marked "pending" in
  // the DB. Without this guard, a seller could accept an expired offer —
  // capturing a PI that Stripe may have already auto-cancelled.
  //
  // The PATCH handler solves this by checking expiresAt on every accept request:
  //   if (offer.expiresAt < now) → call expireOffer immediately, return 409
  //
  // This test sets expiresAt to 1 minute ago (simulating the cron gap) and
  // verifies that:
  //   1. expireOffer is called (cleans up PI + marks DB expired)
  //   2. The route returns 409 with "This offer has expired"
  //   3. PI capture is never called (expired offer cannot be accepted)

  it("expires the offer immediately if expiresAt is in the past (cron hasn't run yet)", async () => {
    // Override default: offer expired 1 minute ago but cron hasn't run yet
    mockPrisma.offer.findUnique.mockResolvedValue({
      ...PENDING_OFFER,
      expiresAt: new Date(Date.now() - 60_000), // 1 minute ago
    });
    mockExpireOffer.mockResolvedValue(undefined);

    const res = await PATCH(patchRequest({ action: "accept" }), { params: { id: "offer-1" } });
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toBe("This offer has expired");

    // expireOffer must be called — cancels PI + marks DB expired on the spot
    expect(mockExpireOffer).toHaveBeenCalledWith({
      id: "offer-1",
      paymentIntentId: "pi_123",
    });

    // PI capture must NOT be called — expired offers cannot be accepted
    expect(mockStripeInstance.paymentIntents.capture).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PATCH /api/offers/[id] — REJECT
// ═════════════════════════════════════════════════════════════════════════════
describe("PATCH /api/offers/[id] — reject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated as seller
    mockGetServerSession.mockResolvedValue({ user: { id: "seller-1" } });
    // Default: offer is pending and valid
    mockPrisma.offer.findUnique.mockResolvedValue(PENDING_OFFER);
    // Default: PI cancel succeeds
    mockStripeInstance.paymentIntents.cancel.mockResolvedValue({});
    // Default: offer update succeeds
    mockPrisma.offer.update.mockResolvedValue({ ...PENDING_OFFER, status: "rejected" });
  });

  // What's being tested: the full successful reject flow.
  //
  // The seller declines the offer. Two things must happen:
  //   1. The Stripe PI is cancelled — releases the hold on the buyer's card.
  //      The buyer's funds are never charged.
  //   2. The offer is marked "rejected" in the DB so the buyer can see the outcome.
  //
  // The order matters: cancel first, then update the DB. If we marked it
  // rejected first and the PI cancel failed, the buyer would see "rejected"
  // but their card would still have a hold on it.

  it("cancels the PI and marks the offer rejected", async () => {
    const res = await PATCH(patchRequest({ action: "reject" }), { params: { id: "offer-1" } });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);

    // PI cancelled — hold on buyer's card released, no charge
    expect(mockStripeInstance.paymentIntents.cancel).toHaveBeenCalledWith("pi_123");

    // Offer marked rejected in DB
    expect(mockPrisma.offer.update).toHaveBeenCalledWith({
      where: { id: "offer-1" },
      data: { status: "rejected" },
    });
  });

  // What's being tested: resilience when the PI cancel fails during reject.
  //
  // The PI might already be cancelled (auto-cancelled by Stripe when the 24h
  // authorisation window expired). In that case, cancelling it again throws,
  // but the DB update should still run — the hold is already gone so it's
  // safe to mark the offer rejected.
  //
  // This is different from the accept path, where a PI cancel failure would be
  // dangerous. In the reject path, a failed cancel just means the hold is
  // already gone — the buyer's card is already free.

  it("still marks offer rejected even if PI cancel fails (PI may already be cancelled)", async () => {
    // Override default: PI cancel throws (already in terminal state)
    mockStripeInstance.paymentIntents.cancel.mockRejectedValue(new Error("already cancelled"));

    const res = await PATCH(patchRequest({ action: "reject" }), { params: { id: "offer-1" } });

    // Route must still return 200 — PI failure is tolerated on reject
    expect(res.status).toBe(200);
    // DB update still runs — offer is correctly marked rejected
    expect(mockPrisma.offer.update).toHaveBeenCalledWith({
      where: { id: "offer-1" },
      data: { status: "rejected" },
    });
  });
});
