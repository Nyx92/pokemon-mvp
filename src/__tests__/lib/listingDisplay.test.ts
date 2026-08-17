import { describe, it, expect, vi } from "vitest";
import {
  listingCatalogInclude,
  resolveListingDisplay,
  withListingDisplay,
  findOrCreatePokemonCatalogEntry,
  updatePokemonCatalogEntry,
} from "@/lib/listingDisplay";

const POKEMON_LISTING = {
  id: "listing-1",
  price: 5000,
  game: "POKEMON",
  pokemonCardId: "pkc-1",
  riftboundCardId: null,
  pokemonCard: {
    id: "pkc-1",
    nameEn: "Charizard",
    rarity: "Rare Holo",
    setNameEn: "Base Set",
    language: "English",
    localId: "004",
    tcgPlayerId: "tcg-1",
  },
  riftboundCard: null,
};

const RIFTBOUND_LISTING = {
  id: "listing-2",
  price: 2500,
  game: "RIFTBOUND",
  pokemonCardId: null,
  riftboundCardId: "rbc-1",
  pokemonCard: null,
  riftboundCard: {
    id: "rbc-1",
    name: "Vi - Peacekeeper",
    rarity: "Rare",
    setLabel: "Unleashed",
    collectorNumber: "176",
    tcgPlayerId: null,
  },
};

describe("resolveListingDisplay", () => {
  it("resolves display fields from pokemonCard when set", () => {
    expect(resolveListingDisplay(POKEMON_LISTING as any)).toEqual({
      title: "Charizard",
      rarity: "Rare Holo",
      setName: "Base Set",
      language: "English",
      cardNumber: "004",
      tcgPlayerId: "tcg-1",
    });
  });

  it("resolves display fields from riftboundCard when set, defaulting language to English", () => {
    expect(resolveListingDisplay(RIFTBOUND_LISTING as any)).toEqual({
      title: "Vi - Peacekeeper",
      rarity: "Rare",
      setName: "Unleashed",
      language: "English",
      cardNumber: "176",
      tcgPlayerId: "",
    });
  });

  it("throws when neither catalog relation is populated", () => {
    const broken = { ...POKEMON_LISTING, pokemonCard: null, riftboundCard: null };
    expect(() => resolveListingDisplay(broken as any)).toThrow(
      /has no catalog reference/
    );
  });
});

describe("withListingDisplay", () => {
  it("merges resolved display fields and strips the raw catalog relations", () => {
    const result = withListingDisplay(POKEMON_LISTING as any);
    expect(result).toMatchObject({
      id: "listing-1",
      price: 5000,
      title: "Charizard",
      rarity: "Rare Holo",
      setName: "Base Set",
      language: "English",
      cardNumber: "004",
      tcgPlayerId: "tcg-1",
    });
    expect(result).not.toHaveProperty("pokemonCard");
    expect(result).not.toHaveProperty("riftboundCard");
  });
});

describe("listingCatalogInclude", () => {
  it("includes both catalog relations", () => {
    expect(listingCatalogInclude).toEqual({ pokemonCard: true, riftboundCard: true });
  });
});

describe("findOrCreatePokemonCatalogEntry", () => {
  const fields = {
    title: "Pikachu",
    setName: "Jungle",
    rarity: "Common",
    tcgPlayerId: "tcg-99",
    language: "English",
    cardNumber: "60",
  };

  it("reuses an existing catalog row matched by tcgPlayerId", async () => {
    const existing = { id: "pkc-existing", tcgPlayerId: "tcg-99" };
    const tx = {
      pokemonCardCatalog: {
        findFirst: vi.fn().mockResolvedValue(existing),
        create: vi.fn(),
      },
    };

    const result = await findOrCreatePokemonCatalogEntry(tx as any, fields);

    expect(result).toBe(existing);
    expect(tx.pokemonCardCatalog.findFirst).toHaveBeenCalledWith({
      where: { tcgPlayerId: "tcg-99" },
    });
    expect(tx.pokemonCardCatalog.create).not.toHaveBeenCalled();
  });

  it("creates a new catalog row when no match exists", async () => {
    const created = { id: "pkc-new" };
    const tx = {
      pokemonCardCatalog: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(created),
      },
    };

    const result = await findOrCreatePokemonCatalogEntry(tx as any, fields);

    expect(result).toBe(created);
    expect(tx.pokemonCardCatalog.create).toHaveBeenCalledWith({
      data: {
        externalId: "manual-tcg-99",
        nameEn: "Pikachu",
        setNameEn: "Jungle",
        rarity: "Common",
        language: "English",
        localId: "60",
        tcgPlayerId: "tcg-99",
        setId: "tcg-99",
      },
    });
  });

  it("stores a null localId when cardNumber is empty", async () => {
    const tx = {
      pokemonCardCatalog: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "pkc-new" }),
      },
    };

    await findOrCreatePokemonCatalogEntry(tx as any, { ...fields, cardNumber: "" });

    expect(tx.pokemonCardCatalog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ localId: null }) })
    );
  });
});

describe("updatePokemonCatalogEntry", () => {
  it("updates the existing catalog row by id with the submitted fields", async () => {
    const updated = { id: "pkc-1", nameEn: "New Title" };
    const tx = {
      pokemonCardCatalog: {
        update: vi.fn().mockResolvedValue(updated),
      },
    };

    const result = await updatePokemonCatalogEntry(tx as any, "pkc-1", {
      title: "New Title",
      setName: "New Set",
      rarity: "Rare",
      tcgPlayerId: "tcg-5",
      language: "English",
      cardNumber: "010",
    });

    expect(result).toBe(updated);
    expect(tx.pokemonCardCatalog.update).toHaveBeenCalledWith({
      where: { id: "pkc-1" },
      data: {
        nameEn: "New Title",
        setNameEn: "New Set",
        rarity: "Rare",
        language: "English",
        localId: "010",
        tcgPlayerId: "tcg-5",
      },
    });
  });

  it("stores a null localId when cardNumber is empty", async () => {
    const tx = { pokemonCardCatalog: { update: vi.fn().mockResolvedValue({ id: "pkc-1" }) } };
    await updatePokemonCatalogEntry(tx as any, "pkc-1", {
      title: "T", setName: "S", rarity: "R", tcgPlayerId: "tcg-1", language: "English", cardNumber: "",
    });
    expect(tx.pokemonCardCatalog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ localId: null }) })
    );
  });
});
