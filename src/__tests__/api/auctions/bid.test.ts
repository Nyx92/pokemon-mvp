import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * POST /api/auctions/[id]/bid — buyer places a binding bid.
 *
 * Sequence:
 *   1. Auth check
 *   2. Validate body (paymentIntentId, amount)
 *   3. Load auction snapshot — must be active, not ended, not the seller's own card
 *   4. Verify PI is "requires_capture" with Stripe
 *   5. Read current highest bid (for future cancellation)
 *   6. Version-locked $transaction: updateMany WHERE version=snapshot, cancel prev bid, create bid
 *   7. On CONCURRENT_BID: cancel new PI, return 409
 *   8. Cancel previous PI (fire-and-forget)
 *   9. Send bid_received + outbid notifications
 *  10. Settle instantly when bid >= buyOutPrice (RP does NOT end the auction early)
 *
 * Tests cover:
 *   - Success (plain bid, no settlement)
 *   - Instant settlement when bid >= buyOutPrice
 *   - Bid at exactly reservePrice does NOT settle — auction continues until endsAt
 *   - 401 unauthenticated
 *   - 403 seller bidding on own auction
 *   - 400 bid below startingBid
 *   - 400 bid not higher than currentBid
 *   - 409 concurrent bid (optimistic lock collision)
 *   - 409 PI not in requires_capture state
 *   - 400 PI amount does not match the claimed bid amount
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
  card:            { id: "card-1", title: "Charizard" },
};

// PI returned by stripe.paymentIntents.retrieve.
// `amount` is left out here since it must match whatever bid amount each
// test exercises — tests that reach the PI-amount check spread this base
// object and add the matching `amount` (in cents) explicitly.
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
    // PI should be cancelled when validation fails
    expect(mockStripeInstance.paymentIntents.cancel).toHaveBeenCalledWith("pi_1");
  });

  it("returns 400 when bid is below startingBid", async () => {
    mockGetServerSession.mockResolvedValue(BUYER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue(BASE_AUCTION); // startingBid = 500 cents
    mockStripeInstance.paymentIntents.retrieve.mockResolvedValue(PI_REQUIRES_CAPTURE);
    // Bid S$4.00 = 400 cents < 500
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
    // Bid S$10.00 = 1000 cents, exactly equal to currentBid — must be *higher*
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

    // Simulate lock miss: updateMany returns count=0
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
    // Our PI must be cancelled when we lose the lock
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

    // Seller should receive bid_received notification
    expect(notifyAsync).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "seller-1", type: "bid_received" })
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

    // Previous PI must be fire-and-forget cancelled
    expect(mockCancelBidPI).toHaveBeenCalledWith("pi_prev");

    // Outbid notification for the previous bidder
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

    // Bid exactly the buy-out price (S$20)
    const res = await POST(postReq({ paymentIntentId: "pi_1", amount: 20 }), PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settled).toBe(true);
    expect(mockSettleAuction).toHaveBeenCalledWith("auction-1");
  });

  it("does NOT settle immediately when bid hits reservePrice — auction runs until endsAt", async () => {
    // RP is only checked by the cron at endsAt. During bidding it must have no
    // effect on settlement — the auction simply continues with the RP "met".
    mockGetServerSession.mockResolvedValue(BUYER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue({
      ...BASE_AUCTION, reservePrice: 1500, // S$15 reserve
    });
    mockStripeInstance.paymentIntents.retrieve.mockResolvedValue({ ...PI_REQUIRES_CAPTURE, amount: 1500 });
    mockPrisma.bid.findFirst.mockResolvedValue(null);
    txSuccess();

    // Bid exactly at the reserve price
    const res = await POST(postReq({ paymentIntentId: "pi_1", amount: 15 }), PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settled).toBe(false);             // auction still running
    expect(mockSettleAuction).not.toHaveBeenCalled(); // no immediate settlement
  });

  it("returns 400 and cancels the PI when its authorised amount doesn't match the claimed bid", async () => {
    mockGetServerSession.mockResolvedValue(BUYER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue(BASE_AUCTION);
    // Authorised for S$5.00 (500 cents) but the request claims a S$10 bid.
    mockStripeInstance.paymentIntents.retrieve.mockResolvedValue({ ...PI_REQUIRES_CAPTURE, amount: 500 });

    const res = await POST(postReq({ paymentIntentId: "pi_1", amount: 10 }), PARAMS);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/does not match/i);
    expect(mockStripeInstance.paymentIntents.cancel).toHaveBeenCalledWith("pi_1");
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
