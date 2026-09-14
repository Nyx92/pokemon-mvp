"use client";

import { Box, type SxProps, type Theme } from "@mui/material";
import type { ReactNode } from "react";

/**
 * The elevated-card container every filter bar in the app sits in
 * (Marketplace, Auctions, My Collection) — same padding/radius/shadow so
 * the three read as one consistent surface. `children` is the wrapping
 * (flex-1) group of filter controls; `trailing` renders after it,
 * unwrapped, for anything that should sit flush right (Clear button,
 * selection-mode actions).
 */
export function FilterBarShell({
  children,
  trailing,
  sx,
}: {
  children: ReactNode;
  trailing?: ReactNode;
  sx?: SxProps<Theme>;
}) {
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
        ...sx,
      }}
    >
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, flex: 1 }}>{children}</Box>
      {trailing}
    </Box>
  );
}
