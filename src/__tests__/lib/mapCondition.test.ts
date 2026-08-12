import { describe, it, expect } from "vitest";
import { mapConditionToAPI } from "@/app/utils/mapCondition";

/**
 * mapConditionToAPI classifies a card's condition string into either a
 * graded lookup (for the price chart's graded-price data) or a raw lookup
 * (ungraded market price). Before this fix, only "psa" was recognized as
 * graded — every CGC/SGC/Beckett-graded card silently fell through to
 * { type: "raw", key: "Near Mint" }, showing the wrong market chart data.
 */

describe("mapConditionToAPI", () => {
  it("classifies PSA grades as graded", () => {
    expect(mapConditionToAPI("PSA 10")).toEqual({ type: "graded", grade: "10" });
  });

  it("classifies CGC grades as graded", () => {
    expect(mapConditionToAPI("CGC 10 Pristine")).toEqual({
      type: "graded",
      grade: "cgc 10 pristine",
    });
  });

  it("classifies SGC grades as graded", () => {
    expect(mapConditionToAPI("SGC 9.5 Gem Mint")).toEqual({
      type: "graded",
      grade: "sgc 9.5 gem mint",
    });
  });

  it("classifies Beckett grades as graded", () => {
    expect(mapConditionToAPI("Beckett 9 Mint")).toEqual({
      type: "graded",
      grade: "beckett 9 mint",
    });
  });

  it("still classifies raw conditions correctly", () => {
    expect(mapConditionToAPI("Near Mint")).toEqual({ type: "raw", key: "Near Mint" });
    expect(mapConditionToAPI("Lightly Played")).toEqual({ type: "raw", key: "Lightly Played" });
    expect(mapConditionToAPI("Damaged")).toEqual({ type: "raw", key: "Damaged" });
  });

  it("falls back to raw Near Mint for an unrecognized string", () => {
    expect(mapConditionToAPI("???")).toEqual({ type: "raw", key: "Near Mint" });
  });
});
