"use client";

import {
  Box,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  OutlinedInput,
  type SelectChangeEvent,
} from "@mui/material";
import type { MarketplaceFacets, FacetOption } from "@/lib/marketplaceFacets";

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
}

function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: FacetOption[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <FormControl size="small" sx={{ minWidth: 150 }}>
      <Select<string[]>
        multiple
        displayEmpty
        value={selected}
        onChange={(e: SelectChangeEvent<string[]>) => onChange(e.target.value as string[])}
        input={<OutlinedInput sx={{ borderRadius: 2, backgroundColor: "#fff" }} />}
        renderValue={(sel) => (sel.length === 0 ? label : `${label} (${sel.length})`)}
        MenuProps={{ PaperProps: { sx: { maxHeight: 340 } } }}
      >
        {options.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            <Checkbox size="small" checked={selected.includes(opt.value)} />
            <ListItemText primary={`${opt.value} (${opt.count})`} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export default function FilterBar({ facets, filters, onChange }: FilterBarProps) {
  const hasActiveFilters =
    filters.setNames.length > 0 ||
    filters.rarities.length > 0 ||
    filters.types.length > 0 ||
    filters.languages.length > 0 ||
    filters.conditions.length > 0;

  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 1.5,
        p: 1.5,
        borderRadius: 3,
        backgroundColor: "rgba(255,255,255,0.95)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
        mb: 3,
      }}
    >
      <ToggleButtonGroup
        exclusive
        size="small"
        value={filters.game}
        onChange={(_, value: "POKEMON" | "RIFTBOUND" | null) => {
          if (!value) return; // exclusive group — ignore the deselect-to-nothing click
          // Set/rarity/type/language are game-scoped facets — switching game
          // invalidates any previously selected values from the other
          // game's option list.
          onChange({ game: value, setNames: [], rarities: [], types: [], languages: [], conditions: [] });
        }}
      >
        <ToggleButton value="POKEMON" sx={{ px: 2, fontWeight: 600 }}>Pokémon</ToggleButton>
        <ToggleButton value="RIFTBOUND" sx={{ px: 2, fontWeight: 600 }}>Riftbound</ToggleButton>
      </ToggleButtonGroup>

      <MultiSelectFilter
        label="Set"
        options={facets.sets}
        selected={filters.setNames}
        onChange={(v) => onChange({ ...filters, setNames: v })}
      />
      <MultiSelectFilter
        label="Rarity"
        options={facets.rarities}
        selected={filters.rarities}
        onChange={(v) => onChange({ ...filters, rarities: v })}
      />
      <MultiSelectFilter
        label="Condition"
        options={facets.conditions}
        selected={filters.conditions}
        onChange={(v) => onChange({ ...filters, conditions: v })}
      />
      {filters.game === "POKEMON" && facets.languages.length > 0 && (
        <MultiSelectFilter
          label="Language"
          options={facets.languages}
          selected={filters.languages}
          onChange={(v) => onChange({ ...filters, languages: v })}
        />
      )}
      {filters.game === "RIFTBOUND" && facets.types.length > 0 && (
        <MultiSelectFilter
          label="Type"
          options={facets.types}
          selected={filters.types}
          onChange={(v) => onChange({ ...filters, types: v })}
        />
      )}

      {hasActiveFilters && (
        <Button
          size="small"
          onClick={() =>
            onChange({ ...filters, setNames: [], rarities: [], types: [], languages: [], conditions: [] })
          }
        >
          Clear filters
        </Button>
      )}
    </Box>
  );
}
