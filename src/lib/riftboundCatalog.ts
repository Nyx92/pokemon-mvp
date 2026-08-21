// src/lib/riftboundCatalog.ts
//
// supertype is never independent of type — only certain types carry certain
// supertypes (e.g. only Unit/Legend can be "Champion"; Battlefield never has
// one). "" represents "no supertype", matching RiftboundCardCatalog.supertype
// being a required (non-nullable) column with no natural empty value.
//
// This mapping is a snapshot of riftcodex.com's current card index — if the
// game adds new types/supertypes later, it needs re-checking against a fresh
// pull rather than treated as a permanently fixed enum.

export const RIFTBOUND_TYPES = [
  "Unit",
  "Legend",
  "Spell",
  "Gear",
  "Rune",
  "Battlefield",
] as const;

export const RIFTBOUND_SUPERTYPES_BY_TYPE: Record<string, string[]> = {
  Unit: ["", "Champion", "Signature", "Token"],
  Legend: ["", "Champion"],
  Gear: ["", "Signature", "Token"],
  Spell: ["", "Signature"],
  Rune: ["Basic"],
  Battlefield: [""],
};

export function isValidRiftboundType(type: string): boolean {
  return (RIFTBOUND_TYPES as readonly string[]).includes(type);
}

export function isValidRiftboundSupertype(type: string, supertype: string): boolean {
  return RIFTBOUND_SUPERTYPES_BY_TYPE[type]?.includes(supertype) ?? false;
}

export interface TcgPlayerIdCandidate {
  tcgPlayerId: string | null;
  updatedOn: string;
}

// A handful of real riftbound_cards_index.json entries share one
// tcgPlayerId — not genuine physical variants, but a stale duplicate row
// for the same card (confirmed by diffing pr-246a-298/pr-246b-298: every
// card-identity field matches except internal ids and updatedOn). Only the
// most recently updated entry in each such group should keep the shared
// tcgPlayerId, so a tcgPlayerId-based catalog lookup resolves to exactly
// one row instead of an arbitrary pick. Returns the indices that should
// keep their tcgPlayerId; entries with a null tcgPlayerId are untouched
// (never included, since there's nothing to own).
export function pickTcgPlayerIdOwners<T extends TcgPlayerIdCandidate>(entries: T[]): Set<number> {
  const latestIndexByTcgPlayerId = new Map<string, number>();
  entries.forEach((entry, index) => {
    if (!entry.tcgPlayerId) return;
    const currentIndex = latestIndexByTcgPlayerId.get(entry.tcgPlayerId);
    if (currentIndex === undefined || entry.updatedOn > entries[currentIndex].updatedOn) {
      latestIndexByTcgPlayerId.set(entry.tcgPlayerId, index);
    }
  });
  return new Set(latestIndexByTcgPlayerId.values());
}
