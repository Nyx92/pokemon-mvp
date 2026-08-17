import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/user/cards
 *
 * Returns the authenticated user's own listings (used by the "My Cards"
 * page), including their binder assignment. Card identity is resolved from
 * whichever catalog relation (pokemonCard/riftboundCard) is populated.
 */

const mockPrisma = vi.hoisted(() => ({
  listing: { findMany: vi.fn() },
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { GET } from "@/app/api/user/cards/route";

const SESSION = { user: { id: "user-1" } };

const LISTING = {
  id: "listing-1",
  ownerId: "user-1",
  price: 1000,
  binder: { id: "binder-1", name: "Main Binder" },
  pokemonCard: {
    nameEn: "Blastoise",
    rarity: "Holo Rare",
    setNameEn: "Base Set",
    language: "English",
    localId: "002",
    tcgPlayerId: "tcg-2",
  },
  riftboundCard: null,
};

describe("GET /api/user/cards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockPrisma.listing.findMany.mockResolvedValue([LISTING]);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await GET(new Request("http://localhost/api/user/cards"));
    expect(res.status).toBe(401);
    expect(mockPrisma.listing.findMany).not.toHaveBeenCalled();
  });

  it("returns the user's listings with resolved display fields", async () => {
    const res = await GET(new Request("http://localhost/api/user/cards"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cards).toHaveLength(1);
    expect(body.cards[0].id).toBe("listing-1");
    expect(body.cards[0].title).toBe("Blastoise");
    expect(body.cards[0].binder).toEqual({ id: "binder-1", name: "Main Binder" });
    expect(body.cards[0]).not.toHaveProperty("pokemonCard");
    expect(body.cards[0]).not.toHaveProperty("riftboundCard");
  });

  it("scopes the query to the requesting user's own listings, newest first, with binder and catalog included", async () => {
    await GET(new Request("http://localhost/api/user/cards"));

    expect(mockPrisma.listing.findMany).toHaveBeenCalledWith({
      where: { ownerId: "user-1" },
      include: {
        binder: true,
        pokemonCard: true,
        riftboundCard: true,
      },
      orderBy: { createdAt: "desc" },
    });
  });
});
