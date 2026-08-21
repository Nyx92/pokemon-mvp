// src/lib/marketplaceFacets.ts
//
// Computed entirely client-side from the small browse-index payload
// (GET /api/cards/browse-index) rather than a server-side aggregation
// query — Prisma can't groupBy a related model's field directly
// (setNameEn/setLabel live on the catalog relation, not Listing), and at
// this catalog's scale (~1,300-2,000 rows) tallying in-memory is simpler
// and just as fast.

import type { CardBrowseIndexItem } from "@/types/card";

export interface FacetOption {
  value: string;
  count: number;
}

export interface MarketplaceFacets {
  sets: FacetOption[];
  rarities: FacetOption[];
  types: FacetOption[];
}

function tally(
  items: CardBrowseIndexItem[],
  pick: (item: CardBrowseIndexItem) => string | null
): FacetOption[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = pick(item);
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts, ([value, count]) => ({ value, count })).sort(
    (a, b) => b.count - a.count
  );
}

export function computeFacets(
  items: CardBrowseIndexItem[],
  selectedGame: "POKEMON" | "RIFTBOUND" | null
): MarketplaceFacets {
  const scoped = selectedGame ? items.filter((i) => i.game === selectedGame) : items;
  return {
    sets: tally(scoped, (i) => i.setName),
    rarities: tally(scoped, (i) => i.rarity),
    types: selectedGame === "RIFTBOUND" ? tally(scoped, (i) => i.type) : [],
  };
}
