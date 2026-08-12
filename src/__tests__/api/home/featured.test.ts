import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/home/featured
 *
 * Public, unauthenticated homepage data source (best sellers, highest
 * transacted, newly listed, auctions ending soon). Because it has no auth
 * check at all, it must never include a card owner's email — anyone can
 * curl this endpoint. Commit 6410447 fixed the equivalent leak on
 * /api/cards and /api/cards/[id]; this route was missed.
 */

const mockPrisma = vi.hoisted(() => ({
  bestSeller: { findMany: vi.fn() },
  card: { findFirst: vi.fn(), findMany: vi.fn() },
  auction: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/home/featured/route";

function makeCard(overrides: Partial<any> = {}) {
  return {
    id: "card-1",
    title: "Charizard",
    price: 1000,
    forSale: true,
    tcgPlayerId: "tcg-1",
    binder: null,
    owner: { id: "owner-1", username: "Ash" },
    ...overrides,
  };
}

describe("GET /api/home/featured", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.bestSeller.findMany.mockResolvedValue([{ tcgPlayerId: "tcg-1" }]);
    mockPrisma.card.findFirst.mockResolvedValue(makeCard());
    mockPrisma.$queryRaw.mockResolvedValue([{ tcgPlayerId: "tcg-1", count: BigInt(3) }]);
    mockPrisma.card.findMany.mockResolvedValue([makeCard()]);
    mockPrisma.auction.findMany.mockResolvedValue([]);
  });

  it("never includes the card owner's email in bestSellers, highestTransacted, or newlyListed", async () => {
    const res = await GET();
    const body = await res.json();

    for (const list of [body.bestSellers, body.highestTransacted, body.newlyListed]) {
      for (const card of list) {
        expect(card.owner).toEqual({ id: "owner-1", username: "Ash" });
        expect(card.owner.email).toBeUndefined();
      }
    }
  });
});
