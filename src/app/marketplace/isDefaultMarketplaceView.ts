// src/app/marketplace/isDefaultMarketplaceView.ts
//
// True only for the exact view the /marketplace Server Component
// pre-fetches (page 1, forSale=true, game=POKEMON, no facets, no search).
// MarketPlace.tsx uses this to skip its own redundant initial fetch on
// mount — every other combination still fetches client-side as before.

import type { MarketplaceFilterState } from "./FilterBar";

export function isDefaultMarketplaceView(
  filters: MarketplaceFilterState,
  search: string
): boolean {
  return (
    search === "" &&
    filters.game === "POKEMON" &&
    filters.setNames.length === 0 &&
    filters.rarities.length === 0 &&
    filters.types.length === 0 &&
    filters.languages.length === 0 &&
    filters.conditions.length === 0
  );
}
