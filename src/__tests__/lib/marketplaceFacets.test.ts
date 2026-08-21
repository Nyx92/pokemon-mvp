import { describe, it, expect } from "vitest";
import { computeFacets } from "@/lib/marketplaceFacets";
import type { CardBrowseIndexItem } from "@/types/card";

const ITEMS: CardBrowseIndexItem[] = [
  { id: "1", title: "Charizard", setName: "Base Set", rarity: "Rare Holo", type: null, game: "POKEMON" },
  { id: "2", title: "Blastoise", setName: "Base Set", rarity: "Rare Holo", type: null, game: "POKEMON" },
  { id: "3", title: "Pikachu", setName: "Jungle", rarity: "Common", type: null, game: "POKEMON" },
  { id: "4", title: "Vi - Peacekeeper", setName: "Unleashed", rarity: "Rare", type: "Unit", game: "RIFTBOUND" },
  { id: "5", title: "Fury Rune", setName: "Unleashed", rarity: "Common", type: "Rune", game: "RIFTBOUND" },
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

  it("only populates types when the selected game is RIFTBOUND", () => {
    expect(computeFacets(ITEMS, "POKEMON").types).toEqual([]);
    expect(computeFacets(ITEMS, "RIFTBOUND").types).toEqual([
      { value: "Unit", count: 1 },
      { value: "Rune", count: 1 },
    ]);
  });

  it("includes both games when selectedGame is null, with no types", () => {
    const facets = computeFacets(ITEMS, null);
    // Base Set and Unleashed tie at count 2 — a stable sort keeps them in
    // first-seen order (Base Set appears first in ITEMS, at index 0).
    expect(facets.sets).toEqual([
      { value: "Base Set", count: 2 },
      { value: "Unleashed", count: 2 },
      { value: "Jungle", count: 1 },
    ]);
    expect(facets.types).toEqual([]);
  });

  it("excludes items with a null setName/rarity from those tallies instead of counting a null bucket", () => {
    const withNulls: CardBrowseIndexItem[] = [
      ...ITEMS,
      { id: "6", title: "Mystery Card", setName: null, rarity: null, type: null, game: "POKEMON" },
    ];
    const facets = computeFacets(withNulls, "POKEMON");
    const setTotal = facets.sets.reduce((sum, s) => sum + s.count, 0);
    expect(setTotal).toBe(3); // unaffected by the null-setName item
  });

  it("returns empty facets for an empty item list", () => {
    expect(computeFacets([], "POKEMON")).toEqual({ sets: [], rarities: [], types: [] });
  });
});
