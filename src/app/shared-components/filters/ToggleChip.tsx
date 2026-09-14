"use client";

import { Chip } from "@mui/material";
import type { ReactElement } from "react";

/**
 * A persistent on/off filter toggle that lives directly in the filter row
 * (not nested in a menu) — e.g. Auctions' "Buy Now Available" and My
 * Collection's "For Collection". `highlight` is a third, non-active state
 * for drawing attention to the toggle before it's turned on (e.g. "there's
 * something waiting here") — omit it for a plain two-state toggle.
 */
export function ToggleChip({
  icon,
  label,
  active,
  highlight = false,
  onClick,
}: {
  icon: ReactElement;
  label: string;
  active: boolean;
  highlight?: boolean;
  onClick: () => void;
}) {
  const bg = active ? "#0053ff" : highlight ? "#fef3c7" : "#fff";
  const color = active ? "#fff" : highlight ? "#92400e" : "#374151";
  const border = active ? "#0053ff" : highlight ? "#fde68a" : "#e5e7eb";
  const iconColor = active ? "#fff" : highlight ? "#92400e" : "#9ca3af";

  return (
    <Chip
      icon={icon}
      label={label}
      clickable
      onClick={onClick}
      sx={{
        height: 40,
        borderRadius: 2,
        fontSize: 13.5,
        fontWeight: 700,
        px: 0.5,
        bgcolor: bg,
        color,
        border: `1px solid ${border}`,
        "& .MuiChip-icon": { color: iconColor },
        "&:hover": { backgroundColor: active ? "#0041cc" : "rgba(0,83,255,0.06)" },
      }}
    />
  );
}
