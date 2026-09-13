"use client";

// A single-value dropdown matching MultiSelectFilter's visual language
// (icon + label, rounded, active state in blue) for controls like "Sort"
// or "Ending within" that only ever have one selected value at a time.

import { Box, FormControl, Select, MenuItem, OutlinedInput, Typography, type SelectChangeEvent } from "@mui/material";
import { FILTER_SELECT_HEIGHT } from "./MultiSelectFilter";

export interface SingleSelectOption<T extends string> {
  value: T;
  label: string;
}

export function SingleSelectFilter<T extends string>({
  icon,
  label,
  options,
  value,
  defaultValue,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  options: SingleSelectOption<T>[];
  value: T;
  // The option that means "no filter applied" — used to decide the active
  // (blue) visual state. Omit if every option is equally "active".
  defaultValue?: T;
  onChange: (value: T) => void;
}) {
  const isActive = defaultValue !== undefined && value !== defaultValue;
  const selectedLabel = options.find((o) => o.value === value)?.label ?? label;

  return (
    <FormControl size="small" sx={{ minWidth: 150 }}>
      <Select<T>
        value={value}
        onChange={(e: SelectChangeEvent<T>) => onChange(e.target.value as T)}
        input={<OutlinedInput />}
        renderValue={() => (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, color: isActive ? "#0053ff" : "#374151" }}>
            <Box sx={{ display: "flex", fontSize: 18, color: isActive ? "#0053ff" : "#9ca3af" }}>{icon}</Box>
            <Typography sx={{ fontSize: 13.5, fontWeight: isActive ? 700 : 500, whiteSpace: "nowrap" }}>
              {selectedLabel}
            </Typography>
          </Box>
        )}
        MenuProps={{ PaperProps: { sx: { maxHeight: 340, mt: 0.5, borderRadius: 2 } } }}
        sx={{
          height: FILTER_SELECT_HEIGHT,
          borderRadius: 2,
          backgroundColor: isActive ? "rgba(0,83,255,0.06)" : "#fff",
          transition: "background-color 0.15s ease, border-color 0.15s ease",
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: isActive ? "rgba(0,83,255,0.35)" : "#e5e7eb",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#0053ff" },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#0053ff", borderWidth: 1.5 },
        }}
      >
        {options.map((opt) => (
          <MenuItem key={opt.value} value={opt.value} sx={{ borderRadius: 1, mx: 0.5, my: 0.25, fontSize: 13.5, fontWeight: 600 }}>
            {opt.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
