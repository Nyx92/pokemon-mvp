import { describe, it, expect } from "vitest";
import { assertValidListingCatalogRefs } from "@/lib/listingCatalog";

describe("assertValidListingCatalogRefs", () => {
  it("passes for a valid POKEMON listing", () => {
    expect(() =>
      assertValidListingCatalogRefs({ game: "POKEMON", pokemonCardId: "poke-1" })
    ).not.toThrow();
  });

  it("passes for a valid RIFTBOUND listing", () => {
    expect(() =>
      assertValidListingCatalogRefs({ game: "RIFTBOUND", riftboundCardId: "rift-1" })
    ).not.toThrow();
  });

  it("throws when both catalog IDs are set", () => {
    expect(() =>
      assertValidListingCatalogRefs({
        game: "POKEMON",
        pokemonCardId: "poke-1",
        riftboundCardId: "rift-1",
      })
    ).toThrow(/cannot reference both/i);
  });

  it("throws when neither catalog ID is set", () => {
    expect(() => assertValidListingCatalogRefs({ game: "POKEMON" })).toThrow(
      /must reference exactly one/i
    );
  });

  it("throws when game is POKEMON but pokemonCardId is missing", () => {
    expect(() =>
      assertValidListingCatalogRefs({ game: "POKEMON", riftboundCardId: "rift-1" })
    ).toThrow(/cannot reference both/i);
  });

  it("throws when game is RIFTBOUND but riftboundCardId is missing", () => {
    expect(() =>
      assertValidListingCatalogRefs({ game: "RIFTBOUND", pokemonCardId: "poke-1" })
    ).toThrow(/cannot reference both/i);
  });
});
