import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/watchlist
 *
 * Returns all cards the authenticated user has watchlisted, newest first.
 * Prices are stored in cents in the DB and converted to dollars in the response.
 */

// ── STEP 1: Create mock objects ───────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  cardWatchlist: {
    findMany: vi.fn(),
  },
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

// ── STEP 2: Register fakes ────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

// ── STEP 3: Import code under test ────────────────────────────────────────────

import { GET } from "@/app/api/watchlist/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

const SESSION = { user: { id: "user-1" } };

function makeWatchlistEntry(cardId: string, priceInCents: number | null) {
  return {
    card: {
      id: cardId,
      title: `Card ${cardId}`,
      price: priceInCents,
      condition: "NM",
      forSale: true,
      imageUrls: [],
      setName: "Base Set",
      rarity: "Rare",
      tcgPlayerId: null,
      language: "English",
      cardNumber: "001",
      status: "available",
      description: "",
      binderId: null,
      owner: { id: "owner-1", username: "Ash", email: "ash@pkmn.com" },
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
    },
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/watchlist
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /api/watchlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  // What's being tested: the auth gate.
  //
  // Unauthenticated requests must be rejected before any DB access.

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mockPrisma.cardWatchlist.findMany).not.toHaveBeenCalled();
  });

  // What's being tested: price conversion and response shape.
  //
  // The DB stores prices in cents; the API must return them as dollars.
  // Cards with null prices must pass through as null (not 0 or undefined).

  it("returns watchlisted cards with prices converted from cents to dollars", async () => {
    mockPrisma.cardWatchlist.findMany.mockResolvedValueOnce([
      makeWatchlistEntry("c1", 1000), // 1000 cents → $10
      makeWatchlistEntry("c2", null), // no price → null
    ]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cards).toHaveLength(2);
    expect(body.cards[0].id).toBe("c1");
    expect(body.cards[0].price).toBe(10);
    expect(body.cards[1].price).toBeNull();
  });

  // What's being tested: the query is scoped to the requesting user and ordered
  // newest-first so the watchlist page shows recent additions at the top.

  it("queries by userId and orders by createdAt desc", async () => {
    mockPrisma.cardWatchlist.findMany.mockResolvedValueOnce([]);

    await GET();

    expect(mockPrisma.cardWatchlist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        orderBy: { createdAt: "desc" },
      })
    );
  });

  // What's being tested: empty state — user has no watchlisted cards.
  //
  // The response should still be a valid { cards: [] } object, not an error.

  it("returns an empty cards array when the user has no watchlisted cards", async () => {
    mockPrisma.cardWatchlist.findMany.mockResolvedValueOnce([]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cards).toEqual([]);
  });
});
