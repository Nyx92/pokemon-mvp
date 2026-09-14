"use client";

import { Box, Typography } from "@mui/material";

/**
 * Shared white rounded card wrapper for a labelled settings block on the
 * /profile page. Extracted out of ProfileContent so VerificationSection can
 * reuse the exact same look without duplicating the wrapper markup.
 */
export default function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Box sx={{ bgcolor: "#fff", borderRadius: 2.5, border: "1px solid #c9cdd4", mb: 3, overflow: "hidden" }}>
      <Box sx={{ px: 3, py: 2, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #c9cdd4" }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{title}</Typography>
        {action}
      </Box>
      <Box sx={{ px: 3, py: 3 }}>
        {children}
      </Box>
    </Box>
  );
}
