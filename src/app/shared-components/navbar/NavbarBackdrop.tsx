"use client";

import { Box } from "@mui/material";

export default function NavbarBackdrop({
  show,
  topLg,
  topXl,
  onClick,
}: {
  show: boolean;
  topLg: string;
  topXl: string;
  onClick: () => void;
}) {
  return (
    <Box
      sx={{
        position: "fixed",
        top: { lg: topLg, xl: topXl },
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 1200,
        display: show ? "block" : "none",
      }}
      onClick={onClick}
    />
  );
}
