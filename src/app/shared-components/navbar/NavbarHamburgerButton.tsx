"use client";

import { IconButton } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";

export default function NavbarHamburgerButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <IconButton
      size="large"
      edge="end"
      color="inherit"
      aria-label="menu"
      onClick={onClick}
      sx={{ display: { xs: "flex", md: "none" } }}
    >
      <MenuIcon />
    </IconButton>
  );
}
