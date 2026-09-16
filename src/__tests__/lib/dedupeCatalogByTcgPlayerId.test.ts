import { describe, it, expect } from "vitest";
import { planCatalogDedupe } from "@/lib/catalogDedupe";

describe("planCatalogDedupe", () => {
  it("groups rows sharing a tcgPlayerId, oldest as survivor", () => {
    const rows = [
      { id: "b", tcgPlayerId: "123", createdAt: new Date("2026-02-01") },
      { id: "a", tcgPlayerId: "123", createdAt: new Date("2026-01-01") },
      { id: "c", tcgPlayerId: "123", createdAt: new Date("2026-03-01") },
    ];
    expect(planCatalogDedupe(rows)).toEqual([
      { survivorId: "a", loserIds: ["b", "c"] },
    ]);
  });

  it("ignores rows with a null tcgPlayerId", () => {
    const rows = [
      { id: "a", tcgPlayerId: null, createdAt: new Date("2026-01-01") },
      { id: "b", tcgPlayerId: null, createdAt: new Date("2026-01-02") },
    ];
    expect(planCatalogDedupe(rows)).toEqual([]);
  });

  it("returns nothing for tcgPlayerIds that only appear once", () => {
    const rows = [
      { id: "a", tcgPlayerId: "123", createdAt: new Date("2026-01-01") },
      { id: "b", tcgPlayerId: "456", createdAt: new Date("2026-01-01") },
    ];
    expect(planCatalogDedupe(rows)).toEqual([]);
  });
});
