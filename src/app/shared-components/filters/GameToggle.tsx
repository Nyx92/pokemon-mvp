"use client";

// Shared Pokémon/Riftbound pill toggle — used by both marketplace/FilterBar
// and auctions/AuctionFilterBar so the two filter bars look and behave
// identically for the one control they both have.

import { ToggleButton, ToggleButtonGroup } from "@mui/material";

export function GameToggle({
  value,
  onChange,
}: {
  value: "POKEMON" | "RIFTBOUND";
  onChange: (value: "POKEMON" | "RIFTBOUND") => void;
}) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      onChange={(_, next: "POKEMON" | "RIFTBOUND" | null) => {
        if (!next) return; // exclusive group — ignore the deselect-to-nothing click
        onChange(next);
      }}
      sx={{
        backgroundColor: "#f3f4f6",
        borderRadius: 2.5,
        p: 0.5,
        gap: 0.5,
        "& .MuiToggleButton-root": {
          border: "none",
          borderRadius: "18px !important",
          px: 2,
          py: 0.75,
          fontSize: 13.5,
          fontWeight: 700,
          color: "#6b7280",
          letterSpacing: "0.01em",
          transition: "background-color 0.15s ease, color 0.15s ease",
        },
        "& .Mui-selected": {
          backgroundColor: "#0053ff !important",
          color: "#fff !important",
          boxShadow: "0 2px 6px rgba(0,83,255,0.35)",
        },
      }}
    >
      <ToggleButton value="POKEMON">Pokémon</ToggleButton>
      <ToggleButton value="RIFTBOUND">Riftbound</ToggleButton>
    </ToggleButtonGroup>
  );
}
