"use client";

import { Box, Button, Chip, Divider } from "@mui/material";
import StyleOutlinedIcon from "@mui/icons-material/StyleOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import TranslateOutlinedIcon from "@mui/icons-material/TranslateOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import FilterAltOffOutlinedIcon from "@mui/icons-material/FilterAltOffOutlined";
import SortOutlinedIcon from "@mui/icons-material/SortOutlined";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import type { MarketplaceFacets } from "@/lib/marketplaceFacets";
import { GameToggle } from "@/app/shared-components/filters/GameToggle";
import { MultiSelectFilter } from "@/app/shared-components/filters/MultiSelectFilter";
import { SingleSelectFilter } from "@/app/shared-components/filters/SingleSelectFilter";
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
  const hasActiveFacetFilters =
    filters.setNames.length > 0 ||
    filters.rarities.length > 0 ||
    filters.types.length > 0 ||
    filters.languages.length > 0 ||
    filters.conditions.length > 0;
  const hasActiveAuctionFilters =
    filters.buyNowOnly || filters.endingWithinHours != null || filters.sort !== "endingSoon";
  const hasActiveFilters = hasActiveFacetFilters || hasActiveAuctionFilters;

  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 1,
        p: 1,
        pl: 1.25,
        borderRadius: 3,
        backgroundColor: "rgba(255,255,255,0.97)",
        boxShadow: "0 12px 28px rgba(6,10,20,0.28), 0 1px 2px rgba(6,10,20,0.08)",
        mb: 3,
      }}
    >
      <GameToggle
        value={filters.game}
        onChange={(value) =>
          onChange({ ...filters, game: value, setNames: [], rarities: [], types: [], languages: [], conditions: [] })
        }
      />

      <Divider orientation="vertical" flexItem sx={{ mx: 0.25, my: 0.75, borderColor: "#e5e7eb" }} />

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, flex: 1 }}>
        <MultiSelectFilter
          icon={<StyleOutlinedIcon fontSize="inherit" />}
          label="Set"
          options={facets.sets}
          selected={filters.setNames}
          onChange={(v) => onChange({ ...filters, setNames: v })}
          loading={loading}
        />
        <MultiSelectFilter
          icon={<AutoAwesomeOutlinedIcon fontSize="inherit" />}
          label="Rarity"
          options={facets.rarities}
          selected={filters.rarities}
          onChange={(v) => onChange({ ...filters, rarities: v })}
          loading={loading}
        />
        <MultiSelectFilter
          icon={<VerifiedOutlinedIcon fontSize="inherit" />}
          label="Condition"
          options={facets.conditions}
          selected={filters.conditions}
          onChange={(v) => onChange({ ...filters, conditions: v })}
          loading={loading}
        />
        {filters.game === "POKEMON" && (loading || facets.languages.length > 0) && (
          <MultiSelectFilter
            icon={<TranslateOutlinedIcon fontSize="inherit" />}
            label="Language"
            options={facets.languages}
            selected={filters.languages}
            onChange={(v) => onChange({ ...filters, languages: v })}
            loading={loading}
          />
        )}
        {filters.game === "RIFTBOUND" && (loading || facets.types.length > 0) && (
          <MultiSelectFilter
            icon={<CategoryOutlinedIcon fontSize="inherit" />}
            label="Type"
            options={facets.types}
            selected={filters.types}
            onChange={(v) => onChange({ ...filters, types: v })}
            loading={loading}
          />
        )}

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
        <Chip
          icon={<BoltOutlinedIcon />}
          label="Buy Now Available"
          clickable
          onClick={() => onChange({ ...filters, buyNowOnly: !filters.buyNowOnly })}
          sx={{
            height: 40,
            borderRadius: 2,
            fontSize: 13.5,
            fontWeight: 700,
            px: 0.5,
            backgroundColor: filters.buyNowOnly ? "#0053ff" : "#fff",
            color: filters.buyNowOnly ? "#fff" : "#374151",
            border: `1px solid ${filters.buyNowOnly ? "#0053ff" : "#e5e7eb"}`,
            "& .MuiChip-icon": { color: filters.buyNowOnly ? "#fff" : "#9ca3af" },
            "&:hover": {
              backgroundColor: filters.buyNowOnly ? "#0041cc" : "rgba(0,83,255,0.06)",
            },
          }}
        />
      </Box>

      {hasActiveFilters && (
        <Button
          size="small"
          startIcon={<FilterAltOffOutlinedIcon fontSize="small" />}
          onClick={() =>
            onChange({
              ...filters,
              setNames: [], rarities: [], types: [], languages: [], conditions: [],
              sort: "endingSoon", buyNowOnly: false, endingWithinHours: null,
            })
          }
          sx={{
            color: "#6b7280",
            fontSize: 13,
            fontWeight: 700,
            px: 1.5,
            "&:hover": { color: "#dc2626", backgroundColor: "rgba(220,38,38,0.06)" },
          }}
        >
          Clear
        </Button>
      )}
    </Box>
  );
}
