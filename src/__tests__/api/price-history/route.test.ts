import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/price-history/[tcgId]?game=POKEMON|RIFTBOUND reads our own
 * PriceHistory table (populated by the refresh cron) and groups it by
 * variant, so the chart gets every variant's history in one response.
 */

const mockPrisma = vi.hoisted(() => ({
  pokemonCardCatalog: { findFirst: vi.fn() },
  riftboundCardCatalog: { findFirst: vi.fn() },
  priceHistory: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/price-history/[tcgId]/route";

function makeRequest(tcgId: string, game?: string) {
  const url = `http://localhost/api/price-history/${tcgId}${
    game ? `?game=${game}` : ""
  }`;
  return {
    req: new Request(url),
    params: Promise.resolve({ tcgId }),
  };
}

describe("GET /api/price-history/[tcgId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a missing or invalid game param", async () => {
    const { req, params } = makeRequest("42445");
    const res = await GET(req, { params });
    expect(res.status).toBe(400);
  });

  it("returns an empty variants object when the card isn't in our catalog", async () => {
    mockPrisma.pokemonCardCatalog.findFirst.mockResolvedValue(null);
    const { req, params } = makeRequest("42445", "POKEMON");

    const res = await GET(req, { params });
    const data = await res.json();

    expect(data).toEqual({ variants: {} });
    expect(mockPrisma.priceHistory.findMany).not.toHaveBeenCalled();
  });

  it("groups rows by variant, converts cents to SGD dollars, and sets currentPrice to the latest row", async () => {
    mockPrisma.pokemonCardCatalog.findFirst.mockResolvedValue({ id: "pkm-1" });
    mockPrisma.priceHistory.findMany.mockResolvedValue([
      { variant: "RAW", priceCents: 1000, capturedAt: new Date("2026-09-01") },
      { variant: "RAW", priceCents: 1200, capturedAt: new Date("2026-09-02") },
      { variant: "PSA 10", priceCents: 15000, capturedAt: new Date("2026-09-02") },
    ]);

    const { req, params } = makeRequest("42445", "POKEMON");
    const res = await GET(req, { params });
    const data = await res.json();

    expect(data.variants.RAW.currentPrice).toBe(12);
    expect(data.variants.RAW.lastUpdated).toBe("2026-09-02");
    expect(data.variants.RAW.history).toEqual([
      { date: "2026-09-01", price: 10 },
      { date: "2026-09-02", price: 12 },
    ]);
    expect(data.variants["PSA 10"].currentPrice).toBe(150);
    expect(data.variants["PSA 10"].lastUpdated).toBe("2026-09-02");
  });

  it("queries the Riftbound catalog and priceHistory by riftboundCardId when game=RIFTBOUND", async () => {
    mockPrisma.riftboundCardCatalog.findFirst.mockResolvedValue({ id: "rb-1" });
    mockPrisma.priceHistory.findMany.mockResolvedValue([]);

    const { req, params } = makeRequest("999", "RIFTBOUND");
    await GET(req, { params });

    expect(mockPrisma.riftboundCardCatalog.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tcgPlayerId: "999" } })
    );
    expect(mockPrisma.priceHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { riftboundCardId: "rb-1" } })
    );
  });
});
