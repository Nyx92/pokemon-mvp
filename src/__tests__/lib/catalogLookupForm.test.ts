import { describe, it, expect } from "vitest";
import { applyCatalogMatchToForm, BLANK_CATALOG_IDENTITY_FIELDS } from "@/lib/catalogLookupForm";

describe("applyCatalogMatchToForm", () => {
  it("carries a Riftbound catalog match's real values, including type/supertype", () => {
    const result = applyCatalogMatchToForm({
      title: "Vi - Peacekeeper",
      setName: "Unleashed",
      rarity: "Rare",
      cardNumber: "176",
      type: "Unit",
      supertype: "Champion",
    });

    expect(result).toEqual({
      title: "Vi - Peacekeeper",
      setName: "Unleashed",
      rarity: "Rare",
      cardNumber: "176",
      language: "",
      type: "Unit",
      supertype: "Champion",
    });
  });

  it("carries a Pokemon catalog match's language, leaving type/supertype blank", () => {
    const result = applyCatalogMatchToForm({
      title: "Charizard",
      setName: "Base Set",
      rarity: "Rare Holo",
      cardNumber: "004",
      language: "English",
    });

    expect(result).toEqual({
      title: "Charizard",
      setName: "Base Set",
      rarity: "Rare Holo",
      cardNumber: "004",
      language: "English",
      type: "",
      supertype: "",
    });
  });

  it("defaults null setName/rarity/cardNumber to empty strings, never null", () => {
    const result = applyCatalogMatchToForm({
      title: "Mystery Card",
      setName: null,
      rarity: null,
      cardNumber: null,
    });

    expect(result).toEqual({
      title: "Mystery Card",
      setName: "",
      rarity: "",
      cardNumber: "",
      language: "",
      type: "",
      supertype: "",
    });
  });

  it("never returns a blank title, since that's exactly what the server unconditionally rejects", () => {
    const result = applyCatalogMatchToForm({
      title: "Any Real Card",
      setName: "Any Set",
      rarity: "Any Rarity",
      cardNumber: "1",
    });

    expect(result.title).toBe("Any Real Card");
    expect(result.title).not.toBe("");
  });
});

describe("BLANK_CATALOG_IDENTITY_FIELDS", () => {
  it("is entirely empty strings, safe to spread in when no match is found", () => {
    expect(BLANK_CATALOG_IDENTITY_FIELDS).toEqual({
      title: "",
      setName: "",
      rarity: "",
      cardNumber: "",
      language: "",
      type: "",
      supertype: "",
    });
  });
});
