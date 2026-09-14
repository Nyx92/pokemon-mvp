import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/user/cards/browse-index — lightweight, full-collection
 * projection feeding My Collection's client-side fuzzy search (mirrors
 * GET /api/cards/browse-index's role for the marketplace).
 */

const mockPrisma = vi.hoisted(() => ({
  listing: { findMany: vi.fn() },
}));
const mockGetServerSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { GET } from "@/app/api/user/cards/browse-index/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
  mockPrisma.listing.findMany.mockResolvedValue([]);
});

describe("GET /api/user/cards/browse-index", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mockPrisma.listing.findMany).not.toHaveBeenCalled();
  });

  it("scopes to the caller's own uncollected listings", async () => {
    await GET();
    expect(mockPrisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: "user-1", collectedAt: null } })
    );
  });

  it.each([
    ["for_sale", { forSale: true, inAuction: false, collectionRequestId: null }],
    ["in_auction", { forSale: false, inAuction: true, collectionRequestId: null }],
    ["pending_collection", { forSale: false, inAuction: false, collectionRequestId: "req-1" }],
    ["available", { forSale: false, inAuction: false, collectionRequestId: null }],
  ])("derives status=%s", async (status, overrides) => {
    mockPrisma.listing.findMany.mockResolvedValue([
      {
        id: "l1", game: "POKEMON", condition: "NM",
        pokemonCard: { nameEn: "Pikachu", rarity: "Common", setNameEn: "Base Set", language: "English" },
        riftboundCard: null,
        ...overrides,
      },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body.items[0]).toMatchObject({ id: "l1", title: "Pikachu", status });
  });

  // collectionRequestId takes priority over inAuction/forSale — mirrors
  // GET /api/user/cards's identical precedence (see its own test file).
  it("prioritizes pending_collection over inAuction/forSale when both are set", async () => {
    mockPrisma.listing.findMany.mockResolvedValue([
      {
        id: "l1", game: "POKEMON", condition: "NM",
        forSale: true, inAuction: true, collectionRequestId: "req-1",
        pokemonCard: { nameEn: "Pikachu", rarity: "Common", setNameEn: "Base Set", language: "English" },
        riftboundCard: null,
      },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body.items[0].status).toBe("pending_collection");
  });
});
