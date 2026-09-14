import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/user/cards
 *
 * Returns the authenticated user's own uncollected listings (used by My
 * Collection), paginated when ?page/?pageSize are given (unpaginated —
 * every matching row at once — otherwise, used by the browse-index fetch's
 * sibling full-set needs). Supports ?status and ?ids (search mode, mirrors
 * GET /api/cards) as server-side filters.
 */

const mockPrisma = vi.hoisted(() => ({
  listing: { findMany: vi.fn(), count: vi.fn() },
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
  forSale: false,
  inAuction: false,
  collectionRequest: null,
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

function getRequest(query = "") {
  return new Request(`http://localhost/api/user/cards${query ? `?${query}` : ""}`);
}

describe("GET /api/user/cards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockPrisma.listing.findMany.mockResolvedValue([LISTING]);
    mockPrisma.listing.count.mockResolvedValue(1);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await GET(getRequest());
    expect(res.status).toBe(401);
    expect(mockPrisma.listing.findMany).not.toHaveBeenCalled();
  });

  it("returns the user's listings with resolved display fields and no hasMore when unpaginated", async () => {
    const res = await GET(getRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cards).toHaveLength(1);
    expect(body.cards[0].id).toBe("listing-1");
    expect(body.cards[0].title).toBe("Blastoise");
    expect(body.cards[0].status).toBe("available");
    expect(body).not.toHaveProperty("hasMore");
    expect(mockPrisma.listing.count).not.toHaveBeenCalled();
  });

  it("scopes to the caller's own uncollected listings, ordered by createdAt desc then id", async () => {
    await GET(getRequest());

    expect(mockPrisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ ownerId: "user-1" }, { collectedAt: null }] },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      })
    );
  });

  it("paginates when page/pageSize are given, and computes hasMore from the total count", async () => {
    mockPrisma.listing.count.mockResolvedValue(50);

    const res = await GET(getRequest("page=2&pageSize=24"));
    const body = await res.json();

    expect(mockPrisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 24, take: 24 })
    );
    expect(body.hasMore).toBe(true); // page 2 * 24 = 48 < 50
  });

  it("hasMore is false on the last page", async () => {
    mockPrisma.listing.count.mockResolvedValue(48);
    const res = await GET(getRequest("page=2&pageSize=24"));
    expect((await res.json()).hasMore).toBe(false); // 2*24 = 48, not < 48
  });

  it.each([
    ["for_sale", { forSale: true }],
    ["in_auction", { inAuction: true }],
    ["pending_collection", { collectionRequestId: { not: null } }],
    ["available", { forSale: false, inAuction: false, collectionRequestId: null }],
  ])("filters by status=%s", async (status, expectedClause) => {
    await GET(getRequest(`status=${status}`));
    expect(mockPrisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ ownerId: "user-1" }, { collectedAt: null }, expectedClause] },
      })
    );
  });

  it("filters by ids (search mode)", async () => {
    await GET(getRequest("ids=l1&ids=l2"));
    expect(mockPrisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ ownerId: "user-1" }, { collectedAt: null }, { id: { in: ["l1", "l2"] } }] },
      })
    );
  });

  it("derives status from collectionRequest/inAuction/forSale, in that priority order", async () => {
    mockPrisma.listing.findMany.mockResolvedValueOnce([
      { ...LISTING, id: "l-forsale", forSale: true },
      { ...LISTING, id: "l-auction", inAuction: true },
      { ...LISTING, id: "l-pickup", collectionRequest: { id: "req-1", requestRef: "PU-2609-AAAA", status: "PACKED" } },
    ]);

    const res = await GET(getRequest());
    const body = await res.json();

    const byId = Object.fromEntries(body.cards.map((c: any) => [c.id, c]));
    expect(byId["l-forsale"].status).toBe("for_sale");
    expect(byId["l-auction"].status).toBe("in_auction");
    expect(byId["l-pickup"].status).toBe("pending_collection");
    expect(byId["l-pickup"].collectionRequestRef).toBe("PU-2609-AAAA");
    expect(byId["l-pickup"].collectionRequestStatus).toBe("PACKED");
  });
});
