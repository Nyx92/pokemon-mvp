import { describe, it, expect } from "vitest";
import { computeFacets } from "@/lib/marketplaceFacets";
import type { CardBrowseIndexItem } from "@/types/card";

const ITEMS: CardBrowseIndexItem[] = [
  { id: "1", title: "Charizard", setName: "Base Set", rarity: "Rare Holo", type: null, language: "English", condition: "Near Mint", game: "POKEMON" },
  { id: "2", title: "Blastoise", setName: "Base Set", rarity: "Rare Holo", type: null, language: "English", condition: "Near Mint", game: "POKEMON" },
  { id: "3", title: "Pikachu", setName: "Jungle", rarity: "Common", type: null, language: "Japanese", condition: "PSA 10", game: "POKEMON" },
  { id: "4", title: "Vi - Peacekeeper", setName: "Unleashed", rarity: "Rare", type: "Unit", language: "English", condition: "Near Mint", game: "RIFTBOUND" },
  { id: "5", title: "Fury Rune", setName: "Unleashed", rarity: "Common", type: "Rune", language: "English", condition: "Lightly Played", game: "RIFTBOUND" },
];

describe("computeFacets", () => {
  it("tallies sets and rarities scoped to the selected game", () => {
    const facets = computeFacets(ITEMS, "POKEMON");
    expect(facets.sets).toEqual([
      { value: "Base Set", count: 2 },
      { value: "Jungle", count: 1 },
    ]);
    expect(facets.rarities).toEqual([
      { value: "Rare Holo", count: 2 },
      { value: "Common", count: 1 },
    ]);
  });

  it("tallies conditions scoped to the selected game", () => {
    expect(computeFacets(ITEMS, "POKEMON").conditions).toEqual([
      { value: "Near Mint", count: 2 },
      { value: "PSA 10", count: 1 },
    ]);
    expect(computeFacets(ITEMS, "RIFTBOUND").conditions).toEqual([
      { value: "Near Mint", count: 1 },
      { value: "Lightly Played", count: 1 },
    ]);
  });

  it("only populates languages and types when the selected game is RIFTBOUND / POKEMON respectively", () => {
    // Riftbound listings always resolve to "English" (no real per-card
    // language column), so a language filter isn't a meaningful facet there.
    expect(computeFacets(ITEMS, "RIFTBOUND").languages).toEqual([]);
    expect(computeFacets(ITEMS, "POKEMON").languages).toEqual([
      { value: "English", count: 2 },
      { value: "Japanese", count: 1 },
    ]);

    expect(computeFacets(ITEMS, "POKEMON").types).toEqual([]);
    expect(computeFacets(ITEMS, "RIFTBOUND").types).toEqual([
      { value: "Unit", count: 1 },
      { value: "Rune", count: 1 },
    ]);
  });

  it("excludes items with a null setName/rarity from those tallies instead of counting a null bucket", () => {
    const withNulls: CardBrowseIndexItem[] = [
      ...ITEMS,
      { id: "6", title: "Mystery Card", setName: null, rarity: null, type: null, language: "English", condition: "Near Mint", game: "POKEMON" },
    ];
    const facets = computeFacets(withNulls, "POKEMON");
    const setTotal = facets.sets.reduce((sum, s) => sum + s.count, 0);
    expect(setTotal).toBe(3); // unaffected by the null-setName item
  });

  it("returns empty facets for an empty item list", () => {
    expect(computeFacets([], "POKEMON")).toEqual({
      sets: [], rarities: [], types: [], languages: [], conditions: [],
    });
  });
});
