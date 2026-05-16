import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * GET /api/cron/expire-auctions — Vercel cron that closes ended auctions.
 *
 * Two passes per run:
 *
 * Pass 1 — Active auctions whose endsAt has passed:
 *   a) No bids     → expire immediately, notify seller
 *   b) bid >= RP   → settleAuction (auto-settle)
 *   c) bid < RP (or no RP) → pending_seller_decision + 24h deadline + notify seller
 *
 * Pass 2 — pending_seller_decision auctions whose deadline has passed:
 *   → cancelBidPI, expire auction+card, notify bidder
 *
 * Tests cover:
 *   - 401 wrong / missing CRON_SECRET
 *   - Pass 1a: no-bid auction expires
 *   - Pass 1b: bid >= reservePrice → settleAuction called
 *   - Pass 1c: bid < reservePrice → pending_seller_decision
 *   - Pass 1c: no reservePrice → pending_seller_decision (seller must decide)
 *   - Pass 2: decision timeout → PI cancelled, auction expired
 *   - Resilience: one failure doesn't block other auctions
 */

// ── STEP 1: Create the mock objects ──────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  auction: {
    findMany: vi.fn(),
    update:   vi.fn(),
    updateMany: vi.fn(),
  },
  bid:  { update: vi.fn() },
  card: { update: vi.fn() },
  $transaction: vi.fn(),
}));

const mockSettleAuction = vi.hoisted(() => vi.fn());
const mockCancelBidPI   = vi.hoisted(() => vi.fn());

// ── STEP 2: Register the fakes ────────────────────────────────────────────────

vi.mock("@/lib/prisma",   () => ({ prisma: mockPrisma }));
vi.mock("@/lib/notifications",     () => ({ notifyAsync: vi.fn() }));
vi.mock("@/lib/auctionSettlement", () => ({
  settleAuction: mockSettleAuction,
  cancelBidPI:   mockCancelBidPI,
}));

// ── STEP 3: Import the code under test ───────────────────────────────────────

import { GET } from "@/app/api/cron/expire-auctions/route";
import { notifyAsync } from "@/lib/notifications";

// ── Helpers ───────────────────────────────────────────────────────────────────

