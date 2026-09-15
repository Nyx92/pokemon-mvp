import { describe, it, expect, vi, beforeEach } from "vitest";
import { importCatalogDelta } from "@/lib/catalogDeltaImport";

const mockPrisma = {
  pokemonCardCatalog: { upsert: vi.fn(), findUnique: vi.fn() },
  riftboundCardCatalog: { upsert: vi.fn(), findUnique: vi.fn() },
} as any;

beforeEach(() => vi.clearAllMocks());

describe("importCatalogDelta", () => {
  it("upserts each Pokemon card by tcgPlayerId, mapping delta fields to catalog columns", async () => {
    mockPrisma.pokemonCardCatalog.upsert.mockResolvedValue({});
    mockPrisma.pokemonCardCatalog.findUnique.mockResolvedValue({ id: "existing" });
    const result = await importCatalogDelta(mockPrisma, {
      game: "POKEMON",
      generatedAt: "2026-09-16T00:00:00Z",
      cards: [{
        externalId: "swsh3-136", tcgPlayerId: "192391", name: "Charizard VMAX",
        language: "English", imageUrl: "https://assets.tcgdex.net/en/swsh/swsh3/136/high.webp",
        setNameEn: "Darkness Ablaze", rarity: "Secret Rare", setId: "swsh3", localId: "136",
      }],
    });

    expect(mockPrisma.pokemonCardCatalog.upsert).toHaveBeenCalledWith({
      where: { tcgPlayerId: "192391" },
      update: expect.objectContaining({ nameEn: "Charizard VMAX", imageUrl: "https://assets.tcgdex.net/en/swsh/swsh3/136/high.webp" }),
      create: expect.objectContaining({ externalId: "swsh3-136", tcgPlayerId: "192391", nameEn: "Charizard VMAX" }),
    });
    expect(result).toEqual({ created: 0, updated: 1 });
  });

  it("counts created vs updated based on whether upsert returned a pre-existing id", async () => {
    // Prisma's upsert doesn't itself report created-vs-updated, so the
    // importer checks first via findUnique before upserting.
    mockPrisma.pokemonCardCatalog.upsert.mockResolvedValue({});
    mockPrisma.pokemonCardCatalog.findUnique = vi.fn()
      .mockResolvedValueOnce(null)         // card 1: doesn't exist yet -> created
      .mockResolvedValueOnce({ id: "x" }); // card 2: exists -> updated

    const result = await importCatalogDelta(mockPrisma, {
      game: "POKEMON",
      generatedAt: "2026-09-16T00:00:00Z",
      cards: [
        { externalId: "a", tcgPlayerId: "1", name: "A", imageUrl: null },
        { externalId: "b", tcgPlayerId: "2", name: "B", imageUrl: null },
      ],
    });

    expect(result).toEqual({ created: 1, updated: 1 });
  });

  it("upserts Riftbound cards against riftboundCardCatalog instead", async () => {
    mockPrisma.riftboundCardCatalog.upsert.mockResolvedValue({});
    mockPrisma.riftboundCardCatalog.findUnique = vi.fn().mockResolvedValue(null);

    await importCatalogDelta(mockPrisma, {
      game: "RIFTBOUND",
      generatedAt: "2026-09-16T00:00:00Z",
      cards: [{ externalId: "unl-1-219", tcgPlayerId: "500", name: "Test Card", imageUrl: null, setLabel: "Unleashed", rarity: "Common", collectorNumber: "1", type: "Unit", supertype: "" }],
    });

    expect(mockPrisma.riftboundCardCatalog.upsert).toHaveBeenCalled();
    expect(mockPrisma.pokemonCardCatalog.upsert).not.toHaveBeenCalled();
  });

  it("skips a card with no tcgPlayerId — nothing to key an upsert on", async () => {
    const result = await importCatalogDelta(mockPrisma, {
      game: "POKEMON",
      generatedAt: "2026-09-16T00:00:00Z",
      cards: [{ externalId: "a", tcgPlayerId: null, name: "A", imageUrl: null }],
    });
    expect(mockPrisma.pokemonCardCatalog.upsert).not.toHaveBeenCalled();
    expect(result).toEqual({ created: 0, updated: 0 });
  });
});
