import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * POST /api/auctions — seller starts an auction.
 *
 * Sequence:
 *   1. Auth check
 *   2. Validate inputs (startingBid, durationDays, reservePrice, buyOutPrice)
 *   3. Load card — must be owned by seller, not already in auction
 *   4. Create Auction + lock card in prisma.$transaction
 *   5. Return 201 with formatted auction (prices in dollars)
 *
 * Tests cover:
 *   - Success (no optional prices, with RP+BO)
 *   - 401 unauthenticated
 *   - 400 missing/invalid inputs
 *   - 403 card owned by someone else
 *   - 409 card already in auction
 */

// ── STEP 1: Create the mock objects ──────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  card:    { findUnique: vi.fn(), update: vi.fn() },
  auction: { create: vi.fn() },
  $transaction: vi.fn(),
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

// ── STEP 2: Register the fakes ────────────────────────────────────────────────

vi.mock("@/lib/prisma",  () => ({ prisma: mockPrisma }));
vi.mock("next-auth",     () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth",    () => ({ authOptions: {} }));
vi.mock("@/lib/notifications", () => ({ notifyAsync: vi.fn(), createNotification: vi.fn() }));

// ── STEP 3: Import the code under test ───────────────────────────────────────

import { POST } from "@/app/api/auctions/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function postReq(body: object) {
  return new NextRequest("http://localhost/api/auctions", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

const SELLER_SESSION = { user: { id: "seller-1" } };

const CARD = {
  id: "card-1", title: "Charizard", ownerId: "seller-1",
  inAuction: false,
};

// A minimal DB Auction row returned by prisma.auction.create
function makeDbAuction(overrides = {}) {
  return {
    id:             "auction-1",
    cardId:         "card-1",
    sellerId:       "seller-1",
    startingBid:    500,   // cents
    reservePrice:   null,
    buyOutPrice:    null,
    currentBid:     null,
    highestBidderId: null,
    status:         "active",
    endsAt:         new Date("2099-01-01"),
    sellerDecisionDeadline: null,
    version:        0,
    _count:         { bids: 0 },
    card: {
      id: "card-1", title: "Charizard", imageUrls: [], condition: "Raw NM",
      setName: "Base Set", language: "English", cardNumber: "4/102",
      rarity: "Holo Rare", tcgPlayerId: "tcg-1", inAuction: true,
      owner: { id: "seller-1", username: "ash" },
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "secret";
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/auctions", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(postReq({ cardId: "card-1", startingBid: 5, durationDays: 3 }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when startingBid is missing", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    const res = await POST(postReq({ cardId: "card-1", durationDays: 3 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/starting bid/i);
  });

  it("returns 400 when startingBid is zero", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    const res = await POST(postReq({ cardId: "card-1", startingBid: 0, durationDays: 3 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when durationDays is out of range", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    const res = await POST(postReq({ cardId: "card-1", startingBid: 5, durationDays: 7 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/duration/i);
  });

  it("returns 400 when reservePrice < startingBid", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    const res = await POST(postReq({
      cardId: "card-1", startingBid: 10, reservePrice: 5, durationDays: 3,
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/reserve/i);
  });

  it("returns 400 when buyOutPrice <= reservePrice", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    const res = await POST(postReq({
      cardId: "card-1", startingBid: 5, reservePrice: 20, buyOutPrice: 20, durationDays: 3,
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/buy-out/i);
  });

  it("returns 404 when card does not exist", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.card.findUnique.mockResolvedValue(null);
    const res = await POST(postReq({ cardId: "card-1", startingBid: 5, durationDays: 3 }));
    expect(res.status).toBe(404);
  });

  it("returns 403 when card is owned by someone else", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.card.findUnique.mockResolvedValue({ ...CARD, ownerId: "other-user" });
    const res = await POST(postReq({ cardId: "card-1", startingBid: 5, durationDays: 3 }));
    expect(res.status).toBe(403);
  });

  it("returns 409 when card is already in auction", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.card.findUnique.mockResolvedValue({ ...CARD, inAuction: true });
    const res = await POST(postReq({ cardId: "card-1", startingBid: 5, durationDays: 3 }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already.*auction/i);
  });

  it("creates auction and returns 201 with prices in dollars", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.card.findUnique.mockResolvedValue(CARD);
    const dbAuction = makeDbAuction({ startingBid: 500 }); // 500 cents = S$5.00
    mockPrisma.$transaction.mockResolvedValue([dbAuction]);

    const res = await POST(postReq({ cardId: "card-1", startingBid: 5, durationDays: 3 }));
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.auction.startingBid).toBe(5);       // cents → dollars
    expect(body.auction.reservePrice).toBeNull();
    expect(body.auction.buyOutPrice).toBeNull();
    expect(body.auction.status).toBe("active");
    expect(body.auction.bidCount).toBe(0);
  });

  it("creates auction with reserve and buy-out prices", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.card.findUnique.mockResolvedValue(CARD);
    const dbAuction = makeDbAuction({
      startingBid:  500,
      reservePrice: 1000,
      buyOutPrice:  2000,
    });
    mockPrisma.$transaction.mockResolvedValue([dbAuction]);

    const res = await POST(postReq({
      cardId: "card-1", startingBid: 5, reservePrice: 10, buyOutPrice: 20, durationDays: 3,
    }));
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.auction.startingBid).toBe(5);
    expect(body.auction.reservePrice).toBe(10);
    expect(body.auction.buyOutPrice).toBe(20);
  });
});
