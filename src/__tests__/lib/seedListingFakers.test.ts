import { describe, it, expect, vi, afterEach } from "vitest";
import { cycleOwnerId, randomDollarsInRange, randomFrom } from "@/lib/seedListingFakers";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("cycleOwnerId", () => {
  it("cycles through the owner pool by index, wrapping around", () => {
    const owners = ["ash", "misty"];
    expect(cycleOwnerId(0, owners)).toBe("ash");
    expect(cycleOwnerId(1, owners)).toBe("misty");
    expect(cycleOwnerId(2, owners)).toBe("ash");
    expect(cycleOwnerId(3, owners)).toBe("misty");
  });

  it("throws when the owner pool is empty", () => {
    expect(() => cycleOwnerId(0, [])).toThrow(/at least one/i);
  });
});

describe("randomDollarsInRange", () => {
  it("returns a value within [min, max], rounded to 2 decimal places", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(randomDollarsInRange(2, 40)).toBe(21);
  });

  it("returns exactly min when Math.random() returns 0", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(randomDollarsInRange(2, 40)).toBe(2);
  });

  it("stays within bounds even for a fractional result", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.123456);
    const result = randomDollarsInRange(2, 40);
    expect(result).toBeGreaterThanOrEqual(2);
    expect(result).toBeLessThanOrEqual(40);
    // rounded to cents
    expect(Number.isInteger(result * 100)).toBe(true);
  });
});

describe("randomFrom", () => {
  it("picks the element at the index Math.random() maps to", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(randomFrom(["NM", "LP", "MP", "HP"])).toBe("MP");
  });

  it("throws when given an empty array", () => {
    expect(() => randomFrom([])).toThrow(/non-empty/i);
  });
});
