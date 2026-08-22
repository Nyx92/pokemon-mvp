import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  listing: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/cards/browse-index/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/cards/browse-index", () => {
  it("only queries forSale listings", async () => {
    mockPrisma.listing.findMany.mockResolvedValue([]);
    await GET();
    expect(mockPrisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { forSale: true } })
    );
  });

  it("projects a Pokemon listing down to the lightweight fields, with type: null", async () => {
    mockPrisma.listing.findMany.mockResolvedValue([{
      id: "listing-1",
      game: "POKEMON",
      condition: "Near Mint",
      pokemonCard: {
        nameEn: "Charizard", rarity: "Rare Holo", setNameEn: "Base Set",
        language: "Japanese", localId: "004", tcgPlayerId: "tcg-1",
      },
      riftboundCard: null,
    }]);

    const res = await GET();
    const body = await res.json();

    expect(body).toEqual({
      items: [{
        id: "listing-1",
        title: "Charizard",
        setName: "Base Set",
        rarity: "Rare Holo",
        type: null,
        language: "Japanese",
        condition: "Near Mint",
        game: "POKEMON",
      }],
    });
  });

  it("projects a Riftbound listing down to the lightweight fields, including type and the always-English language", async () => {
    mockPrisma.listing.findMany.mockResolvedValue([{
      id: "listing-2",
      game: "RIFTBOUND",
      condition: "PSA 10",
      pokemonCard: null,
      riftboundCard: {
        name: "Vi - Peacekeeper", rarity: "Rare", setLabel: "Unleashed",
        collectorNumber: "176", tcgPlayerId: null, type: "Unit", supertype: "Champion",
      },
    }]);

    const res = await GET();
    const body = await res.json();

    expect(body.items[0]).toEqual({
      id: "listing-2",
      title: "Vi - Peacekeeper",
      setName: "Unleashed",
      rarity: "Rare",
      type: "Unit",
      language: "English",
      condition: "PSA 10",
      game: "RIFTBOUND",
    });
  });

  it("returns an empty items array when nothing is for sale", async () => {
    mockPrisma.listing.findMany.mockResolvedValue([]);
    const res = await GET();
    const body = await res.json();
    expect(body).toEqual({ items: [] });
  });
});
