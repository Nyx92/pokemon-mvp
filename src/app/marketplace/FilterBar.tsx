"use client";

import type { MarketplaceFacets } from "@/lib/marketplaceFacets";
import { GameToggle } from "@/app/shared-components/filters/GameToggle";
import { FilterBarShell } from "@/app/shared-components/filters/FilterBarShell";
import { ClearFiltersButton } from "@/app/shared-components/filters/ClearFiltersButton";
import {
  CatalogFacetFilters,
  hasActiveCatalogFacetFilters,
  CLEARED_CATALOG_FACET_FILTERS,
} from "@/app/shared-components/filters/CatalogFacetFilters";

export interface MarketplaceFilterState {
  game: "POKEMON" | "RIFTBOUND";
  setNames: string[];
  rarities: string[];
  types: string[];
  languages: string[];
  conditions: string[];
}

export interface FilterBarProps {
  facets: MarketplaceFacets;
  filters: MarketplaceFilterState;
  onChange: (filters: MarketplaceFilterState) => void;
  // True until the browse-index (which every facet list is derived from)
  // has loaded. While true, each dropdown renders as an inert skeleton
  // instead of a clickable-but-empty Select — opening a facet menu before
  // its options exist is confusing (it looks broken, not "still loading").
  loading?: boolean;
}

export default function FilterBar({ facets, filters, onChange, loading = false }: FilterBarProps) {
  const hasActiveFilters = hasActiveCatalogFacetFilters(filters);

  return (
    <FilterBarShell
      trailing={
        hasActiveFilters && (
          <ClearFiltersButton onClick={() => onChange({ ...filters, ...CLEARED_CATALOG_FACET_FILTERS })} />
        )
      }
    >
      <GameToggle
        value={filters.game}
        onChange={(value) =>
          // Set/rarity/type/language are game-scoped facets — switching game
          // invalidates any previously selected values from the other
          // game's option list.
          onChange({ ...filters, game: value, ...CLEARED_CATALOG_FACET_FILTERS })
        }
      />
      <CatalogFacetFilters
        facets={facets}
        filters={filters}
        onChange={(patch) => onChange({ ...filters, ...patch })}
        loading={loading}
      />
    </FilterBarShell>
  );
}
