"use client";

// Shared Pokémon/Riftbound picker — used by marketplace/FilterBar,
// auctions/AuctionFilterBar, and myCollection's toolbar, so all three
// filter bars look and behave identically for the one control they all
// have. Renders via SingleSelectFilter so it shares the exact same visual
// language (height, radius, type scale, active-blue state) as every other
// filter chip in these bars, rather than standing out as a differently
// styled control.

import SportsEsportsOutlinedIcon from "@mui/icons-material/SportsEsportsOutlined";
import { SingleSelectFilter } from "./SingleSelectFilter";

const OPTIONS = [
  { value: "POKEMON" as const, label: "Pokémon" },
  { value: "RIFTBOUND" as const, label: "Riftbound" },
];

export function GameToggle({
  value,
  onChange,
}: {
  value: "POKEMON" | "RIFTBOUND";
  onChange: (value: "POKEMON" | "RIFTBOUND") => void;
}) {
  return (
    <SingleSelectFilter
      icon={<SportsEsportsOutlinedIcon fontSize="inherit" />}
      label="Game"
      options={OPTIONS}
      value={value}
      onChange={onChange}
    />
  );
}