function cronReq(token?: string) {
  return new NextRequest("http://localhost/api/cron/expire-auctions", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

const CARD = { id: "card-1", title: "Charizard" };

function makeAuction(overrides = {}) {
  return {
    id:          "auction-1",
    sellerId:    "seller-1",
    reservePrice: null,
    bids:        [],
    card:        CARD,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "cron-secret";
  mockSettleAuction.mockResolvedValue(undefined);
  mockCancelBidPI.mockResolvedValue(undefined);
  // Default: no auctions to process in either pass
  mockPrisma.auction.findMany.mockResolvedValue([]);
  mockPrisma.$transaction.mockResolvedValue([]);
  mockPrisma.auction.update.mockResolvedValue({});
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/cron/expire-auctions", () => {
  // ── Auth ──────────────────────────────────────────────────────────────────────
  it("returns 401 with no token", async () => {
    const res = await GET(cronReq());
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong token", async () => {
    const res = await GET(cronReq("wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("returns 200 with correct token when nothing to process", async () => {
    const res = await GET(cronReq("cron-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settled).toBe(0);
    expect(body.expiredNoBids).toBe(0);
  });

  // ── Pass 1a: no bids → expire ─────────────────────────────────────────────
  it("Pass 1a: expires auction with no bids and notifies seller", async () => {
    const auction = makeAuction({ bids: [] });
    // Pass 1 returns our auction; Pass 2 returns nothing
    mockPrisma.auction.findMany
      .mockResolvedValueOnce([auction])
      .mockResolvedValueOnce([]);

    const res = await GET(cronReq("cron-secret"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.expiredNoBids).toBe(1);
    expect(body.settled).toBe(0);

    // Card should be released
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);

    // Seller gets auction_expired notification
    expect(notifyAsync).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "seller-1", type: "auction_expired" })
    );
  });

  // ── Pass 1b: bid >= reservePrice → auto-settle ───────────────────────────
  it("Pass 1b: settles auction when bid meets reservePrice", async () => {
    const auction = makeAuction({
      reservePrice: 1000, // S$10
      bids: [{ id: "bid-1", paymentIntentId: "pi_1", bidderId: "buyer-1", amount: 1000 }],
    });
    mockPrisma.auction.findMany
      .mockResolvedValueOnce([auction])
      .mockResolvedValueOnce([]);

    const res = await GET(cronReq("cron-secret"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.settled).toBe(1);
    expect(mockSettleAuction).toHaveBeenCalledWith("auction-1");
  });

  // ── Pass 1c: bid < reservePrice → pending_seller_decision ───────────────
  it("Pass 1c: moves to pending_seller_decision when bid is below reservePrice", async () => {
    const auction = makeAuction({
      reservePrice: 2000, // S$20
      bids: [{ id: "bid-1", paymentIntentId: "pi_1", bidderId: "buyer-1", amount: 1000 }],
    });
    mockPrisma.auction.findMany
      .mockResolvedValueOnce([auction])
      .mockResolvedValueOnce([]);

    const res = await GET(cronReq("cron-secret"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.pendingDecision).toBe(1);
    expect(mockSettleAuction).not.toHaveBeenCalled();

    // Auction should be updated to pending_seller_decision with deadline
    expect(mockPrisma.auction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "auction-1" },
        data:  expect.objectContaining({ status: "pending_seller_decision" }),
      })
    );

    // Seller gets auction_decision_needed notification
    expect(notifyAsync).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "seller-1", type: "auction_decision_needed" })
    );
  });

  // ── Pass 1c: no reservePrice → also pending_seller_decision ──────────────
  it("Pass 1c: moves to pending_seller_decision when no reservePrice is set", async () => {
    const auction = makeAuction({
      reservePrice: null,
      bids: [{ id: "bid-1", paymentIntentId: "pi_1", bidderId: "buyer-1", amount: 1000 }],
    });
    mockPrisma.auction.findMany
      .mockResolvedValueOnce([auction])
      .mockResolvedValueOnce([]);

    const res = await GET(cronReq("cron-secret"));
    const body = await res.json();
    expect(body.pendingDecision).toBe(1);
    expect(mockSettleAuction).not.toHaveBeenCalled();
  });

  // ── Pass 2: decision timeout → expire ────────────────────────────────────
  it("Pass 2: cancels PI and expires auction when seller decision deadline passes", async () => {
    const auction = makeAuction({
      bids: [{ id: "bid-1", paymentIntentId: "pi_expired", bidderId: "buyer-1" }],
    });
    // Pass 1: no active-expired auctions; Pass 2: one decision-expired auction
    mockPrisma.auction.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([auction]);

    const res = await GET(cronReq("cron-secret"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.expiredDecisionTimeout).toBe(1);

    // PI must be cancelled
    expect(mockCancelBidPI).toHaveBeenCalledWith("pi_expired");

    // DB transaction should expire the auction and release the card
    expect(mockPrisma.$transaction).toHaveBeenCalled();

    // Bidder gets auction_expired notification
    expect(notifyAsync).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "buyer-1", type: "auction_expired" })
    );
  });

  // ── Resilience ────────────────────────────────────────────────────────────
  // Place the failure in the settleAuction path so it's cleanly separate from
  // the $transaction used by the no-bid expiry path.
  it("continues processing after one failure and reports it in errors[]", async () => {
    const good = makeAuction({ id: "auction-good", bids: [] });
    // bad: bid exactly meets reservePrice → goes through settleAuction (pass 1b)
    const bad  = makeAuction({
      id:          "auction-bad",
      reservePrice: 500,
      bids: [{ id: "bid-1", paymentIntentId: "pi_1", bidderId: "buyer-1", amount: 500 }],
    });

    mockPrisma.auction.findMany
      .mockResolvedValueOnce([good, bad])
      .mockResolvedValueOnce([]);

    // settleAuction throws for the bad auction only (first call fails)
    mockSettleAuction.mockRejectedValueOnce(new Error("Stripe timeout"));

    const res = await GET(cronReq("cron-secret"));
    const body = await res.json();

    expect(body.failed).toBe(1);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0]).toContain("auction-bad");
    // good auction still processed cleanly
    expect(body.expiredNoBids).toBe(1);
  });
});
