import { describe, it, expect } from "vitest";
import { isSameMarketplaceView } from "@/app/marketplace/isSameMarketplaceView";
import type { MarketplaceFilterState } from "@/app/marketplace/FilterBar";

const BASE: MarketplaceFilterState = {
  game: "RIFTBOUND",
  setNames: [],
  rarities: [],
  types: [],
  languages: [],
  conditions: [],
};

describe("isSameMarketplaceView", () => {
  it("is true for two identical filter states", () => {
    expect(isSameMarketplaceView(BASE, { ...BASE })).toBe(true);
  });

  it("is false when the game differs", () => {
    expect(isSameMarketplaceView(BASE, { ...BASE, game: "POKEMON" })).toBe(false);
  });

  it("is false when a facet array differs", () => {
    expect(isSameMarketplaceView(BASE, { ...BASE, rarities: ["Rare Holo"] })).toBe(false);
  });

  it("is true regardless of facet array order", () => {
    const a = { ...BASE, setNames: ["Origins", "Vendetta"] };
    const b = { ...BASE, setNames: ["Vendetta", "Origins"] };
    expect(isSameMarketplaceView(a, b)).toBe(true);
  });

  it("is true for a deep-linked set filter matched against itself", () => {
    const deepLinked = { ...BASE, setNames: ["Origins"] };
    expect(isSameMarketplaceView(deepLinked, { ...deepLinked })).toBe(true);
  });
});
