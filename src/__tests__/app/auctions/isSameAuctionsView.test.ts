import { describe, it, expect } from "vitest";
import { isSameAuctionsView } from "@/app/auctions/isSameAuctionsView";
import type { AuctionFilterState } from "@/app/auctions/AuctionFilterBar";

const BASE: AuctionFilterState = {
  game: "RIFTBOUND",
  setNames: [],
  rarities: [],
  types: [],
  languages: [],
  conditions: [],
  sort: "endingSoon",
  buyNowOnly: false,
  endingWithinHours: null,
};

describe("isSameAuctionsView", () => {
  it("is true for two identical filter states", () => {
    expect(isSameAuctionsView(BASE, { ...BASE })).toBe(true);
  });

  it("is false when the game differs", () => {
    expect(isSameAuctionsView(BASE, { ...BASE, game: "POKEMON" })).toBe(false);
  });

  it("is false when sort differs", () => {
    expect(isSameAuctionsView(BASE, { ...BASE, sort: "mostBids" })).toBe(false);
  });

  it("is false when buyNowOnly differs", () => {
    expect(isSameAuctionsView(BASE, { ...BASE, buyNowOnly: true })).toBe(false);
  });

  it("is false when endingWithinHours differs", () => {
    expect(isSameAuctionsView(BASE, { ...BASE, endingWithinHours: 1 })).toBe(false);
  });

  it("is false when a facet array differs", () => {
    expect(isSameAuctionsView(BASE, { ...BASE, rarities: ["Rare"] })).toBe(false);
  });

  it("is true regardless of facet array order", () => {
    const a = { ...BASE, setNames: ["Origins", "Vendetta"] };
    const b = { ...BASE, setNames: ["Vendetta", "Origins"] };
    expect(isSameAuctionsView(a, b)).toBe(true);
  });
});
