"use client";

import StyleOutlinedIcon from "@mui/icons-material/StyleOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import TranslateOutlinedIcon from "@mui/icons-material/TranslateOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import type { MarketplaceFacets } from "@/lib/marketplaceFacets";
import { MultiSelectFilter } from "./MultiSelectFilter";

export interface CatalogFacetFilterValues {
  game: "POKEMON" | "RIFTBOUND";
  setNames: string[];
  rarities: string[];
  types: string[];
  languages: string[];
  conditions: string[];
}

export function hasActiveCatalogFacetFilters(filters: CatalogFacetFilterValues): boolean {
  return (
    filters.setNames.length > 0 ||
    filters.rarities.length > 0 ||
    filters.types.length > 0 ||
    filters.languages.length > 0 ||
    filters.conditions.length > 0
  );
}

// The five values every "clear filters" action resets, extracted since the
// caller's filter state usually carries more than just these (game, plus
// whatever's specific to that page — sort, status, etc.).
export const CLEARED_CATALOG_FACET_FILTERS = {
  setNames: [] as string[],
  rarities: [] as string[],
  types: [] as string[],
  languages: [] as string[],
  conditions: [] as string[],
};

/**
 * Set/Rarity/Condition/Language/Type filter controls — shared by
 * Marketplace, Auctions, and My Collection's filter bars so all three
 * present the same catalog facets identically. Language only applies to
 * POKEMON and Type only to RIFTBOUND (mirroring the catalog split those
 * games' cards actually have), so each is only rendered for its own game —
 * except while `loading`, where it renders as a skeleton regardless so the
 * bar doesn't visibly shift once facets resolve.
 */
export function CatalogFacetFilters({
  facets,
  filters,
  onChange,
  loading = false,
}: {
  facets: MarketplaceFacets;
  filters: CatalogFacetFilterValues;
  onChange: (patch: Partial<CatalogFacetFilterValues>) => void;
  loading?: boolean;
}) {
  return (
    <>
      <MultiSelectFilter
        icon={<StyleOutlinedIcon fontSize="inherit" />}
        label="Set"
        options={facets.sets}
        selected={filters.setNames}
        onChange={(v) => onChange({ setNames: v })}
        loading={loading}
      />
      <MultiSelectFilter
        icon={<AutoAwesomeOutlinedIcon fontSize="inherit" />}
        label="Rarity"
        options={facets.rarities}
        selected={filters.rarities}
        onChange={(v) => onChange({ rarities: v })}
        loading={loading}
      />
      <MultiSelectFilter
        icon={<VerifiedOutlinedIcon fontSize="inherit" />}
        label="Condition"
        options={facets.conditions}
        selected={filters.conditions}
        onChange={(v) => onChange({ conditions: v })}
        loading={loading}
      />
      {filters.game === "POKEMON" && (loading || facets.languages.length > 0) && (
        <MultiSelectFilter
          icon={<TranslateOutlinedIcon fontSize="inherit" />}
          label="Language"
          options={facets.languages}
          selected={filters.languages}
          onChange={(v) => onChange({ languages: v })}
          loading={loading}
        />
      )}
      {filters.game === "RIFTBOUND" && (loading || facets.types.length > 0) && (
        <MultiSelectFilter
          icon={<CategoryOutlinedIcon fontSize="inherit" />}
          label="Type"
          options={facets.types}
          selected={filters.types}
          onChange={(v) => onChange({ types: v })}
          loading={loading}
        />
      )}
    </>
  );
}
