import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/cards/[id]
 *
 * Public card detail lookup + per-viewer watchlist flag. The card lookup and
 * the watchlist lookup are independent of each other and are fetched
 * concurrently via Promise.all. Card identity (title/rarity/etc.) is now
 * resolved from whichever catalog relation (pokemonCard/riftboundCard) is
 * populated on the Listing row.
 */

const mockPrisma = vi.hoisted(() => ({
  listing: { findUnique: vi.fn() },
  cardWatchlist: { findUnique: vi.fn() },
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
// The route module creates a Supabase client at module scope (used by PUT,
// not GET) — mock it out so importing the module doesn't require real
// SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY env vars, matching the pattern in
// route.test.ts and put-card.test.ts for this same route file.
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({})),
}));

import { GET } from "@/app/api/cards/[id]/route";

const LISTING = {
  id: "card-1",
  price: 5000,
  binder: null,
  owner: { id: "owner-1", username: "Ash" },
  _count: { watchlist: 3 },
  pokemonCard: {
    nameEn: "Charizard",
    rarity: "Rare Holo",
    setNameEn: "Base Set",
    language: "English",
    localId: "004",
    tcgPlayerId: "tcg-1",
  },
  riftboundCard: null,
};

describe("GET /api/cards/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.listing.findUnique.mockResolvedValue(LISTING);
    mockPrisma.cardWatchlist.findUnique.mockResolvedValue(null);
  });

  it("returns 404 when the card doesn't exist", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockPrisma.listing.findUnique.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/cards/card-1"), { params: Promise.resolve({ id: "card-1" }) });
    expect(res.status).toBe(404);
  });

  it("returns watchlistedByUser: false and skips the watchlist query for an anonymous viewer", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/cards/card-1"), { params: Promise.resolve({ id: "card-1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.card.watchlistedByUser).toBe(false);
    expect(body.card.watchlistCount).toBe(3);
    expect(body.card.price).toBe(50); // cents → dollars
    expect(body.card.title).toBe("Charizard"); // resolved via pokemonCard
    expect(mockPrisma.cardWatchlist.findUnique).not.toHaveBeenCalled();
  });

  it("returns watchlistedByUser: true when the logged-in viewer has watchlisted this card", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "viewer-1" } });
    mockPrisma.cardWatchlist.findUnique.mockResolvedValue({ listingId: "card-1", userId: "viewer-1" });

    const res = await GET(new Request("http://localhost/api/cards/card-1"), { params: Promise.resolve({ id: "card-1" }) });
    const body = await res.json();

    expect(body.card.watchlistedByUser).toBe(true);
    expect(mockPrisma.cardWatchlist.findUnique).toHaveBeenCalledWith({
      where: { listingId_userId: { listingId: "card-1", userId: "viewer-1" } },
    });
  });
});
