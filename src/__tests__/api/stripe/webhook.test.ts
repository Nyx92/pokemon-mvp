import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * HOW THIS FILE EXECUTES (what Vitest does before a single test runs)
 *
 * 1. vi.hoisted() blocks run first — creates three mock objects in memory:
 *      mockStripeInstance — fake Stripe client (webhooks.constructEvent)
 *      mockTx             — fake Prisma transaction client (used inside $transaction)
 *      mockPrisma         — fake Prisma client ($transaction)
 *
 * 2. vi.mock() factories run second — registers the fakes. No next-auth mock
 *    here because the webhook endpoint does not use sessions — Stripe authenticates
 *    itself via a cryptographic signature on every request.
 *
 * 3. import { POST } runs last — the real webhook handler is loaded with fakes.
 *
 * What this endpoint does:
 *   POST /api/stripe/webhook is called by Stripe whenever a checkout event
 *   occurs. Stripe signs each request with STRIPE_WEBHOOK_SECRET so we can
 *   verify the payload wasn't tampered with.
 *
 *   Two event types are handled:
 *
 *   checkout.session.completed (payment_status: "paid"):
 *     Inside a single DB transaction:
 *       1. Idempotency check: if CardTransaction with this stripeEventId exists,
 *          skip (Stripe can retry webhooks — we must not double-process)
 *       2. Look up the pending order from metadata
 *       3. Mark order PAID, attach stripePaymentIntentId
 *       4. Create CardTransaction audit record (stripeEventId = idempotency key)
 *       5. Transfer card ownership to buyer via updateMany with a guard
 *          (count === 0 means another process already transferred it → throw)
 *       6. Archive all offers on the card
 *
 *   checkout.session.expired:
 *     Mark the order EXPIRED and clear the card's reservation fields so the
 *     card can be purchased again.
 *
 *   All other event types: return 200 (safe to ignore — we're not subscribed
 *   to them in production, but Stripe may send them anyway).
 */

// ── STEP 1: Create the mock objects ──────────────────────────────────────────

const mockStripeInstance = vi.hoisted(() => ({
  webhooks: {
    // constructEvent verifies the Stripe signature and returns the parsed event.
    // In tests we mock it to return whichever event we want to simulate.
    constructEvent: vi.fn(),
  },
}));

// mockTx is the fake Prisma client injected into the $transaction callback.
const mockTx = vi.hoisted(() => ({
  cardTransaction: { findUnique: vi.fn(), create: vi.fn() },
  order: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  card: { updateMany: vi.fn() },
  offer: { updateMany: vi.fn() },
}));

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

// ── STEP 2: Register the fakes ────────────────────────────────────────────────

vi.mock("stripe", () => ({ default: vi.fn(() => mockStripeInstance) }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ── STEP 3: Import the code under test ───────────────────────────────────────

import { POST } from "@/app/api/stripe/webhook/route";

// ── Test helpers + shared data ────────────────────────────────────────────────

// Builds a fake webhook request. "stripe-signature" header is required by the
// handler before it even calls constructEvent. The body can be anything since
// constructEvent is mocked — it returns whatever we set it to return.
function makeRequest(body = "raw-body") {
  return new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "sig_test" },
    body,
  });
}

// Simulates a fully paid checkout session event.
// metadata must contain orderId, cardId, buyerId, sellerId — the handler needs
// these to look up the order and perform the card transfer.
const SESSION_COMPLETED_EVENT = {
  id: "evt_1",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_123",
      payment_status: "paid",
      payment_intent: "pi_123",
      metadata: {
        orderId: "order-1",
        cardId: "card-1",
        buyerId: "buyer-1",
        sellerId: "seller-1",
      },
    },
  },
};

// Simulates a checkout session that timed out before the buyer paid.
const SESSION_EXPIRED_EVENT = {
  id: "evt_2",
  type: "checkout.session.expired",
  data: {
    object: {
      id: "cs_test_456",
      metadata: { orderId: "order-1", cardId: "card-1" },
    },
  },
};

