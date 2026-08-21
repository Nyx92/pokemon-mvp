import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  listing: { findMany: vi.fn(), count: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
// The route module creates a Supabase client at module scope (used by POST,
// not GET) — mock it out so importing the module doesn't require real
// SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY env vars, matching the pattern in
// get-card.test.ts for this same route file.
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({})),
}));

import { GET } from "@/app/api/cards/route";

function cardsRequest(query: string) {
  return new Request(`http://localhost/api/cards${query}`);
}

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

describe("GET /api/cards — filters", () => {
  it("applies no filter (AND array empty) when no query params are given", async () => {
    await GET(cardsRequest(""));
    expect(mockPrisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });

  it("keeps the existing forSale=true behavior", async () => {
    await GET(cardsRequest("?forSale=true"));
    const call = mockPrisma.listing.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ AND: [{ forSale: true }] });
  });

  it("keeps the existing tcgPlayerId OR-across-games behavior", async () => {
    await GET(cardsRequest("?tcgPlayerId=tcg-1"));
    const call = mockPrisma.listing.findMany.mock.calls[0][0];
    expect(call.where).toEqual({
      AND: [{
        OR: [
          { pokemonCard: { tcgPlayerId: "tcg-1" } },
          { riftboundCard: { tcgPlayerId: "tcg-1" } },
        ],
      }],
    });
  });

  it("filters by game", async () => {
    await GET(cardsRequest("?game=RIFTBOUND"));
    const call = mockPrisma.listing.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ AND: [{ game: "RIFTBOUND" }] });
  });

  it("ignores an unrecognized game value rather than erroring", async () => {
    await GET(cardsRequest("?game=MAGIC"));
    const call = mockPrisma.listing.findMany.mock.calls[0][0];
    expect(call.where).toEqual({});
  });

  it("filters by one or more setName values, OR'd across both games' set fields", async () => {
    await GET(cardsRequest("?setName=Base+Set&setName=Jungle"));
    const call = mockPrisma.listing.findMany.mock.calls[0][0];
    expect(call.where).toEqual({
      AND: [{
        OR: [
          { pokemonCard: { setNameEn: { in: ["Base Set", "Jungle"] } } },
          { riftboundCard: { setLabel: { in: ["Base Set", "Jungle"] } } },
        ],
      }],
    });
  });

  it("filters by one or more rarity values, OR'd across both games' rarity fields", async () => {
    await GET(cardsRequest("?rarity=Rare&rarity=Rare+Holo"));
    const call = mockPrisma.listing.findMany.mock.calls[0][0];
    expect(call.where).toEqual({
      AND: [{
        OR: [
          { pokemonCard: { rarity: { in: ["Rare", "Rare Holo"] } } },
          { riftboundCard: { rarity: { in: ["Rare", "Rare Holo"] } } },
        ],
      }],
    });
  });

  it("filters by Riftbound type (no Pokemon equivalent, so no OR needed)", async () => {
    await GET(cardsRequest("?type=Unit&type=Legend"));
    const call = mockPrisma.listing.findMany.mock.calls[0][0];
    expect(call.where).toEqual({
      AND: [{ riftboundCard: { type: { in: ["Unit", "Legend"] } } }],
    });
  });

  it("filters by a list of ids", async () => {
    await GET(cardsRequest("?ids=id-1&ids=id-2"));
    const call = mockPrisma.listing.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ AND: [{ id: { in: ["id-1", "id-2"] } }] });
  });

  it("combines multiple facets with AND", async () => {
    await GET(cardsRequest("?forSale=true&game=POKEMON&rarity=Rare"));
    const call = mockPrisma.listing.findMany.mock.calls[0][0];
    expect(call.where).toEqual({
      AND: [
        { forSale: true },
        { game: "POKEMON" },
        {
          OR: [
            { pokemonCard: { rarity: { in: ["Rare"] } } },
            { riftboundCard: { rarity: { in: ["Rare"] } } },
          ],
        },
      ],
    });
  });

  it("orders by createdAt desc with id asc as a deterministic tiebreaker", async () => {
    await GET(cardsRequest(""));
    const call = mockPrisma.listing.findMany.mock.calls[0][0];
    expect(call.orderBy).toEqual([{ createdAt: "desc" }, { id: "asc" }]);
  });
});
