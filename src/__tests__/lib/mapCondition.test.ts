import { describe, it, expect } from "vitest";
import { toPriceVariantLabel } from "@/app/utils/mapCondition";

/**
 * toPriceVariantLabel maps a Listing's free-text condition string to the
 * canonical PriceHistory.variant label: "RAW" for ungraded, or
 * "<COMPANY> <GRADE>" for graded. This is what lets the refresh job and the
 * price chart agree on the same label for the same card.
 */

describe("toPriceVariantLabel", () => {
  it("maps a PSA grade to its canonical label", () => {
    expect(toPriceVariantLabel("PSA 10")).toBe("PSA 10");
  });

  it("maps a CGC grade to its canonical label, dropping the descriptive suffix", () => {
    expect(toPriceVariantLabel("CGC 9.5 Gem Mint")).toBe("CGC 9.5");
  });

  it("maps an SGC grade to its canonical label", () => {
    expect(toPriceVariantLabel("SGC 9 Mint")).toBe("SGC 9");
  });

  it("maps a Beckett grade to its canonical label", () => {
    expect(toPriceVariantLabel("Beckett 9 Mint")).toBe("BECKETT 9");
  });

  it("maps every raw condition to RAW", () => {
    expect(toPriceVariantLabel("Near Mint")).toBe("RAW");
    expect(toPriceVariantLabel("Lightly Played")).toBe("RAW");
    expect(toPriceVariantLabel("Damaged")).toBe("RAW");
  });

  it("falls back to RAW for an unrecognized string", () => {
    expect(toPriceVariantLabel("???")).toBe("RAW");
  });
});
