"use client";

// Shared by marketplace/FilterBar.tsx and auctions/AuctionFilterBar.tsx — a
// labeled multi-select facet dropdown that renders as a skeleton while its
// options aren't loaded yet (see the `loading` prop), so it's never
// clickable-but-empty during the browse-index fetch.

import {
  Box,
  FormControl,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  OutlinedInput,
  Skeleton,
  Typography,
  type SelectChangeEvent,
} from "@mui/material";

export interface FacetOption {
  value: string;
  count: number;
}

export const FILTER_SELECT_HEIGHT = 40;

export function MultiSelectFilter({
  icon,
  label,
  options,
  selected,
  onChange,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  options: FacetOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Skeleton
        variant="rounded"
        width={132}
        height={FILTER_SELECT_HEIGHT}
        sx={{ borderRadius: 2, bgcolor: "rgba(17,24,39,0.08)" }}
      />
    );
  }

  const hasSelection = selected.length > 0;

  return (
    <FormControl size="small" sx={{ minWidth: 150 }}>
      <Select<string[]>
        multiple
        displayEmpty
        value={selected}
        onChange={(e: SelectChangeEvent<string[]>) => onChange(e.target.value as string[])}
        input={<OutlinedInput />}
        renderValue={(sel) => (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, color: hasSelection ? "#0053ff" : "#374151" }}>
            <Box sx={{ display: "flex", fontSize: 18, color: hasSelection ? "#0053ff" : "#9ca3af" }}>{icon}</Box>
            <Typography sx={{ fontSize: 13.5, fontWeight: hasSelection ? 700 : 500, whiteSpace: "nowrap" }}>
              {label}
              {hasSelection ? ` · ${sel.length}` : ""}
            </Typography>
          </Box>
        )}
        MenuProps={{ PaperProps: { sx: { maxHeight: 340, mt: 0.5, borderRadius: 2 } } }}
        sx={{
          height: FILTER_SELECT_HEIGHT,
          borderRadius: 2,
          backgroundColor: hasSelection ? "rgba(0,83,255,0.06)" : "#fff",
          transition: "background-color 0.15s ease, border-color 0.15s ease",
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: hasSelection ? "rgba(0,83,255,0.35)" : "#e5e7eb",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#0053ff" },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#0053ff", borderWidth: 1.5 },
        }}
      >
        {options.map((opt) => (
          <MenuItem key={opt.value} value={opt.value} sx={{ borderRadius: 1, mx: 0.5, my: 0.25 }}>
            <Checkbox size="small" checked={selected.includes(opt.value)} sx={{ py: 0.25 }} />
            <ListItemText
              primary={opt.value}
              secondary={`${opt.count} listed`}
              slotProps={{
                primary: { sx: { fontSize: 13.5, fontWeight: 600 } },
                secondary: { sx: { fontSize: 11.5, color: "#9ca3af" } },
              }}
            />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
