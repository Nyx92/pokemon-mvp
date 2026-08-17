import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * PUT /api/cards/[id]
 *
 * Owner-only update path: a card owner can toggle forSale/price on their own
 * card. Tests here cover the guard that blocks re-listing a card for sale
 * while it's locked in an active auction (POST /api/auctions sets
 * inAuction: true and forSale: false — this route must not let the owner
 * silently undo that via a separate PUT while bids are live).
 */

const mockPrisma = vi.hoisted(() => ({
  listing: { findUnique: vi.fn(), update: vi.fn() },
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    authOptions: {},
  };
});
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ storage: { from: vi.fn() } })),
}));

import { PUT } from "@/app/api/cards/[id]/route";

const OWNER_SESSION = { user: { id: "owner-1", role: "user" } };

function putRequest(fields: Record<string, string>) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.append(k, v);
  return new Request("http://localhost/api/cards/card-1", { method: "PUT", body });
}

const LISTING = {
  id: "card-1",
  ownerId: "owner-1",
  price: 1000,
  forSale: true,
  inAuction: false,
};

describe("PUT /api/cards/[id] — owner update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(OWNER_SESSION);
    mockPrisma.listing.findUnique.mockResolvedValue(LISTING);
    mockPrisma.listing.update.mockResolvedValue({ ...LISTING, price: 1500, forSale: true });
  });

  it("returns 409 when the owner tries to list a card for sale while it's in an active auction", async () => {
    mockPrisma.listing.findUnique.mockResolvedValue({ ...LISTING, inAuction: true, forSale: false });

    const res = await PUT(putRequest({ price: "15", forSale: "true" }), { params: { id: "card-1" } });

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      error: "Cannot list a card for sale while it is in an active auction",
    });
    expect(mockPrisma.listing.update).not.toHaveBeenCalled();
  });

  it("allows unlisting (forSale: false) even while in an active auction", async () => {
    mockPrisma.listing.findUnique.mockResolvedValue({ ...LISTING, inAuction: true, forSale: false });

    const res = await PUT(putRequest({ price: "", forSale: "false" }), { params: { id: "card-1" } });

    expect(res.status).toBe(200);
    expect(mockPrisma.listing.update).toHaveBeenCalled();
  });

  it("allows the normal price/forSale update when not in an auction", async () => {
    const res = await PUT(putRequest({ price: "15", forSale: "true" }), { params: { id: "card-1" } });

    expect(res.status).toBe(200);
    expect(mockPrisma.listing.update).toHaveBeenCalledWith({
      where: { id: "card-1" },
      data: { price: 1500, forSale: true },
    });
  });

  it("returns 400 when forSale is true and price is zero", async () => {
    const res = await PUT(putRequest({ price: "0", forSale: "true" }), { params: { id: "card-1" } });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: "Price must be greater than $0 when listing a card for sale",
    });
    expect(mockPrisma.listing.update).not.toHaveBeenCalled();
  });

  it("returns 400 when forSale is true and price is negative", async () => {
    const res = await PUT(putRequest({ price: "-5", forSale: "true" }), { params: { id: "card-1" } });
    expect(res.status).toBe(400);
    expect(mockPrisma.listing.update).not.toHaveBeenCalled();
  });
});

describe("PUT /api/cards/[id] — admin update with shared guard", () => {
  const ADMIN_SESSION = { user: { id: "admin-1", role: "admin" } };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION);
    mockPrisma.listing.findUnique.mockResolvedValue(LISTING);
  });

  it("returns 409 when the admin tries to list a card for sale while it's in an active auction", async () => {
    mockPrisma.listing.findUnique.mockResolvedValue({ ...LISTING, inAuction: true, forSale: false });

    // Admin request with full fields (title, condition, ownerId, etc.) — the
    // guard runs before admin-specific validation, so it should 409 before
    // image validation or catalog lookup matter, but we construct a
    // realistic request anyway.
    const adminFields = {
      title: "Charizard Holo",
      condition: "Mint",
      ownerId: "owner-1",
      tcgPlayerId: "base1-4",
      language: "English",
      forSale: "true",
      price: "100",
    };

    const res = await PUT(putRequest(adminFields), { params: { id: "card-1" } });

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      error: "Cannot list a card for sale while it is in an active auction",
    });
    expect(mockPrisma.listing.update).not.toHaveBeenCalled();
  });
});
