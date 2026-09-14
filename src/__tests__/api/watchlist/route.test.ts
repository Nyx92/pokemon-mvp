import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/watchlist
 *
 * Returns all listings the authenticated user has watchlisted, newest first.
 * Prices are stored in cents in the DB and converted to dollars in the
 * response. Card identity is resolved from whichever catalog relation
 * (pokemonCard/riftboundCard) is populated on the listing.
 */

// ── STEP 1: Create mock objects ───────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  cardWatchlist: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
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

function makeWatchlistEntry(listingId: string, priceInCents: number | null, opts: { forSale?: boolean; inAuction?: boolean; ownerId?: string } = {}) {
  return {
    id: `entry-${listingId}`,
    listing: {
      id: listingId,
      ownerId: opts.ownerId ?? "owner-1",
      price: priceInCents,
      condition: "NM",
      forSale: opts.forSale ?? true,
      inAuction: opts.inAuction ?? false,
      imageUrls: [],
      status: "available",
      description: "",
      pokemonCard: {
        nameEn: `Card ${listingId}`,
        rarity: "Rare",
        setNameEn: "Base Set",
        language: "English",
        localId: "001",
        tcgPlayerId: null,
      },
      riftboundCard: null,
      // No email here: a mocked findMany call bypasses Prisma's `select`
      // entirely, so this fixture must mirror what the corrected
      // { id, username } select actually returns in production.
      owner: { id: "owner-1", username: "Ash" },
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
  // Listings with null prices must pass through as null (not 0 or undefined).

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
    expect(body.cards[0].title).toBe("Card c1");
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

  // What's being tested: the listing owner's email must never reach the
  // response. Commit 6410447 already fixed this for /api/cards and
  // /api/cards/[id] — this route was missed. Watchlisting a card requires
  // no relationship with the seller, so there's no reason to expose it.

  it("never includes the listing owner's email in the response", async () => {
    mockPrisma.cardWatchlist.findMany.mockResolvedValueOnce([
      makeWatchlistEntry("c1", 1000),
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body.cards[0].owner).toEqual({ id: "owner-1", username: "Ash" });
    expect(body.cards[0].owner.email).toBeUndefined();

    // Because the mock above already returns an email-free owner regardless
    // of what select we pass Prisma, the response-body assertions above
    // can't actually prove the fix — reverting `owner: { select: { id, username } }`
    // back to including `email: true` would still pass them. Assert on the
    // call arguments themselves so this test fails if that select is widened.
    const findManyArgs = mockPrisma.cardWatchlist.findMany.mock.calls[0][0];
    expect(findManyArgs.include.listing.include.owner).toEqual({
      select: { id: true, username: true },
    });
  });

  // What's being tested: stale entries (listing no longer for sale or on
  // auction — sold, marked for in-person collection, etc.) are pruned as a
  // side effect of loading the watchlist, and never appear in the response.

  it("prunes and omits entries whose listing is no longer for sale or on auction", async () => {
    mockPrisma.cardWatchlist.findMany.mockResolvedValueOnce([
      makeWatchlistEntry("still-for-sale", 1000, { forSale: true }),
      makeWatchlistEntry("now-unavailable", 1000, { forSale: false, inAuction: false }),
      makeWatchlistEntry("now-in-auction", 1000, { forSale: false, inAuction: true }),
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body.cards.map((c: any) => c.id)).toEqual(["still-for-sale", "now-in-auction"]);
    expect(mockPrisma.cardWatchlist.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["entry-now-unavailable"] } },
    });
  });

  it("prunes and omits an entry the caller now owns (watchlisted, then bought it)", async () => {
    mockPrisma.cardWatchlist.findMany.mockResolvedValueOnce([
      makeWatchlistEntry("still-someone-elses", 1000, { ownerId: "owner-1" }),
      makeWatchlistEntry("now-owned-by-caller", 1000, { forSale: true, ownerId: "user-1" }),
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body.cards.map((c: any) => c.id)).toEqual(["still-someone-elses"]);
    expect(mockPrisma.cardWatchlist.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["entry-now-owned-by-caller"] } },
    });
  });

  it("doesn't call deleteMany when nothing is stale", async () => {
    mockPrisma.cardWatchlist.findMany.mockResolvedValueOnce([makeWatchlistEntry("c1", 1000)]);

    await GET();

    expect(mockPrisma.cardWatchlist.deleteMany).not.toHaveBeenCalled();
  });
});
