import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * GET /api/cron/backfill-prices is the expensive, occasional half of the
 * two-tier pricing strategy: one v2 call per card, pulling up to a year of
 * history. Self-resuming — only queries cards with priceBackfilledAt: null,
 * and marks each one done on success so it's never re-pulled.
 */

const mockPrisma = vi.hoisted(() => ({
  pokemonCardCatalog: { findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
  riftboundCardCatalog: { findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
  priceHistory: { findMany: vi.fn(), update: vi.fn(), createMany: vi.fn() },
}));

const mockFetchCardVariants = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/pricing/justtcg", () => ({
  fetchCardVariants: mockFetchCardVariants,
  usdMarket: (variant: any) =>
    variant.markets.find((m: any) => m.currency === "USD") ?? variant.markets[0] ?? null,
  pickPricedVariants: (variants: any[]) => {
    const nearMint = variants.find((v) => v.type === "raw" && v.condition === "Near Mint");
    return nearMint ? [{ label: "RAW", variant: nearMint }] : [];
  },
}));

import { GET } from "@/app/api/cron/backfill-prices/route";

function makeRequest(authToken?: string, query = "") {
  return new NextRequest(`http://localhost/api/cron/backfill-prices${query}`, {
    headers: authToken ? { authorization: `Bearer ${authToken}` } : {},
  });
}

const CARD_WITH_HISTORY = {
  type: "raw",
  condition: "Near Mint",
  grading: null,
  markets: [
    {
      currency: "USD",
      price: 12,
      price_history: [
        { t: Date.parse("2026-09-10T00:00:00Z") / 1000, p: 10 },
        { t: Date.parse("2026-09-11T00:00:00Z") / 1000, p: 11 },
      ],
    },
  ],
};

describe("GET /api/cron/backfill-prices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.pokemonCardCatalog.findMany.mockResolvedValue([]);
    mockPrisma.riftboundCardCatalog.findMany.mockResolvedValue([]);
    mockPrisma.pokemonCardCatalog.count.mockResolvedValue(0);
    mockPrisma.riftboundCardCatalog.count.mockResolvedValue(0);
    mockPrisma.priceHistory.findMany.mockResolvedValue([]);
  });

  it("returns 401 when the bearer token is wrong", async () => {
    const res = await GET(makeRequest("wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("only queries cards with priceBackfilledAt: null", async () => {
    await GET(makeRequest("test-cron-secret"));

    expect(mockPrisma.pokemonCardCatalog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tcgPlayerId: { not: null }, listings: { some: {} }, priceBackfilledAt: null },
      })
    );
  });

  it("requests a full year of history and bulk-creates every point plus today's live price in one call", async () => {
    mockPrisma.pokemonCardCatalog.findMany.mockResolvedValue([
      { id: "pkm-1", tcgPlayerId: "42360", language: "English" },
    ]);
    mockFetchCardVariants.mockResolvedValue([CARD_WITH_HISTORY]);

    const res = await GET(makeRequest("test-cron-secret"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.backfilled).toBe(1);
    expect(mockFetchCardVariants).toHaveBeenCalledWith(
      expect.objectContaining({ tcgPlayerId: "42360", historyWindow: "1y" })
    );

    // One bulk createMany covering all 3 days (2 history points + today's live price),
    // not one create() per day.
    expect(mockPrisma.priceHistory.createMany).toHaveBeenCalledTimes(1);
    const created = mockPrisma.priceHistory.createMany.mock.calls[0][0].data;
    expect(created).toHaveLength(3);
    expect(created).toContainEqual(
      expect.objectContaining({ capturedAt: new Date("2026-09-10"), priceCents: Math.round(10 * 1.29 * 100) })
    );
    expect(created).toContainEqual(
      expect.objectContaining({ capturedAt: new Date("2026-09-11"), priceCents: Math.round(11 * 1.29 * 100) })
    );
  });

  it("updates instead of creating a day that already has a row (e.g. today, from the daily refresh)", async () => {
    mockPrisma.pokemonCardCatalog.findMany.mockResolvedValue([
      { id: "pkm-1", tcgPlayerId: "42360", language: "English" },
    ]);
    mockFetchCardVariants.mockResolvedValue([CARD_WITH_HISTORY]);
    mockPrisma.priceHistory.findMany.mockResolvedValue([
      { id: "existing-today-row", capturedAt: new Date(new Date().toISOString().slice(0, 10)) },
    ]);

    await GET(makeRequest("test-cron-secret"));

    expect(mockPrisma.priceHistory.update).toHaveBeenCalledWith({
      where: { id: "existing-today-row" },
      data: { priceCents: Math.round(12 * 1.29 * 100) },
    });
    // The 2 history-array days still go through createMany; only today was excluded.
    const created = mockPrisma.priceHistory.createMany.mock.calls[0][0].data;
    expect(created).toHaveLength(2);
  });

  it("marks a successfully backfilled card so it's never queried again", async () => {
    mockPrisma.pokemonCardCatalog.findMany.mockResolvedValue([
      { id: "pkm-1", tcgPlayerId: "42360", language: "English" },
    ]);
    mockFetchCardVariants.mockResolvedValue([CARD_WITH_HISTORY]);

    await GET(makeRequest("test-cron-secret"));

    expect(mockPrisma.pokemonCardCatalog.update).toHaveBeenCalledWith({
      where: { id: "pkm-1" },
      data: { priceBackfilledAt: expect.any(Date) },
    });
  });

  it("leaves priceBackfilledAt untouched for a card whose vendor call fails, so it's retried later", async () => {
    mockPrisma.pokemonCardCatalog.findMany.mockResolvedValue([
      { id: "pkm-1", tcgPlayerId: "42360", language: "English" },
    ]);
    mockFetchCardVariants.mockRejectedValue(new Error("JustTCG request failed: 500"));

    const res = await GET(makeRequest("test-cron-secret"));
    const data = await res.json();

    expect(data.failed).toBe(1);
    expect(mockPrisma.pokemonCardCatalog.update).not.toHaveBeenCalled();
  });

  it("caps the per-run limit at 950 even if a larger value is requested", async () => {
    await GET(makeRequest("test-cron-secret", "?limit=5000"));

    expect(mockPrisma.pokemonCardCatalog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 950 })
    );
  });

  it("gives Riftbound the remaining slice of the limit after Pokemon cards are counted", async () => {
    mockPrisma.pokemonCardCatalog.findMany.mockResolvedValue(
      Array.from({ length: 3 }, (_, i) => ({ id: `pkm-${i}`, tcgPlayerId: `p${i}` }))
    );

    await GET(makeRequest("test-cron-secret", "?limit=10"));

    expect(mockPrisma.riftboundCardCatalog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 7 })
    );
  });

  it("reports how many cards are still pending after this run", async () => {
    mockPrisma.pokemonCardCatalog.count.mockResolvedValue(4);
    mockPrisma.riftboundCardCatalog.count.mockResolvedValue(6);

    const res = await GET(makeRequest("test-cron-secret"));
    const data = await res.json();

    expect(data.remaining).toBe(10);
  });
});
