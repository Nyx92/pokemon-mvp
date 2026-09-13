import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  auction: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/auctions/browse-index/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/auctions/browse-index", () => {
  it("only queries active, not-yet-ended auctions", async () => {
    mockPrisma.auction.findMany.mockResolvedValue([]);
    await GET();
    const call = mockPrisma.auction.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ status: "active", endsAt: { gt: expect.any(Date) } });
  });

  it("projects a Pokemon auction to the lightweight fields, keyed by listingId", async () => {
    mockPrisma.auction.findMany.mockResolvedValue([{
      id: "auction-1",
      listingId: "listing-1",
      endsAt: new Date("2026-01-01T00:00:00.000Z"),
      buyOutPrice: null,
      _count: { bids: 3 },
      listing: {
        game: "POKEMON",
        condition: "Near Mint",
        pokemonCard: { nameEn: "Charizard", rarity: "Rare Holo", setNameEn: "Base Set", language: "English" },
        riftboundCard: null,
      },
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
        language: "English",
        condition: "Near Mint",
        game: "POKEMON",
        bidCount: 3,
        endsAt: "2026-01-01T00:00:00.000Z",
        hasBuyOut: false,
      }],
    });
  });

  it("projects a Riftbound auction, including type and hasBuyOut=true when a buyOutPrice is set", async () => {
    mockPrisma.auction.findMany.mockResolvedValue([{
      id: "auction-2",
      listingId: "listing-2",
      endsAt: new Date("2026-02-01T00:00:00.000Z"),
      buyOutPrice: 9999,
      _count: { bids: 0 },
      listing: {
        game: "RIFTBOUND",
        condition: "PSA 10",
        pokemonCard: null,
        riftboundCard: { name: "Vi - Peacekeeper", rarity: "Rare", setLabel: "Unleashed", type: "Unit" },
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
      bidCount: 0,
      endsAt: "2026-02-01T00:00:00.000Z",
      hasBuyOut: true,
    });
  });

  it("returns an empty items array when there are no active auctions", async () => {
    mockPrisma.auction.findMany.mockResolvedValue([]);
    const res = await GET();
    const body = await res.json();
    expect(body).toEqual({ items: [] });
  });
});
