import { describe, it, expect } from "vitest";
import {
  isValidRiftboundType,
  isValidRiftboundSupertype,
  pickTcgPlayerIdOwners,
} from "@/lib/riftboundCatalog";

describe("isValidRiftboundType", () => {
  it("accepts each of the six known types", () => {
    for (const type of ["Unit", "Legend", "Spell", "Gear", "Rune", "Battlefield"]) {
      expect(isValidRiftboundType(type)).toBe(true);
    }
  });

  it("rejects an unknown type", () => {
    expect(isValidRiftboundType("Trap")).toBe(false);
  });
});

describe("isValidRiftboundSupertype", () => {
  it("allows Unit to have no supertype, Champion, Signature, or Token", () => {
    expect(isValidRiftboundSupertype("Unit", "")).toBe(true);
    expect(isValidRiftboundSupertype("Unit", "Champion")).toBe(true);
    expect(isValidRiftboundSupertype("Unit", "Signature")).toBe(true);
    expect(isValidRiftboundSupertype("Unit", "Token")).toBe(true);
  });

  it("rejects Unit with Basic, since Basic only belongs to Rune", () => {
    expect(isValidRiftboundSupertype("Unit", "Basic")).toBe(false);
  });

  it("allows Legend to have no supertype or Champion only", () => {
    expect(isValidRiftboundSupertype("Legend", "")).toBe(true);
    expect(isValidRiftboundSupertype("Legend", "Champion")).toBe(true);
  });

  it("rejects Legend with Signature or Token", () => {
    expect(isValidRiftboundSupertype("Legend", "Signature")).toBe(false);
    expect(isValidRiftboundSupertype("Legend", "Token")).toBe(false);
  });

  it("allows Gear to have no supertype, Signature, or Token", () => {
    expect(isValidRiftboundSupertype("Gear", "")).toBe(true);
    expect(isValidRiftboundSupertype("Gear", "Signature")).toBe(true);
    expect(isValidRiftboundSupertype("Gear", "Token")).toBe(true);
  });

  it("rejects Gear with Champion", () => {
    expect(isValidRiftboundSupertype("Gear", "Champion")).toBe(false);
  });

  it("allows Spell to have no supertype or Signature only", () => {
    expect(isValidRiftboundSupertype("Spell", "")).toBe(true);
    expect(isValidRiftboundSupertype("Spell", "Signature")).toBe(true);
  });

  it("rejects Spell with Token", () => {
    expect(isValidRiftboundSupertype("Spell", "Token")).toBe(false);
  });

  it("requires Rune to always be Basic, and rejects no-supertype for Rune", () => {
    expect(isValidRiftboundSupertype("Rune", "Basic")).toBe(true);
    expect(isValidRiftboundSupertype("Rune", "")).toBe(false);
  });

  it("requires Battlefield to always have no supertype", () => {
    expect(isValidRiftboundSupertype("Battlefield", "")).toBe(true);
    expect(isValidRiftboundSupertype("Battlefield", "Champion")).toBe(false);
  });

  it("rejects an unknown type outright", () => {
    expect(isValidRiftboundSupertype("Trap", "")).toBe(false);
  });
});

describe("pickTcgPlayerIdOwners", () => {
  it("keeps every entry with a unique tcgPlayerId", () => {
    const owners = pickTcgPlayerIdOwners([
      { tcgPlayerId: "111", updatedOn: "2026-01-01T00:00:00Z" },
      { tcgPlayerId: "222", updatedOn: "2026-01-01T00:00:00Z" },
    ]);
    expect(owners).toEqual(new Set([0, 1]));
  });

  it("ignores entries with a null tcgPlayerId entirely", () => {
    const owners = pickTcgPlayerIdOwners([
      { tcgPlayerId: null, updatedOn: "2026-01-01T00:00:00Z" },
      { tcgPlayerId: "111", updatedOn: "2026-01-01T00:00:00Z" },
    ]);
    expect(owners).toEqual(new Set([1]));
  });

  it("picks the entry with the later updatedOn when two share a tcgPlayerId — real quirk, index order 1", () => {
    // Mirrors the real pr-246a-298/pr-246b-298 case: same tcgPlayerId,
    // "a" listed first in the source index but with the OLDER updatedOn.
    const owners = pickTcgPlayerIdOwners([
      { tcgPlayerId: "678054", updatedOn: "2026-03-19T20:26:23Z" }, // a, stale
      { tcgPlayerId: "678054", updatedOn: "2026-07-10T22:45:16Z" }, // b, fresher
    ]);
    expect(owners).toEqual(new Set([1]));
  });

  it("picks the later updatedOn regardless of which array position it's in — index order 2", () => {
    const owners = pickTcgPlayerIdOwners([
      { tcgPlayerId: "678054", updatedOn: "2026-07-10T22:45:16Z" }, // fresher, now listed first
      { tcgPlayerId: "678054", updatedOn: "2026-03-19T20:26:23Z" }, // stale, now listed second
    ]);
    expect(owners).toEqual(new Set([0]));
  });

  it("picks only the single latest among a three-way duplicate group", () => {
    const owners = pickTcgPlayerIdOwners([
      { tcgPlayerId: "999", updatedOn: "2026-01-01T00:00:00Z" },
      { tcgPlayerId: "999", updatedOn: "2026-06-01T00:00:00Z" },
      { tcgPlayerId: "999", updatedOn: "2026-03-01T00:00:00Z" },
    ]);
    expect(owners).toEqual(new Set([1]));
  });
});
