import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/admin/collection-requests — staff only. Every open
 * (REQUESTED/PACKED) pickup request with its customer and cards.
 */

const mockPrisma = vi.hoisted(() => ({
  collectionRequest: { findMany: vi.fn() },
}));
const mockGetServerSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { GET } from "@/app/api/admin/collection-requests/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
  mockPrisma.collectionRequest.findMany.mockResolvedValue([]);
});

describe("GET /api/admin/collection-requests", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-admin", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1", role: "user" } });
    const res = await GET();
    expect(res.status).toBe(403);
    expect(mockPrisma.collectionRequest.findMany).not.toHaveBeenCalled();
  });

  it("queries only open statuses, oldest first, with customer and cards included", async () => {
    await GET();
    expect(mockPrisma.collectionRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { in: ["REQUESTED", "PACKED"] } },
        orderBy: { requestedAt: "asc" },
      })
    );
  });

  it("shapes each request with customer and resolved card display fields", async () => {
    mockPrisma.collectionRequest.findMany.mockResolvedValue([
      {
        id: "req-1", requestRef: "PU-2609-AAAA", status: "REQUESTED",
        requestedAt: new Date(), packedAt: null,
        user: { id: "user-1", username: "ash", firstName: "Ash", lastName: "Ketchum", email: "ash@example.com" },
        listings: [{
          id: "l1", condition: "NM",
          pokemonCard: { nameEn: "Pikachu", rarity: "Common", setNameEn: "Base Set", language: "English", localId: "25", tcgPlayerId: "tcg-1" },
          riftboundCard: null,
        }],
      },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body.requests[0].customer.username).toBe("ash");
    expect(body.requests[0].cards[0].title).toBe("Pikachu");
  });

  it("returns 500 on a DB error", async () => {
    mockPrisma.collectionRequest.findMany.mockRejectedValue(new Error("DB down"));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
