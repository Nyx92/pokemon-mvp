"use client";

import { Divider } from "@mui/material";
import SortOutlinedIcon from "@mui/icons-material/SortOutlined";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import type { MarketplaceFacets } from "@/lib/marketplaceFacets";
import { GameToggle } from "@/app/shared-components/filters/GameToggle";
import { SingleSelectFilter } from "@/app/shared-components/filters/SingleSelectFilter";
import { FilterBarShell } from "@/app/shared-components/filters/FilterBarShell";
import { ClearFiltersButton } from "@/app/shared-components/filters/ClearFiltersButton";
import { ToggleChip } from "@/app/shared-components/filters/ToggleChip";
import {
  CatalogFacetFilters,
  hasActiveCatalogFacetFilters,
  CLEARED_CATALOG_FACET_FILTERS,
} from "@/app/shared-components/filters/CatalogFacetFilters";
import type { AuctionSort } from "@/lib/auctionsQuery";

export interface AuctionFilterState {
  game: "POKEMON" | "RIFTBOUND";
  setNames: string[];
  rarities: string[];
  types: string[];
  languages: string[];
  conditions: string[];
  sort: AuctionSort;
  buyNowOnly: boolean;
  // null = any time; otherwise a window in hours (1, 6, 24) — "ending soon".
  endingWithinHours: number | null;
}

const SORT_OPTIONS: { value: AuctionSort; label: string }[] = [
  { value: "endingSoon", label: "Ending Soonest" },
  { value: "mostBids", label: "Most Bids" },
  { value: "newest", label: "Newest Listed" },
  { value: "priceLow", label: "Price: Low to High" },
  { value: "priceHigh", label: "Price: High to Low" },
];

const ENDING_WINDOW_OPTIONS: { value: string; label: string }[] = [
  { value: "any", label: "Any Time" },
  { value: "1", label: "Ending in 1 Hour" },
  { value: "6", label: "Ending in 6 Hours" },
  { value: "24", label: "Ending in 24 Hours" },
];

export interface AuctionFilterBarProps {
  facets: MarketplaceFacets;
  filters: AuctionFilterState;
  onChange: (filters: AuctionFilterState) => void;
  // True until the browse-index (which every facet list, and bid-count/
  // buy-out data the facets don't need but the tiles below already show)
  // has loaded — see MultiSelectFilter's own doc for why this matters.
  loading?: boolean;
}

export default function AuctionFilterBar({ facets, filters, onChange, loading = false }: AuctionFilterBarProps) {
  const hasActiveAuctionFilters =
    filters.buyNowOnly || filters.endingWithinHours != null || filters.sort !== "endingSoon";
  const hasActiveFilters = hasActiveCatalogFacetFilters(filters) || hasActiveAuctionFilters;

  return (
    <FilterBarShell
      trailing={
        hasActiveFilters && (
          <ClearFiltersButton
            onClick={() =>
              onChange({
                ...filters,
                ...CLEARED_CATALOG_FACET_FILTERS,
                sort: "endingSoon", buyNowOnly: false, endingWithinHours: null,
              })
            }
          />
        )
      }
    >
      <GameToggle
        value={filters.game}
        onChange={(value) => onChange({ ...filters, game: value, ...CLEARED_CATALOG_FACET_FILTERS })}
      />
      <CatalogFacetFilters
        facets={facets}
        filters={filters}
        onChange={(patch) => onChange({ ...filters, ...patch })}
        loading={loading}
      />

      <Divider orientation="vertical" flexItem sx={{ mx: 0.25, my: 0.75, borderColor: "#e5e7eb" }} />

      <SingleSelectFilter
        icon={<TimerOutlinedIcon fontSize="inherit" />}
        label="Ending"
        options={ENDING_WINDOW_OPTIONS}
        value={filters.endingWithinHours == null ? "any" : String(filters.endingWithinHours)}
        defaultValue="any"
        onChange={(v) => onChange({ ...filters, endingWithinHours: v === "any" ? null : Number(v) })}
      />
      <SingleSelectFilter
        icon={<SortOutlinedIcon fontSize="inherit" />}
        label="Sort"
        options={SORT_OPTIONS}
        value={filters.sort}
        defaultValue="endingSoon"
        onChange={(v) => onChange({ ...filters, sort: v })}
      />
      <ToggleChip
        icon={<BoltOutlinedIcon />}
        label="Buy Now Available"
        active={filters.buyNowOnly}
        onClick={() => onChange({ ...filters, buyNowOnly: !filters.buyNowOnly })}
      />
    </FilterBarShell>
  );
}
