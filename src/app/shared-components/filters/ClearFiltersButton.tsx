"use client";

import { Button } from "@mui/material";
import FilterAltOffOutlinedIcon from "@mui/icons-material/FilterAltOffOutlined";

/** The "Clear" action shared by every filter bar — caller decides when to render it (i.e. only while some filter is active). */
export function ClearFiltersButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      size="small"
      startIcon={<FilterAltOffOutlinedIcon fontSize="small" />}
      onClick={onClick}
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
  );
}
