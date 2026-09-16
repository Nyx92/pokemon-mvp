import { describe, it, expect, vi } from "vitest";
import {
  listingCatalogInclude,
  resolveListingDisplay,
  withListingDisplay,
  findOrCreatePokemonCatalogEntry,
  updatePokemonCatalogEntry,
  findOrCreateRiftboundCatalogEntry,
  updateRiftboundCatalogEntry,
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

  it("includes type and supertype when the riftboundCard has them set", () => {
    const listingWithTypes = {
      ...RIFTBOUND_LISTING,
      riftboundCard: { ...RIFTBOUND_LISTING.riftboundCard, type: "Unit", supertype: "Champion" },
    };
    const result = resolveListingDisplay(listingWithTypes as any);
    expect(result.type).toBe("Unit");
    expect(result.supertype).toBe("Champion");
  });

  it("omits type and supertype for a pokemonCard listing", () => {
    const result = resolveListingDisplay(POKEMON_LISTING as any);
    expect(result.type).toBeUndefined();
    expect(result.supertype).toBeUndefined();
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

  it("upserts on tcgPlayerId, not overwriting an existing row's fields", async () => {
    const existing = { id: "pkc-existing", tcgPlayerId: "tcg-99" };
    const tx = {
      pokemonCardCatalog: {
        upsert: vi.fn().mockResolvedValue(existing),
      },
    };

    const result = await findOrCreatePokemonCatalogEntry(tx as any, fields);

    expect(result).toBe(existing);
    expect(tx.pokemonCardCatalog.upsert).toHaveBeenCalledWith({
      where: { tcgPlayerId: "tcg-99" },
      update: {},
      create: {
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

  it("stores a null localId in the create payload when cardNumber is empty", async () => {
    const tx = {
      pokemonCardCatalog: {
        upsert: vi.fn().mockResolvedValue({ id: "pkc-new" }),
      },
    };

    await findOrCreatePokemonCatalogEntry(tx as any, { ...fields, cardNumber: "" });

    expect(tx.pokemonCardCatalog.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ localId: null }) })
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

describe("findOrCreateRiftboundCatalogEntry", () => {
  const fields = {
    title: "Vi - Peacekeeper",
    setName: "Unleashed",
    rarity: "Rare",
    tcgPlayerId: "rift-tcg-99",
    cardNumber: "176",
    type: "Unit",
    supertype: "Champion",
  };

  it("upserts on tcgPlayerId, not overwriting an existing row's fields", async () => {
    const existing = { id: "rbc-existing", tcgPlayerId: "rift-tcg-99" };
    const tx = {
      riftboundCardCatalog: {
        upsert: vi.fn().mockResolvedValue(existing),
      },
    };

    const result = await findOrCreateRiftboundCatalogEntry(tx as any, fields);

    expect(result).toBe(existing);
    expect(tx.riftboundCardCatalog.upsert).toHaveBeenCalledWith({
      where: { tcgPlayerId: "rift-tcg-99" },
      update: {},
      create: {
        riftboundId: "manual-rift-tcg-99",
        name: "Vi - Peacekeeper",
        setLabel: "Unleashed",
        rarity: "Rare",
        collectorNumber: "176",
        type: "Unit",
        supertype: "Champion",
        tcgPlayerId: "rift-tcg-99",
        setId: "rift-tcg-99",
        imageUrl: "",
      },
    });
  });
});

describe("updateRiftboundCatalogEntry", () => {
  it("updates the existing catalog row by id with the submitted fields", async () => {
    const updated = { id: "rbc-1", name: "New Name" };
    const tx = {
      riftboundCardCatalog: {
        update: vi.fn().mockResolvedValue(updated),
      },
    };

    const result = await updateRiftboundCatalogEntry(tx as any, "rbc-1", {
      title: "New Name",
      setName: "New Set",
      rarity: "Rare",
      tcgPlayerId: "rift-tcg-5",
      cardNumber: "010",
      type: "Legend",
      supertype: "",
    });

    expect(result).toBe(updated);
    expect(tx.riftboundCardCatalog.update).toHaveBeenCalledWith({
      where: { id: "rbc-1" },
      data: {
        name: "New Name",
        setLabel: "New Set",
        rarity: "Rare",
        collectorNumber: "010",
        type: "Legend",
        supertype: "",
        tcgPlayerId: "rift-tcg-5",
      },
    });
  });
});
