import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * GET /api/auctions — list auctions.
 *
 * Three query modes:
 *   ?cardId=xxx        — active/pending_seller_decision auction for one card (card detail page)
 *   ?expiringSoon=true — top-5 active auctions still in the future (homepage row)
 *   (no params)        — all active auctions still in the future (browse page)
 *
 * Key invariants:
 *   - Listing queries (browse + homepage) filter out auctions whose endsAt has passed,
 *     even if the cron hasn't flipped their status yet.
 *   - The ?cardId= query returns any auction in "active" or "pending_seller_decision"
 *     state regardless of endsAt. Client-side logic (auctionExpiredClientSide in page.tsx
 *     and pendingSystemUpdate in BuyBox) handles the pre-cron window display.
 *
 * Tests cover:
 *   - Browse: only active auctions with endsAt in the future
 *   - Browse: prices converted from cents to dollars in the response
 *   - Browse: 500 on DB error
 *   - expiringSoon: only active auctions with endsAt in the future, take 5, ordered by endsAt asc
 *   - cardId: queries status in [active, pending_seller_decision] with no endsAt filter
 *   - cardId: returns null when no auction found
 *   - cardId: returns the auction even when endsAt has passed (pre-cron window)
 *   - cardId: surfaces a pending_seller_decision auction whose endsAt has already passed
 */

// ── STEP 1: Create the mock objects ──────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  auction: {
    findMany:  vi.fn(),
    findFirst: vi.fn(),
  },
}));

// ── STEP 2: Register the fakes ────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth",    () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth",   () => ({ authOptions: {} }));

// ── STEP 3: Import the code under test ───────────────────────────────────────

import { GET } from "@/app/api/auctions/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getReq(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/auctions");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

// Minimal DB auction row (prices in cents, as Prisma returns them)
function makeDbAuction(overrides: Partial<{
  id:      string;
  endsAt:  Date;
  status:  string;
}> = {}) {
  return {
    id:                     "auction-1",
    cardId:                 "card-1",
    sellerId:               "seller-1",
    startingBid:            500,   // cents — formatAuction converts to S$5.00
    reservePrice:           null,
    buyOutPrice:            null,
    currentBid:             null,
    highestBidderId:        null,
    status:                 "active",
    endsAt:                 new Date(Date.now() + 60 * 60 * 1000), // 1 h from now
    sellerDecisionDeadline: null,
    version:                0,
    _count:                 { bids: 0 },
    card: {
      id: "card-1", title: "Charizard", imageUrls: [], condition: "Raw NM",
      setName: "Base Set", language: "English", cardNumber: "4/102",
      rarity: "Holo Rare", tcgPlayerId: "tcg-1", inAuction: true,
      owner: { id: "seller-1", username: "ash" },
    },
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/auctions", () => {
  // ── Browse page (no params) ───────────────────────────────────────────────

  it("browse: queries only active auctions whose endsAt is in the future", async () => {
    mockPrisma.auction.findMany.mockResolvedValue([]);
    await GET(getReq());

    expect(mockPrisma.auction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "active",
          endsAt: { gt: expect.any(Date) },
        }),
      })
    );
  });

  it("browse: returns prices converted to dollars", async () => {
    mockPrisma.auction.findMany.mockResolvedValue([makeDbAuction()]);
    const res  = await GET(getReq());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.auctions).toHaveLength(1);
    expect(body.auctions[0].startingBid).toBe(5); // 500 cents → S$5.00
  });

  it("browse: returns 500 on DB error", async () => {
    mockPrisma.auction.findMany.mockRejectedValue(new Error("DB failure"));
    const res = await GET(getReq());
    expect(res.status).toBe(500);
  });

  // ── Homepage row (?expiringSoon=true) ─────────────────────────────────────

  it("expiringSoon: queries only active auctions whose endsAt is in the future", async () => {
    mockPrisma.auction.findMany.mockResolvedValue([]);
    await GET(getReq({ expiringSoon: "true" }));

    expect(mockPrisma.auction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where:   expect.objectContaining({
          status: "active",
          endsAt: { gt: expect.any(Date) },
        }),
        orderBy: { endsAt: "asc" },
        take:    5,
      })
    );
  });

  it("expiringSoon: returns formatted auctions", async () => {
    mockPrisma.auction.findMany.mockResolvedValue([makeDbAuction()]);
    const res  = await GET(getReq({ expiringSoon: "true" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.auctions).toHaveLength(1);
  });

  // ── Card detail page (?cardId=xxx) ────────────────────────────────────────

  it("cardId: queries status in [active, pending_seller_decision] with no endsAt filter", async () => {
    mockPrisma.auction.findFirst.mockResolvedValue(null);
    await GET(getReq({ cardId: "card-1" }));

    expect(mockPrisma.auction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          cardId: "card-1",
          status: { in: ["active", "pending_seller_decision"] },
        },
      })
    );
  });

  it("cardId: returns null when no auction exists", async () => {
    mockPrisma.auction.findFirst.mockResolvedValue(null);
    const res  = await GET(getReq({ cardId: "card-1" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.auction).toBeNull();
  });

  it("cardId: returns the auction even when endsAt has passed (client handles pre-cron display)", async () => {
    // The API now returns active+past auctions so the card detail page can show
    // the "pending system update" info box (has bids) or revert to standard BuyBox
    // (no bids) — both cases are handled client-side, not here.
    const pastEndsAt = new Date(Date.now() - 60 * 60 * 1000); // 1 h ago
    mockPrisma.auction.findFirst.mockResolvedValue(
      makeDbAuction({ status: "active", endsAt: pastEndsAt })
    );
    const res  = await GET(getReq({ cardId: "card-1" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.auction).not.toBeNull();
    expect(body.auction.status).toBe("active");
  });

  it("cardId: surfaces a pending_seller_decision auction even after endsAt has passed", async () => {
    const pastEndsAt = new Date(Date.now() - 60 * 60 * 1000); // 1 h ago
    mockPrisma.auction.findFirst.mockResolvedValue(
      makeDbAuction({ status: "pending_seller_decision", endsAt: pastEndsAt })
    );
    const res  = await GET(getReq({ cardId: "card-1" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.auction.status).toBe("pending_seller_decision");
  });
});
