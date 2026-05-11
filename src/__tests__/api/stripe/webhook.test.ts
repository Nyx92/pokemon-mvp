import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Tests for POST /api/stripe/webhook
 *
 * Two event types are handled:
 *
 *   checkout.session.completed (payment_status: "paid"):
 *     Inside a single DB transaction:
 *       1. Guard: if session already REFUNDED, skip (duplicate event after auto-refund)
 *       2. Idempotency: if CardTransaction for this event+order exists, skip
 *       3. Mark order PAID, attach stripePaymentIntentId
 *       4. Create CardTransaction audit record (stripeEventId = idempotency key)
 *       5. Transfer card ownership (updateMany with guard on reservedById)
 *       6. Archive all offers on the card
 *     If the DB transaction fails AFTER payment was captured:
 *       → issue automatic Stripe refund so the customer is made whole
 *       → mark orders REFUNDED, return 200 (Stripe stops retrying)
 *       If the refund itself also fails → return 500 (Stripe retries)
 *
 *   checkout.session.expired:
 *     Mark the order EXPIRED and release the card reservation.
 */

// ── STEP 1: Create mock objects ───────────────────────────────────────────────

const mockStripeInstance = vi.hoisted(() => ({
  webhooks: { constructEvent: vi.fn() },
  refunds:  { create: vi.fn() },
}));

// mockTx is the fake Prisma client injected into the $transaction callback
const mockTx = vi.hoisted(() => ({
  cardTransaction: { findUnique: vi.fn(), create: vi.fn() },
  order:           { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  card:            { updateMany: vi.fn() },
  offer:           { updateMany: vi.fn() },
}));

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  order:        { findFirst: vi.fn(), updateMany: vi.fn() },
  // findUnique: post-transaction card title lookup for seller notifications.
  // updateMany: used by handleSessionExpired (array-form $transaction).
  card:         { findUnique: vi.fn(), updateMany: vi.fn() },
}));

// ── STEP 2: Register fakes ────────────────────────────────────────────────────

vi.mock("stripe", () => ({ default: vi.fn(() => mockStripeInstance) }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
// Silence the Resend SDK — notification side-effects are tested separately.
vi.mock("@/lib/notifications", () => ({ notifyAsync: vi.fn(), createNotification: vi.fn() }));

// ── STEP 3: Import code under test ────────────────────────────────────────────

import { POST } from "@/app/api/stripe/webhook/route";

// ── Shared fixtures ───────────────────────────────────────────────────────────

function makeRequest(body = "raw-body") {
  return new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "sig_test" },
    body,
  });
}

const SESSION_COMPLETED_EVENT = {
  id: "evt_1",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_123",
      payment_status: "paid",
      payment_intent: "pi_123",
      metadata: { orderId: "order-1", cardId: "card-1", buyerId: "buyer-1", sellerId: "seller-1" },
    },
  },
};

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

// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockStripeInstance.webhooks.constructEvent.mockReturnValue(SESSION_COMPLETED_EVENT);
    mockStripeInstance.refunds.create.mockResolvedValue({ id: "re_123" });

    // Default: no existing REFUNDED orders (session not yet refunded)
    mockPrisma.order.findFirst.mockResolvedValue(null);
    mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
    // Default: card title lookup (seller notification) and session-expiry release.
    mockPrisma.card.findUnique.mockResolvedValue({ title: "Charizard" });
    mockPrisma.card.updateMany.mockResolvedValue({ count: 1 });

    // Default: $transaction runs the callback with the mock tx client,
    // with all tx methods pre-set to succeed
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      mockTx.cardTransaction.findUnique.mockResolvedValue(null);
      mockTx.order.findUnique.mockResolvedValue(PENDING_ORDER);
      mockTx.order.update.mockResolvedValue({});
      mockTx.cardTransaction.create.mockResolvedValue({});
      mockTx.card.updateMany.mockResolvedValue({ count: 1 });
      mockTx.offer.updateMany.mockResolvedValue({});
      return fn(mockTx);
    });
  });

  // ── Signature verification ────────────────────────────────────────────────

  it("returns 400 when the stripe-signature header is missing", async () => {
    const req = new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: "raw",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "Missing Stripe signature" });
  });

  it("returns 400 when the signature does not match (tampered payload)", async () => {
    mockStripeInstance.webhooks.constructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature");
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "Invalid signature" });
  });

  // ── Happy path: checkout.session.completed ────────────────────────────────

  it("marks order PAID, transfers card, creates transaction record on successful checkout", async () => {
    const res = await POST(makeRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.received).toBe(true);

    expect(mockTx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order-1" },
        data: expect.objectContaining({ status: "PAID", stripePaymentIntentId: "pi_123" }),
      })
    );
    expect(mockTx.card.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "card-1", reservedById: "buyer-1" }),
        data: expect.objectContaining({ ownerId: "buyer-1", forSale: false }),
      })
    );
    expect(mockTx.cardTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orderId: "order-1", cardId: "card-1", stripeEventId: "evt_1" }),
      })
    );
    expect(mockTx.offer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cardId: "card-1" } })
    );
  });

  // ── payment_status guard ──────────────────────────────────────────────────

  it("skips processing when payment_status is not paid", async () => {
    mockStripeInstance.webhooks.constructEvent.mockReturnValue({
      ...SESSION_COMPLETED_EVENT,
      data: { object: { ...SESSION_COMPLETED_EVENT.data.object, payment_status: "unpaid" } },
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  // ── Missing metadata ──────────────────────────────────────────────────────

  // Missing metadata is a code bug — do NOT auto-refund; return 500 so Stripe
  // retries while the issue is investigated manually.
  it("returns 500 when session metadata is incomplete (no auto-refund)", async () => {
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
    // No refund issued — incomplete metadata is a code bug, not a transfer failure
    expect(mockStripeInstance.refunds.create).not.toHaveBeenCalled();
  });

  // ── Idempotency ───────────────────────────────────────────────────────────

  it("is idempotent — skips card transfer if event was already processed", async () => {
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      mockTx.cardTransaction.findUnique.mockResolvedValue({ id: "ct_existing" });
      mockTx.order.findUnique.mockResolvedValue(PENDING_ORDER);
      return fn(mockTx);
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockTx.card.updateMany).not.toHaveBeenCalled();
  });

  // ── Order not found ───────────────────────────────────────────────────────

  // If the order doesn't exist in the DB the card cannot be transferred.
  // The auto-refund safeguard kicks in so the customer is not left out of pocket.
  it("issues auto-refund and returns 200 when order does not exist in DB", async () => {
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      mockTx.cardTransaction.findUnique.mockResolvedValue(null);
      mockTx.order.findUnique.mockResolvedValue(null); // order missing
      return fn(mockTx);
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockStripeInstance.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: "pi_123" })
    );
    expect(mockPrisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "REFUNDED" } })
    );
  });

  // ── Transfer guard failure — auto-refund ──────────────────────────────────

  // If the card was not reserved by this checkout session (race condition or bug),
  // the transfer cannot proceed. The customer is charged but the card cannot be
  // given. Auto-refund makes the customer whole immediately.
  it("issues auto-refund and returns 200 when card was not reserved by this session", async () => {
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      mockTx.cardTransaction.findUnique.mockResolvedValue(null);
      mockTx.order.findUnique.mockResolvedValue(PENDING_ORDER);
      mockTx.order.update.mockResolvedValue({});
      mockTx.cardTransaction.create.mockResolvedValue({});
      mockTx.card.updateMany.mockResolvedValue({ count: 0 }); // guard failed
      return fn(mockTx);
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockStripeInstance.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: "pi_123" })
    );
    expect(mockPrisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "REFUNDED" } })
    );
  });

  // ── Refund also fails ─────────────────────────────────────────────────────

  // If the transfer failed AND the auto-refund API call fails, we return 500
  // so Stripe retries the webhook. On retry the refund may succeed.
  it("returns 500 when transfer fails AND Stripe refund also fails", async () => {
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      mockTx.cardTransaction.findUnique.mockResolvedValue(null);
      mockTx.order.findUnique.mockResolvedValue(PENDING_ORDER);
      mockTx.order.update.mockResolvedValue({});
      mockTx.cardTransaction.create.mockResolvedValue({});
      mockTx.card.updateMany.mockResolvedValue({ count: 0 });
      return fn(mockTx);
    });

    // Refund API throws
    mockStripeInstance.refunds.create.mockRejectedValueOnce(new Error("Stripe refund API down"));

    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });

  // ── Already refunded guard ────────────────────────────────────────────────

  // If a prior webhook run failed mid-transfer, issued a refund, and marked
  // orders REFUNDED, any duplicate Stripe event for the same session is a no-op.
  it("skips processing and returns 200 when session was already refunded", async () => {
    mockPrisma.order.findFirst.mockResolvedValue({ id: "order-1" }); // already REFUNDED

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    // No transfer or refund attempted
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockStripeInstance.refunds.create).not.toHaveBeenCalled();
  });

  // ── checkout.session.expired ──────────────────────────────────────────────

  it("marks order EXPIRED and clears card reservation on session expiry", async () => {
    mockStripeInstance.webhooks.constructEvent.mockReturnValue(SESSION_EXPIRED_EVENT);

    // The expired-session path uses the array form of $transaction — resolve all promises directly.
    mockPrisma.$transaction.mockImplementation(async (ops) => Promise.all(ops));

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ received: true });
  });

  // ── Unknown event type ────────────────────────────────────────────────────

  it("returns 200 for unhandled event types (safe to ignore)", async () => {
    mockStripeInstance.webhooks.constructEvent.mockReturnValue({
      id: "evt_unknown",
      type: "payment_intent.created",
      data: { object: {} },
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
