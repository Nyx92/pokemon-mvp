import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * GET /api/auctions/[id]
 *
 * Returns the auction record with its bids (amounts + statuses, no PI ids
 * exposed) and the associated card. Public endpoint — no auth required.
 * Card identity is resolved from whichever catalog relation the linked
 * listing points to; the response shape (cardId, nested card: {...}) is
 * unchanged from before the rename.
 */

const mockPrisma = vi.hoisted(() => ({
  auction: { findUnique: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/auctions/[id]/route";

const PARAMS = { params: Promise.resolve({ id: "auction-1" }) };

function makeDbAuction(overrides = {}) {
  return {
    id: "auction-1",
    listingId: "card-1",
    sellerId: "seller-1",
    startingBid: 500,
    reservePrice: null,
    buyOutPrice: null,
    currentBid: 700,
    highestBidderId: "buyer-1",
    status: "active",
    endsAt: new Date(Date.now() + 60 * 60 * 1000),
    sellerDecisionDeadline: null,
    version: 1,
    _count: { bids: 1 },
    listing: {
      id: "card-1", imageUrls: [], condition: "Raw NM", inAuction: true,
      owner: { id: "seller-1", username: "ash" },
      pokemonCard: {
        nameEn: "Charizard", rarity: "Holo Rare", setNameEn: "Base Set",
        language: "English", localId: "4/102", tcgPlayerId: "tcg-1",
      },
      riftboundCard: null,
    },
    bids: [
      {
        id: "bid-1", bidderId: "buyer-1", amount: 700, status: "active",
        createdAt: new Date("2025-01-01"),
        bidder: { id: "buyer-1", username: "misty" },
      },
    ],
    ...overrides,
  };
}

describe("GET /api/auctions/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when the auction does not exist", async () => {
    mockPrisma.auction.findUnique.mockResolvedValue(null);
    const res = await GET(new NextRequest("http://localhost/api/auctions/auction-1"), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns the auction with prices converted to dollars and card identity resolved", async () => {
    mockPrisma.auction.findUnique.mockResolvedValue(makeDbAuction());
    const res = await GET(new NextRequest("http://localhost/api/auctions/auction-1"), PARAMS);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.auction.cardId).toBe("card-1");
    expect(body.auction.startingBid).toBe(5);
    expect(body.auction.currentBid).toBe(7);
    expect(body.auction.card.title).toBe("Charizard");
    expect(body.auction).not.toHaveProperty("listingId");
  });

  it("returns bids with amounts converted to dollars, no PI ids exposed", async () => {
    mockPrisma.auction.findUnique.mockResolvedValue(makeDbAuction());
    const res = await GET(new NextRequest("http://localhost/api/auctions/auction-1"), PARAMS);
    const body = await res.json();

    expect(body.auction.bids).toHaveLength(1);
    expect(body.auction.bids[0].amount).toBe(7); // 700 cents → S$7.00
    expect(body.auction.bids[0]).not.toHaveProperty("paymentIntentId");
    expect(body.auction.bids[0].bidder).toEqual({ id: "buyer-1", username: "misty" });
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.auction.findUnique.mockRejectedValue(new Error("DB failure"));
    const res = await GET(new NextRequest("http://localhost/api/auctions/auction-1"), PARAMS);
    expect(res.status).toBe(500);
  });
});
