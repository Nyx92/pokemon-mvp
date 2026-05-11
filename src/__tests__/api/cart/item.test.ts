import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Tests for PATCH and DELETE /api/cart/[itemId].
 *
 * PATCH  → toggles the selected flag on a single cart item (auth + ownership check).
 * DELETE → removes a single cart item (auth + ownership check).
 */

// ── STEP 1: Create mock objects ───────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  cartItem: {
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

// ── STEP 2: Register fakes ────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

// ── STEP 3: Import code under test ────────────────────────────────────────────

import { PATCH, DELETE } from "@/app/api/cart/[itemId]/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

const PARAMS = { params: { itemId: "item-1" } };
const SESSION = { user: { id: "user-1" } };

// Item owned by the session user
const OWNED_ITEM = {
  id: "item-1",
  selected: false,
  cart: { userId: "user-1" },
};

// Item owned by a different user (forbidden)
const OTHER_ITEM = {
  id: "item-1",
  selected: true,
  cart: { userId: "user-2" },
};

function patchRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/cart/item-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteRequest() {
  return new NextRequest("http://localhost/api/cart/item-1", { method: "DELETE" });
}

// ═════════════════════════════════════════════════════════════════════════════
// PATCH /api/cart/[itemId]
// ═════════════════════════════════════════════════════════════════════════════

describe("PATCH /api/cart/[itemId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  // What's being tested: the auth gate.
  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await PATCH(patchRequest({ selected: true }), PARAMS);
    expect(res.status).toBe(401);
  });

  // What's being tested: the request body must include a boolean `selected`.
  it("returns 400 when selected is not a boolean", async () => {
    const res = await PATCH(patchRequest({ selected: "yes" }), PARAMS);
    expect(res.status).toBe(400);
  });

  // What's being tested: users cannot modify items that belong to other users.
  it("returns 403 when the item belongs to another user", async () => {
    mockPrisma.cartItem.findUnique.mockResolvedValueOnce(OTHER_ITEM);
    const res = await PATCH(patchRequest({ selected: true }), PARAMS);
    expect(res.status).toBe(403);
    expect(mockPrisma.cartItem.update).not.toHaveBeenCalled();
  });

  // What's being tested: the happy path — selected flag is toggled to true.
  it("updates selected to true and returns the new value", async () => {
    mockPrisma.cartItem.findUnique.mockResolvedValueOnce(OWNED_ITEM);
    mockPrisma.cartItem.update.mockResolvedValueOnce({ id: "item-1", selected: true });

    const res = await PATCH(patchRequest({ selected: true }), PARAMS);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.selected).toBe(true);
    expect(mockPrisma.cartItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { selected: true },
    });
  });

  // What's being tested: 404 is returned when the item does not exist.
  it("returns 404 when item does not exist", async () => {
    mockPrisma.cartItem.findUnique.mockResolvedValueOnce(null);
    const res = await PATCH(patchRequest({ selected: true }), PARAMS);
    expect(res.status).toBe(404);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DELETE /api/cart/[itemId]
// ═════════════════════════════════════════════════════════════════════════════

describe("DELETE /api/cart/[itemId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  // What's being tested: the auth gate.
  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await DELETE(deleteRequest(), PARAMS);
    expect(res.status).toBe(401);
  });

  // What's being tested: users cannot delete items that belong to other users.
  it("returns 403 when the item belongs to another user", async () => {
    mockPrisma.cartItem.findUnique.mockResolvedValueOnce(OTHER_ITEM);
    const res = await DELETE(deleteRequest(), PARAMS);
    expect(res.status).toBe(403);
    expect(mockPrisma.cartItem.delete).not.toHaveBeenCalled();
  });

  // What's being tested: the happy path — item is deleted.
  it("deletes the item and returns success", async () => {
    mockPrisma.cartItem.findUnique.mockResolvedValueOnce(OWNED_ITEM);
    mockPrisma.cartItem.delete.mockResolvedValueOnce({});

    const res = await DELETE(deleteRequest(), PARAMS);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockPrisma.cartItem.delete).toHaveBeenCalledWith({
      where: { id: "item-1" },
    });
  });

  // What's being tested: 404 is returned when the item does not exist.
  it("returns 404 when item does not exist", async () => {
    mockPrisma.cartItem.findUnique.mockResolvedValueOnce(null);
    const res = await DELETE(deleteRequest(), PARAMS);
    expect(res.status).toBe(404);
  });
});