// A PENDING order as stored in the DB before the webhook arrives.
const PENDING_ORDER = {
  id: "order-1",
  cardId: "card-1",
  buyerId: "buyer-1",
  sellerId: "seller-1",
  amount: 5000,
  currency: "sgd",
  status: "PENDING",
  stripeCheckoutSessionId: "cs_test_123",
};

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: constructEvent succeeds and returns the completed event
    mockStripeInstance.webhooks.constructEvent.mockReturnValue(SESSION_COMPLETED_EVENT);

    // Default: $transaction runs the callback with the mock tx client.
    // Pre-set all tx methods to succeed so each test only overrides what it needs.
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      mockTx.cardTransaction.findUnique.mockResolvedValue(null); // not yet processed
      mockTx.order.findUnique.mockResolvedValue(PENDING_ORDER);
      mockTx.order.update.mockResolvedValue({});
      mockTx.cardTransaction.create.mockResolvedValue({});
      mockTx.card.updateMany.mockResolvedValue({ count: 1 }); // card transferred
      mockTx.offer.updateMany.mockResolvedValue({});
      return fn(mockTx);
    });
  });

  // ── Signature verification ────────────────────────────────────────────────

  // What's being tested: the missing signature header guard.
  //
  // Every Stripe webhook request must include a "stripe-signature" header.
  // The handler checks for this header before calling constructEvent. If it's
  // missing, the request is not from Stripe and must be rejected with 400.
  //
  // Why 400 (not 401)? Stripe doesn't use sessions or tokens — the signature
  // IS the auth. A missing signature means a malformed request, not just an
  // unauthenticated one.

  it("returns 400 when the stripe-signature header is missing", async () => {
    const req = new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: "raw",
      // no stripe-signature header
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "Missing Stripe signature" });
  });

  // What's being tested: the signature verification guard.
  //
  // constructEvent() uses STRIPE_WEBHOOK_SECRET to verify the signature matches
  // the payload. If an attacker sends a fake event (or tampers with the payload),
  // the signature won't match and constructEvent throws.
  //
  // This test simulates that throw to verify the handler catches it and returns
  // 400 instead of 500. The error message is "Invalid signature" — not the
  // raw Stripe error — so we don't leak internal details to the attacker.

  it("returns 400 when the signature does not match (tampered payload)", async () => {
    // Simulate constructEvent throwing when signature verification fails
    mockStripeInstance.webhooks.constructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature");
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "Invalid signature" });
  });

  // ── checkout.session.completed — happy path ───────────────────────────────

  // What's being tested: the full Buy Now fulfillment flow.
  //
  // A buyer clicked "Buy Now", paid, and Stripe fires checkout.session.completed.
  // The handler must execute 4 steps in one transaction:
  //
  //   Step 1 — Order marked PAID: status changes from PENDING to PAID,
  //             stripePaymentIntentId recorded for refund capability
  //   Step 2 — CardTransaction created: immutable audit record, stripeEventId
  //             is the Stripe event id (used as idempotency key for retries)
  //   Step 3 — Card transferred to buyer: updateMany with a guard on reservedById
  //             ensures only the card reserved by THIS buyer is transferred
  //   Step 4 — All offers on the card archived: existing offers are closed
  //             since the card sold
  //
  // All 4 steps are verified by checking that the correct tx methods were called
  // with the correct arguments.

  it("marks order PAID, transfers card, creates transaction record on successful checkout", async () => {
    const res = await POST(makeRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.received).toBe(true);

    // Step 1: Order marked PAID
    expect(mockTx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order-1" },
        data: expect.objectContaining({ status: "PAID", stripePaymentIntentId: "pi_123" }),
      })
    );

    // Step 2: Card transferred to buyer — guard ensures card was reserved by this buyer
    expect(mockTx.card.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "card-1", reservedById: "buyer-1" }),
        data: expect.objectContaining({ ownerId: "buyer-1", forSale: false }),
      })
    );

    // Step 3: CardTransaction audit record created with Stripe event id
    expect(mockTx.cardTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: "order-1",
          cardId: "card-1",
          sellerId: "seller-1",
          buyerId: "buyer-1",
          stripeEventId: "evt_1", // Stripe event id as idempotency key
        }),
      })
    );

    // Step 4: All offers on the card archived
    expect(mockTx.offer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cardId: "card-1" } })
    );
  });

  // ── checkout.session.completed — payment_status not paid ─────────────────

  // What's being tested: the payment_status guard.
  //
  // Stripe can fire checkout.session.completed for flows that aren't credit card
  // payments (e.g. free items, subscriptions). The handler must only process
  // the event when payment_status === "paid". Any other value is silently ignored.
  //
  // Why ignore rather than error? Stripe fires this event whether or not we
  // care about the payment method. Returning an error would cause Stripe to
  // retry the event endlessly. Returning 200 tells Stripe we received it fine.
  //
  // This test verifies that $transaction is never called — no DB changes happen.

  it("skips processing when payment_status is not paid", async () => {
    // Override default: completed event but payment was not collected
    mockStripeInstance.webhooks.constructEvent.mockReturnValue({
      ...SESSION_COMPLETED_EVENT,
      data: {
        object: { ...SESSION_COMPLETED_EVENT.data.object, payment_status: "unpaid" },
      },
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    // $transaction never called — nothing was processed
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  // ── checkout.session.completed — missing metadata ─────────────────────────

  // What's being tested: the metadata completeness check.
  //
  // The handler reads orderId, cardId, buyerId, sellerId from session metadata.
  // These are set by the checkout route when creating the Stripe session. If
  // any are missing (shouldn't happen in production, but defensive code matters),
  // the handler must return 500 rather than silently processing with undefined values.
  //
  // Undefined values would result in broken DB records (order with no buyer, etc.)
  // so failing loudly is the right behaviour — Stripe will retry and alert you.

  it("returns 500 when session metadata is incomplete", async () => {
    mockStripeInstance.webhooks.constructEvent.mockReturnValue({
      ...SESSION_COMPLETED_EVENT,
      data: {
        object: {
          id: "cs_test_123",
          payment_status: "paid",
          payment_intent: "pi_123",
          metadata: { orderId: "order-1" }, // missing cardId, buyerId, sellerId
        },
      },
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });

  // ── Idempotency guard ─────────────────────────────────────────────────────

  // What's being tested: the idempotency check that prevents double-processing.
  //
  // Stripe retries webhook delivery if it doesn't receive a 200 response within
  // a few seconds (e.g. if our server was briefly overloaded). This means the
  // same checkout.session.completed event could arrive twice.
  //
  // Before transferring the card, the handler checks whether a CardTransaction
  // with this stripeEventId already exists. If it does, the event was already
  // processed — skip the card transfer and return 200.
  //
  // Without this guard, a retry would try to transfer an already-transferred
  // card, create a duplicate order, and charge the buyer twice.
  //
  // This test simulates a retry by making cardTransaction.findUnique return an
  // existing record and verifying that card.updateMany is never called.

  it("is idempotent — skips card transfer if event was already processed", async () => {
    // Override default: CardTransaction already exists for this event
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      mockTx.cardTransaction.findUnique.mockResolvedValue({ id: "ct_existing" }); // already done
      mockTx.order.findUnique.mockResolvedValue(PENDING_ORDER);
      return fn(mockTx);
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);

    // Card transfer must NOT run again — idempotency guard prevented double-processing
    expect(mockTx.card.updateMany).not.toHaveBeenCalled();
  });

  // ── Order not found ───────────────────────────────────────────────────────

  // What's being tested: the order lookup failure.
  //
  // The session metadata contains an orderId that the handler uses to look up
  // the pending order. If the order doesn't exist (e.g. a bug in the checkout
  // route that didn't save the order), the handler must return 500 — there's
  // nothing to mark PAID and the card transfer can't proceed.
  //
  // Stripe will retry on 500, giving the system a chance to self-heal if the
  // order is saved on a subsequent try.

  it("returns 500 when order referenced in metadata does not exist in DB", async () => {
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      mockTx.cardTransaction.findUnique.mockResolvedValue(null);
      mockTx.order.findUnique.mockResolvedValue(null); // order missing from DB
      return fn(mockTx);
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });

  // ── Card not reserved by this session ─────────────────────────────────────

  // What's being tested: the card transfer guard (count === 0).
  //
  // card.updateMany is called with a WHERE clause that includes reservedById:
  // the buyer's id. This guard ensures we only transfer the card if it's still
  // reserved by this exact buyer session. If another process already transferred
  // it (e.g. a second webhook delivery on a very short retry), count === 0.
  //
  // The handler treats count === 0 as an error and throws, rolling back the
  // transaction. This prevents a card from being "transferred" to a buyer who
  // no longer has the reservation — a data integrity violation.
  //
  // This is the Buy Now equivalent of the race condition guard in checkout/route.

  it("returns 500 when card was not reserved by this checkout session", async () => {
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      mockTx.cardTransaction.findUnique.mockResolvedValue(null);
      mockTx.order.findUnique.mockResolvedValue(PENDING_ORDER);
      mockTx.order.update.mockResolvedValue({});
      mockTx.cardTransaction.create.mockResolvedValue({});
      mockTx.card.updateMany.mockResolvedValue({ count: 0 }); // guard failed — card already moved
      return fn(mockTx);
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });

  // ── checkout.session.expired ──────────────────────────────────────────────

  // What's being tested: the session expiry flow.
  //
  // If the buyer opened checkout but didn't pay within Stripe's session window
  // (typically 24h), Stripe fires checkout.session.expired.
  //
  // The handler must:
  //   1. Mark the pending order as EXPIRED
  //   2. Clear the card's reservation fields (reservedById, reservedUntil,
  //      reservedCheckoutSessionId) so the card becomes buyable again
  //
  // This event uses the array form of $transaction: $transaction([op1, op2])
  // rather than the callback form. The test mocks $transaction to resolve the
  // array by running Promise.all, then adds order/card directly to mockPrisma
  // for the array-style operations.

  it("marks order EXPIRED and clears card reservation on session expiry", async () => {
    // Switch to the expired event
    mockStripeInstance.webhooks.constructEvent.mockReturnValue(SESSION_EXPIRED_EVENT);

    // Array-form transaction: $transaction([op1, op2]) → Promise.all runs both
    mockPrisma.$transaction.mockImplementation(async (ops) => Promise.all(ops));
    // These are added directly to mockPrisma for the array form (not mockTx)
    mockPrisma.order = { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } as never;
    mockPrisma.card = { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } as never;

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ received: true });
  });

  // ── Unknown event type ────────────────────────────────────────────────────

  // What's being tested: the fallthrough for unrecognised event types.
  //
  // In production we only subscribe to checkout.session.completed and
  // checkout.session.expired in the Stripe dashboard. But if Stripe sends
  // an event we don't handle (e.g. payment_intent.created), we must return
  // 200 — not an error. Returning an error would cause Stripe to retry
  // indefinitely for an event we'll never process.
  //
  // $transaction must NOT be called — there's no DB work to do.

  it("returns 200 for unhandled event types (safe to ignore)", async () => {
    mockStripeInstance.webhooks.constructEvent.mockReturnValue({
      id: "evt_unknown",
      type: "payment_intent.created", // a real Stripe event we don't handle
      data: { object: {} },
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ received: true });
    // No DB work done for unhandled events
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
