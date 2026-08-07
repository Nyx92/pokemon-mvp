import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * POST /api/auctions/[id]/decide — seller accepts or rejects the highest bid
 * during the pending_seller_decision window.
 *
 * Tests cover:
 *   - 401 unauthenticated
 *   - 400 invalid action
 *   - 404 auction not found
 *   - 403 caller is not the seller
 *   - 409 auction not awaiting a decision
 *   - 409 decision deadline has passed
 *   - 409 no bids found
 *   - accept — delegates to settleAuction
 *   - reject — cancels the winning PI, marks bid/auction/card, notifies bidder
 */

// ── STEP 1: Create the mock objects ──────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  auction: { findUnique: vi.fn(), update: vi.fn() },
  bid: { update: vi.fn() },
  card: { update: vi.fn() },
  $transaction: vi.fn(),
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockSettleAuction = vi.hoisted(() => vi.fn());
const mockCancelBidPI = vi.hoisted(() => vi.fn());
const mockNotifyAsync = vi.hoisted(() => vi.fn());

// ── STEP 2: Register the fakes ────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/notifications", () => ({ notifyAsync: mockNotifyAsync }));
vi.mock("@/lib/auctionSettlement", () => ({
  settleAuction: mockSettleAuction,
  cancelBidPI: mockCancelBidPI,
}));

// ── STEP 3: Import the code under test ───────────────────────────────────────

import { POST } from "@/app/api/auctions/[id]/decide/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function postReq(body: object) {
  return new NextRequest("http://localhost/api/auctions/auction-1/decide", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const PARAMS = { params: { id: "auction-1" } };

const SELLER_SESSION = { user: { id: "seller-1" } };
const OTHER_SESSION = { user: { id: "not-seller" } };

const HIGHEST_BID = {
  id: "bid-1",
  paymentIntentId: "pi_1",
  bidderId: "buyer-1",
  amount: 1500,
};

const BASE_AUCTION = {
  id: "auction-1",
  sellerId: "seller-1",
  status: "pending_seller_decision",
  sellerDecisionDeadline: new Date(Date.now() + 60 * 60 * 1000), // 1h from now
  bids: [HIGHEST_BID],
  card: { id: "card-1", title: "Charizard" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops));
  mockPrisma.bid.update.mockResolvedValue({});
  mockPrisma.auction.update.mockResolvedValue({});
  mockPrisma.card.update.mockResolvedValue({});
  mockCancelBidPI.mockResolvedValue(undefined);
  mockSettleAuction.mockResolvedValue(undefined);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/auctions/[id]/decide", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(postReq({ action: "accept" }), PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid action", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    const res = await POST(postReq({ action: "maybe" }), PARAMS);
    expect(res.status).toBe(400);
  });

  it("returns 404 when auction is not found", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue(null);
    const res = await POST(postReq({ action: "accept" }), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 403 when caller is not the seller", async () => {
    mockGetServerSession.mockResolvedValue(OTHER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue(BASE_AUCTION);
    const res = await POST(postReq({ action: "accept" }), PARAMS);
    expect(res.status).toBe(403);
  });

  it("returns 409 when auction is not awaiting a seller decision", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue({ ...BASE_AUCTION, status: "active" });
    const res = await POST(postReq({ action: "accept" }), PARAMS);
    expect(res.status).toBe(409);
  });

  it("returns 409 when the decision window has expired", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue({
      ...BASE_AUCTION,
      sellerDecisionDeadline: new Date(Date.now() - 1000),
    });
    const res = await POST(postReq({ action: "accept" }), PARAMS);
    expect(res.status).toBe(409);
  });

  it("returns 409 when there are no bids on the auction", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue({ ...BASE_AUCTION, bids: [] });
    const res = await POST(postReq({ action: "accept" }), PARAMS);
    expect(res.status).toBe(409);
  });

  it("accept — delegates to settleAuction and returns success", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue(BASE_AUCTION);

    const res = await POST(postReq({ action: "accept" }), PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockSettleAuction).toHaveBeenCalledWith("auction-1");
    expect(mockCancelBidPI).not.toHaveBeenCalled();
  });

  it("reject — cancels the winning PI, updates bid/auction/card, and notifies the bidder", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue(BASE_AUCTION);

    const res = await POST(postReq({ action: "reject" }), PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    expect(mockCancelBidPI).toHaveBeenCalledWith("pi_1");
    expect(mockPrisma.bid.update).toHaveBeenCalledWith({
      where: { id: "bid-1" },
      data: { status: "cancelled" },
    });
    expect(mockPrisma.auction.update).toHaveBeenCalledWith({
      where: { id: "auction-1" },
      data: { status: "expired" },
    });
    expect(mockPrisma.card.update).toHaveBeenCalledWith({
      where: { id: "card-1" },
      data: { inAuction: false },
    });
    expect(mockNotifyAsync).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "buyer-1", type: "auction_expired" })
    );
    expect(mockSettleAuction).not.toHaveBeenCalled();
  });
});
