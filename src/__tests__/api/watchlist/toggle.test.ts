import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * POST /api/cards/[id]/watchlist
 *
 * Toggles the watchlist status for the authenticated user on a specific card.
 * If the user has not watchlisted the card, it adds it. If they have, it removes it.
 * Returns { watchlisted: boolean, count: number } in both cases.
 */

// ── STEP 1: Create mock objects ───────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  cardWatchlist: {
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

// ── STEP 2: Register fakes ────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

// ── STEP 3: Import code under test ────────────────────────────────────────────

import { POST } from "@/app/api/cards/[id]/watchlist/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

const PARAMS = { params: { id: "card-1" } };
const SESSION = { user: { id: "user-1" } };

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/cards/[id]/watchlist
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/cards/[id]/watchlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockPrisma.cardWatchlist.count.mockResolvedValue(1);
  });

  // What's being tested: the auth gate.
  //
  // Unauthenticated requests must be rejected before any DB access.

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await POST(new NextRequest("http://localhost"), PARAMS);
    expect(res.status).toBe(401);
    expect(mockPrisma.cardWatchlist.findUnique).not.toHaveBeenCalled();
  });

  // What's being tested: the add path.
  //
  // When the user has not watchlisted the card (findUnique returns null),
  // the route must create a new entry and return watchlisted: true.

  it("adds the card when not already watchlisted", async () => {
    mockPrisma.cardWatchlist.findUnique.mockResolvedValueOnce(null);
    mockPrisma.cardWatchlist.create.mockResolvedValueOnce({});
    mockPrisma.cardWatchlist.count.mockResolvedValueOnce(5);

    const res = await POST(new NextRequest("http://localhost"), PARAMS);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ watchlisted: true, count: 5 });
    expect(mockPrisma.cardWatchlist.create).toHaveBeenCalledWith({
      data: { cardId: "card-1", userId: "user-1" },
    });
    expect(mockPrisma.cardWatchlist.delete).not.toHaveBeenCalled();
  });

  // What's being tested: the remove path.
  //
  // When the user has already watchlisted the card (findUnique returns a row),
  // the route must delete that row and return watchlisted: false.

  it("removes the card when already watchlisted", async () => {
    const existing = { id: "wl-entry-1", cardId: "card-1", userId: "user-1" };
    mockPrisma.cardWatchlist.findUnique.mockResolvedValueOnce(existing);
    mockPrisma.cardWatchlist.delete.mockResolvedValueOnce({});
    mockPrisma.cardWatchlist.count.mockResolvedValueOnce(4);

    const res = await POST(new NextRequest("http://localhost"), PARAMS);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ watchlisted: false, count: 4 });
    expect(mockPrisma.cardWatchlist.delete).toHaveBeenCalledWith({
      where: { id: "wl-entry-1" },
    });
    expect(mockPrisma.cardWatchlist.create).not.toHaveBeenCalled();
  });
});
