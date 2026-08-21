"use client";

import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
  Button,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { MarketplaceFacets } from "@/lib/marketplaceFacets";

export interface MarketplaceFilterState {
  game: "POKEMON" | "RIFTBOUND" | null;
  setNames: string[];
  rarities: string[];
  types: string[];
}

export interface FilterSidebarProps {
  facets: MarketplaceFacets;
  filters: MarketplaceFilterState;
  onChange: (filters: MarketplaceFilterState) => void;
}

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function FilterSidebar({ facets, filters, onChange }: FilterSidebarProps) {
  const hasActiveFilters =
    filters.game != null ||
    filters.setNames.length > 0 ||
    filters.rarities.length > 0 ||
    filters.types.length > 0;

  return (
    <Box sx={{ width: 260, flexShrink: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="h6" fontWeight={700}>Filters</Typography>
        {hasActiveFilters && (
          <Button
            size="small"
            onClick={() => onChange({ game: null, setNames: [], rarities: [], types: [] })}
          >
            Clear
          </Button>
        )}
      </Box>

      <Accordion defaultExpanded disableGutters elevation={0} sx={{ borderTop: "1px solid #eee" }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={600}>Game</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <RadioGroup
            value={filters.game ?? "ALL"}
            onChange={(e) => {
              const value = e.target.value;
              const game = value === "ALL" ? null : (value as "POKEMON" | "RIFTBOUND");
              // Set/rarity/type are game-scoped facets — switching game
              // invalidates any previously selected values from the other
              // game's option list.
              onChange({ game, setNames: [], rarities: [], types: [] });
            }}
          >
            <FormControlLabel value="ALL" control={<Radio size="small" />} label="All" />
            <FormControlLabel value="POKEMON" control={<Radio size="small" />} label="Pokémon" />
            <FormControlLabel value="RIFTBOUND" control={<Radio size="small" />} label="Riftbound" />
          </RadioGroup>
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded disableGutters elevation={0} sx={{ borderTop: "1px solid #eee" }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={600}>Set</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ maxHeight: 240, overflowY: "auto" }}>
          {facets.sets.map((opt) => (
            <FormControlLabel
              key={opt.value}
              control={
                <Checkbox
                  size="small"
                  checked={filters.setNames.includes(opt.value)}
                  onChange={() => onChange({ ...filters, setNames: toggleValue(filters.setNames, opt.value) })}
                />
              }
              label={`${opt.value} (${opt.count})`}
            />
          ))}
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded disableGutters elevation={0} sx={{ borderTop: "1px solid #eee" }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={600}>Rarity</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ maxHeight: 240, overflowY: "auto" }}>
          {facets.rarities.map((opt) => (
            <FormControlLabel
              key={opt.value}
              control={
                <Checkbox
                  size="small"
                  checked={filters.rarities.includes(opt.value)}
                  onChange={() => onChange({ ...filters, rarities: toggleValue(filters.rarities, opt.value) })}
                />
              }
              label={`${opt.value} (${opt.count})`}
            />
          ))}
        </AccordionDetails>
      </Accordion>

      {filters.game === "RIFTBOUND" && facets.types.length > 0 && (
        <Accordion defaultExpanded disableGutters elevation={0} sx={{ borderTop: "1px solid #eee", borderBottom: "1px solid #eee" }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={600}>Type</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {facets.types.map((opt) => (
              <FormControlLabel
                key={opt.value}
                control={
                  <Checkbox
                    size="small"
                    checked={filters.types.includes(opt.value)}
                    onChange={() => onChange({ ...filters, types: toggleValue(filters.types, opt.value) })}
                  />
                }
                label={`${opt.value} (${opt.count})`}
              />
            ))}
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
}
