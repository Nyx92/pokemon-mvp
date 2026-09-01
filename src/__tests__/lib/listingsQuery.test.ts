import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  listing: { findMany: vi.fn(), count: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { getListingsPage } from "@/lib/listingsQuery";

const POKEMON_LISTING = {
  id: "listing-1",
  price: 5000,
  game: "POKEMON",
  createdAt: new Date("2026-01-01"),
  pokemonCard: {
    nameEn: "Charizard", rarity: "Rare Holo", setNameEn: "Base Set",
    language: "English", localId: "004", tcgPlayerId: "tcg-1",
  },
  riftboundCard: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.listing.findMany.mockResolvedValue([POKEMON_LISTING]);
  mockPrisma.listing.count.mockResolvedValue(1);
});

describe("getListingsPage", () => {
  it("returns cards with price converted to dollars", async () => {
    const result = await getListingsPage({ forSale: true, game: "POKEMON", page: 1, pageSize: 24 });

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]).toMatchObject({ id: "listing-1", title: "Charizard", price: 50 });
  });

  it("passes forSale/game into the Prisma where clause", async () => {
    await getListingsPage({ forSale: true, game: "POKEMON", page: 1, pageSize: 24 });

    const call = mockPrisma.listing.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ AND: [{ forSale: true }, { game: "POKEMON" }] });
  });

  it("computes hasMore from totalCount when paginated", async () => {
    mockPrisma.listing.count.mockResolvedValue(50);
    const result = await getListingsPage({ forSale: true, page: 1, pageSize: 24 });

    expect(result.totalCount).toBe(50);
    expect(result.hasMore).toBe(true);
  });

  it("does not paginate or count when page/pageSize are omitted", async () => {
    const result = await getListingsPage({ forSale: true });

    expect(mockPrisma.listing.count).not.toHaveBeenCalled();
    expect(result.hasMore).toBeUndefined();
    expect(mockPrisma.listing.findMany.mock.calls[0][0].skip).toBeUndefined();
  });
});
