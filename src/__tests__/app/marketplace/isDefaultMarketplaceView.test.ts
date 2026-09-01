import { describe, it, expect } from "vitest";
import { isDefaultMarketplaceView } from "@/app/marketplace/isDefaultMarketplaceView";
import type { MarketplaceFilterState } from "@/app/marketplace/FilterBar";

const DEFAULT: MarketplaceFilterState = {
  game: "POKEMON",
  setNames: [],
  rarities: [],
  types: [],
  languages: [],
  conditions: [],
};

describe("isDefaultMarketplaceView", () => {
  it("is true for the default filters and empty search", () => {
    expect(isDefaultMarketplaceView(DEFAULT, "")).toBe(true);
  });

  it("is false once a search query is typed", () => {
    expect(isDefaultMarketplaceView(DEFAULT, "charizard")).toBe(false);
  });

  it("is false once any filter facet is selected", () => {
    expect(isDefaultMarketplaceView({ ...DEFAULT, rarities: ["Rare Holo"] }, "")).toBe(false);
  });

  it("is false when the game tab is switched to RIFTBOUND", () => {
    expect(isDefaultMarketplaceView({ ...DEFAULT, game: "RIFTBOUND" }, "")).toBe(false);
  });
});
