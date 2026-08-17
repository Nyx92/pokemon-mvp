import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Tests for GET, POST, and DELETE /api/cart.
 *
 * GET  → groups cart items into packages by seller; includes userAddress.
 * POST → adds a listing (idempotent — adding the same listing twice is safe).
 * DELETE → clears all items or only selected ones (?selected=true).
 */

// ── STEP 1: Create mock objects ───────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  cart: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
  },
  cartItem: {
    findUnique: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
    deleteMany: vi.fn(),
  },
  listing: {
    findUnique: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

// ── STEP 2: Register fakes ────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

// ── STEP 3: Import code under test ────────────────────────────────────────────

import { GET, POST, DELETE } from "@/app/api/cart/route";

// ── Shared fixtures ───────────────────────────────────────────────────────────

const SESSION = { user: { id: "user-1" } };

function makeRequest(url = "http://localhost/api/cart", init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init);
}

function listingFixture(owner: { id: string; username: string | null }) {
  return {
    id: "listing-1",
    price: 5000,
    condition: "NM",
    imageUrls: [],
    forSale: true,
    pokemonCard: {
      nameEn: "Charizard",
      rarity: "Rare",
      setNameEn: "Base Set",
      language: "English",
      localId: "4/102",
      tcgPlayerId: "tcg-1",
    },
    riftboundCard: null,
    owner,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/cart
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /api/cart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  // What's being tested: the auth gate.
  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  // What's being tested: items are grouped by seller, prices are converted
  // from cents (DB storage) to dollars (API response), and card identity
  // fields are resolved via the catalog relation.
  it("groups items by seller, converts price from cents to dollars, and resolves catalog fields", async () => {
    const owner = { id: "seller-1", username: "seller" };
    const item = {
      id: "item-1",
      selected: true,
      createdAt: new Date("2024-01-01"),
      listing: listingFixture(owner),
    };

    mockPrisma.cart.upsert.mockResolvedValueOnce({ id: "cart-1", items: [item] });
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      firstName: "John",
      lastName: "Doe",
      username: "johndoe",
      address: "123 Main St",
      phoneNumber: "+65 9000 0000",
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.packages).toHaveLength(1);
    expect(body.packages[0].sellerId).toBe("seller-1");
    expect(body.packages[0].items[0].card.price).toBe(50); // cents → dollars
    expect(body.packages[0].items[0].card.title).toBe("Charizard");
    expect(body.userAddress?.name).toBe("John Doe");
  });

  // What's being tested: an empty cart returns an empty packages array.
  it("returns empty packages for an empty cart", async () => {
    mockPrisma.cart.upsert.mockResolvedValueOnce({ id: "cart-1", items: [] });
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.packages).toEqual([]);
  });

  // What's being tested: the listing owner's email must never reach the
  // response, and the query itself must not select it — asserting only on
  // the response body isn't enough here, since the mock below already
  // returns an email-free owner regardless of what select we pass Prisma;
  // reverting the route's `owner: { select: { id, username } }` back to
  // including `email: true` would still pass a body-only assertion.

  function cartItemFixture(owner: { id: string; username: string | null }) {
    return {
      id: "item-1",
      selected: true,
      createdAt: new Date("2025-01-01"),
      listing: listingFixture(owner),
    };
  }

  it("never includes the listing owner's email in the response or the query", async () => {
    mockPrisma.cart.upsert.mockResolvedValue({
      items: [cartItemFixture({ id: "owner-1", username: "Ash" })],
    });

    const res = await GET();
    const body = await res.json();

    const owner = body.packages[0].items[0].card.owner;
    expect(owner).toEqual({ id: "owner-1", username: "Ash" });
    expect(owner.email).toBeUndefined();
    expect(body.packages[0].sellerName).toBe("Ash");

    const upsertArgs = mockPrisma.cart.upsert.mock.calls[0][0];
    expect(upsertArgs.include.items.include.listing.include.owner).toEqual({
      select: { id: true, username: true },
    });
  });

  // What's being tested: the sellerName fallback used to read `owner.email`
  // when `username` was missing; now that email is no longer selected, it
  // must fall back to the literal string "Seller" instead of silently
  // becoming undefined.

  it("falls back sellerName to 'Seller' when the owner has no username", async () => {
    mockPrisma.cart.upsert.mockResolvedValue({
      items: [cartItemFixture({ id: "owner-1", username: null })],
    });

    const res = await GET();
    const body = await res.json();

    expect(body.packages[0].sellerName).toBe("Seller");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/cart
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/cart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  function postRequest(body: Record<string, unknown>) {
    return makeRequest("http://localhost/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  // What's being tested: the auth gate.
  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await POST(postRequest({ cardId: "listing-1" }));
    expect(res.status).toBe(401);
  });

  // What's being tested: missing body is rejected with 400.
  it("returns 400 when cardId is missing", async () => {
    const res = await POST(postRequest({}));
    expect(res.status).toBe(400);
  });

  // What's being tested: a user cannot add their own listing.
  it("returns 400 when the user tries to add their own card", async () => {
    mockPrisma.listing.findUnique.mockResolvedValueOnce({
      id: "listing-1",
      forSale: true,
      ownerId: "user-1", // same as session user
    });
    const res = await POST(postRequest({ cardId: "listing-1" }));
    expect(res.status).toBe(400);
  });

  // What's being tested: a non-for-sale listing is rejected.
  it("returns 400 when the card is not for sale", async () => {
    mockPrisma.listing.findUnique.mockResolvedValueOnce({
      id: "listing-1",
      forSale: false,
      ownerId: "seller-1",
    });
    const res = await POST(postRequest({ cardId: "listing-1" }));
    expect(res.status).toBe(400);
  });

  // What's being tested: a new listing is added and count is returned.
  it("creates a cart item and returns alreadyInCart: false", async () => {
    mockPrisma.listing.findUnique.mockResolvedValueOnce({
      id: "listing-1",
      forSale: true,
      ownerId: "seller-1",
    });
    mockPrisma.cart.upsert.mockResolvedValueOnce({ id: "cart-1" });
    mockPrisma.cartItem.findUnique.mockResolvedValueOnce(null); // not in cart yet
    mockPrisma.cartItem.create.mockResolvedValueOnce({ id: "item-1" });
    mockPrisma.cartItem.count.mockResolvedValueOnce(1);

    const res = await POST(postRequest({ cardId: "listing-1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.alreadyInCart).toBe(false);
    expect(body.count).toBe(1);
    expect(mockPrisma.cartItem.create).toHaveBeenCalledWith({
      data: { cartId: "cart-1", listingId: "listing-1", selected: true },
    });
  });

  // What's being tested: adding a listing that's already in the cart returns
  // alreadyInCart: true without creating a duplicate row, and the lookup
  // uses the renamed cartId_listingId compound key.
  it("returns alreadyInCart: true when card is already in cart", async () => {
    mockPrisma.listing.findUnique.mockResolvedValueOnce({
      id: "listing-1",
      forSale: true,
      ownerId: "seller-1",
    });
    mockPrisma.cart.upsert.mockResolvedValueOnce({ id: "cart-1" });
    mockPrisma.cartItem.findUnique.mockResolvedValueOnce({ id: "item-1" }); // already present
    mockPrisma.cartItem.count.mockResolvedValueOnce(3);

    const res = await POST(postRequest({ cardId: "listing-1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.alreadyInCart).toBe(true);
    expect(mockPrisma.cartItem.create).not.toHaveBeenCalled();
    expect(mockPrisma.cartItem.findUnique).toHaveBeenCalledWith({
      where: { cartId_listingId: { cartId: "cart-1", listingId: "listing-1" } },
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DELETE /api/cart
// ═════════════════════════════════════════════════════════════════════════════

describe("DELETE /api/cart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  // What's being tested: the auth gate.
  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await DELETE(makeRequest("http://localhost/api/cart", { method: "DELETE" }));
    expect(res.status).toBe(401);
  });

  // What's being tested: if the user has no cart, the route returns success
  // without touching the DB (graceful no-op).
  it("returns success with deleted: 0 when cart does not exist", async () => {
    mockPrisma.cart.findUnique.mockResolvedValueOnce(null);
    const res = await DELETE(makeRequest("http://localhost/api/cart", { method: "DELETE" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.deleted).toBe(0);
    expect(mockPrisma.cartItem.deleteMany).not.toHaveBeenCalled();
  });

  // What's being tested: without ?selected=true, all items are removed.
  it("removes all items when ?selected param is absent", async () => {
    mockPrisma.cart.findUnique.mockResolvedValueOnce({ id: "cart-1" });
    mockPrisma.cartItem.deleteMany.mockResolvedValueOnce({ count: 3 });

    const res = await DELETE(makeRequest("http://localhost/api/cart", { method: "DELETE" }));
    const body = await res.json();

    expect(body.deleted).toBe(3);
    expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartId: "cart-1" },
    });
  });

  // What's being tested: with ?selected=true only the checked items are removed.
  it("removes only selected items when ?selected=true", async () => {
    mockPrisma.cart.findUnique.mockResolvedValueOnce({ id: "cart-1" });
    mockPrisma.cartItem.deleteMany.mockResolvedValueOnce({ count: 2 });

    const res = await DELETE(
      makeRequest("http://localhost/api/cart?selected=true", { method: "DELETE" })
    );
    const body = await res.json();

    expect(body.deleted).toBe(2);
    expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartId: "cart-1", selected: true },
    });
  });
});
