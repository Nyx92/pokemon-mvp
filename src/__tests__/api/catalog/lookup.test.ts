import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/catalog/lookup?game=&tcgPlayerId=
 *
 * Read-only, admin-gated lookup used by the upload form to check whether a
 * catalog row already exists for a given (game, tcgPlayerId) pair before
 * deciding whether to show catalog-identity fields or a "card found"
 * summary. No side effects — never creates or updates anything.
 */

const mockPrisma = vi.hoisted(() => ({
  pokemonCardCatalog: { findFirst: vi.fn() },
  riftboundCardCatalog: { findFirst: vi.fn() },
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { GET } from "@/app/api/catalog/lookup/route";

const ADMIN_SESSION = { user: { id: "admin-1", role: "admin" } };
const USER_SESSION = { user: { id: "user-1", role: "user" } };

function lookupRequest(query: Record<string, string>) {
  const params = new URLSearchParams(query);
  return new Request(`http://localhost/api/catalog/lookup?${params.toString()}`);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/catalog/lookup", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET(lookupRequest({ game: "POKEMON", tcgPlayerId: "tcg-1" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated but not an admin", async () => {
    mockGetServerSession.mockResolvedValue(USER_SESSION);
    const res = await GET(lookupRequest({ game: "POKEMON", tcgPlayerId: "tcg-1" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 for an unrecognized game value", async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION);
    const res = await GET(lookupRequest({ game: "MAGIC", tcgPlayerId: "tcg-1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when tcgPlayerId is missing", async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION);
    const res = await GET(lookupRequest({ game: "POKEMON", tcgPlayerId: "" }));
    expect(res.status).toBe(400);
  });

  it("returns found: false when no POKEMON catalog row matches", async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION);
    mockPrisma.pokemonCardCatalog.findFirst.mockResolvedValue(null);

    const res = await GET(lookupRequest({ game: "POKEMON", tcgPlayerId: "tcg-1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ found: false });
    expect(mockPrisma.pokemonCardCatalog.findFirst).toHaveBeenCalledWith({
      where: { tcgPlayerId: "tcg-1" },
      orderBy: { createdAt: "asc" },
    });
  });

  it("returns the resolved catalog summary, including language, when a POKEMON row matches", async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION);
    mockPrisma.pokemonCardCatalog.findFirst.mockResolvedValue({
      nameEn: "Charizard",
      setNameEn: "Base Set",
      rarity: "Rare Holo",
      localId: "004",
      language: "English",
    });

    const res = await GET(lookupRequest({ game: "POKEMON", tcgPlayerId: "tcg-1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      found: true,
      catalog: {
        title: "Charizard",
        setName: "Base Set",
        rarity: "Rare Holo",
        cardNumber: "004",
        language: "English",
      },
    });
  });

  it("orders by createdAt when looking up a POKEMON row, so a shared tcgPlayerId resolves deterministically", async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION);
    mockPrisma.pokemonCardCatalog.findFirst.mockResolvedValue(null);

    await GET(lookupRequest({ game: "POKEMON", tcgPlayerId: "tcg-1" }));

    expect(mockPrisma.pokemonCardCatalog.findFirst).toHaveBeenCalledWith({
      where: { tcgPlayerId: "tcg-1" },
      orderBy: { createdAt: "asc" },
    });
  });

  it("returns the resolved catalog summary, including the canonical image and type/supertype, when a RIFTBOUND row matches", async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION);
    mockPrisma.riftboundCardCatalog.findFirst.mockResolvedValue({
      name: "Vi - Peacekeeper",
      setLabel: "Unleashed",
      rarity: "Rare",
      collectorNumber: "176",
      imageUrl: "https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/vi.png",
      type: "Unit",
      supertype: "Champion",
    });

    const res = await GET(lookupRequest({ game: "RIFTBOUND", tcgPlayerId: "rift-tcg-1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      found: true,
      catalog: {
        title: "Vi - Peacekeeper",
        setName: "Unleashed",
        rarity: "Rare",
        cardNumber: "176",
        imageUrl: "https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/vi.png",
        type: "Unit",
        supertype: "Champion",
      },
    });
    expect(mockPrisma.riftboundCardCatalog.findFirst).toHaveBeenCalledWith({
      where: { tcgPlayerId: "rift-tcg-1" },
      orderBy: { createdAt: "asc" },
    });
    expect(mockPrisma.pokemonCardCatalog.findFirst).not.toHaveBeenCalled();
  });
});
