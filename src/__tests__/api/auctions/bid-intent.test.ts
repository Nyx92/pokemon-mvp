import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * POST /api/auctions/[id]/bid/intent — buyer creates a Stripe PaymentIntent
 * for a bid (step 1 of 2, mirrors POST /api/offers/payment-intent).
 *
 * Tests cover:
 *   - 401 unauthenticated
 *   - 400 invalid amount
 *   - 404 auction not found
 *   - 409 auction not active
 *   - 409 auction ended
 *   - 403 seller bidding on own auction
 *   - 400 bid below startingBid
 *   - 400 bid not higher than currentBid
 *   - 200 success — creates a manual-capture PI with the right amount/metadata
 */

// ── STEP 1: Create the mock objects ──────────────────────────────────────────

const mockStripeInstance = vi.hoisted(() => ({
  paymentIntents: {
    create: vi.fn(),
  },
}));

const mockPrisma = vi.hoisted(() => ({
  auction: { findUnique: vi.fn() },
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

// ── STEP 2: Register the fakes ────────────────────────────────────────────────

vi.mock("stripe", () => ({ default: vi.fn(() => mockStripeInstance) }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

// ── STEP 3: Import the code under test ───────────────────────────────────────

import { POST } from "@/app/api/auctions/[id]/bid/intent/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function postReq(body: object) {
  return new NextRequest("http://localhost/api/auctions/auction-1/bid/intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const PARAMS = { params: { id: "auction-1" } };

const BUYER_SESSION = { user: { id: "buyer-1" } };
const SELLER_SESSION = { user: { id: "seller-1" } };

// An active auction with no bids yet; all prices in cents.
const BASE_AUCTION = {
  id: "auction-1",
  status: "active",
  endsAt: new Date(Date.now() + 10 * 60 * 60 * 1000), // 10 h from now
  sellerId: "seller-1",
  startingBid: 500, // S$5.00
  currentBid: null,
  card: { id: "card-1", title: "Charizard" },
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/auctions/[id]/bid/intent", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(postReq({ amount: 10 }), PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 400 when amount is invalid", async () => {
    mockGetServerSession.mockResolvedValue(BUYER_SESSION);
    const res = await POST(postReq({ amount: 0 }), PARAMS);
    expect(res.status).toBe(400);
    expect(mockStripeInstance.paymentIntents.create).not.toHaveBeenCalled();
  });

  it("returns 404 when auction is not found", async () => {
    mockGetServerSession.mockResolvedValue(BUYER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue(null);
    const res = await POST(postReq({ amount: 10 }), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 409 when auction is not active", async () => {
    mockGetServerSession.mockResolvedValue(BUYER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue({ ...BASE_AUCTION, status: "sold" });
    const res = await POST(postReq({ amount: 10 }), PARAMS);
    expect(res.status).toBe(409);
  });

  it("returns 409 when auction has ended", async () => {
    mockGetServerSession.mockResolvedValue(BUYER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue({
      ...BASE_AUCTION,
      endsAt: new Date(Date.now() - 1000),
    });
    const res = await POST(postReq({ amount: 10 }), PARAMS);
    expect(res.status).toBe(409);
  });

  it("returns 403 when seller bids on own auction", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue(BASE_AUCTION);
    const res = await POST(postReq({ amount: 10 }), PARAMS);
    expect(res.status).toBe(403);
    expect(mockStripeInstance.paymentIntents.create).not.toHaveBeenCalled();
  });

  it("returns 400 when bid is below startingBid", async () => {
    mockGetServerSession.mockResolvedValue(BUYER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue(BASE_AUCTION); // startingBid = 500 cents
    // Bid S$4.00 = 400 cents < 500
    const res = await POST(postReq({ amount: 4 }), PARAMS);
    expect(res.status).toBe(400);
  });

  it("returns 400 when bid is not higher than currentBid", async () => {
    mockGetServerSession.mockResolvedValue(BUYER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue({ ...BASE_AUCTION, currentBid: 1000 });
    // Bid S$10.00 = 1000 cents, exactly equal to currentBid — must be *higher*
    const res = await POST(postReq({ amount: 10 }), PARAMS);
    expect(res.status).toBe(400);
  });

  it("creates a manual-capture PaymentIntent and returns its clientSecret", async () => {
    mockGetServerSession.mockResolvedValue(BUYER_SESSION);
    mockPrisma.auction.findUnique.mockResolvedValue(BASE_AUCTION);
    mockStripeInstance.paymentIntents.create.mockResolvedValue({
      id: "pi_1",
      client_secret: "secret_1",
    });

    const res = await POST(postReq({ amount: 10 }), PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ clientSecret: "secret_1", paymentIntentId: "pi_1" });

    expect(mockStripeInstance.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1000,
        currency: "sgd",
        capture_method: "manual",
        metadata: expect.objectContaining({
          bidderId: "buyer-1",
          auctionId: "auction-1",
          cardTitle: "Charizard",
        }),
      })
    );
  });
});
