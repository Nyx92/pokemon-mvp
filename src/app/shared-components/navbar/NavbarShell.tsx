"use client";

import { AppBar, Box, Container, Toolbar } from "@mui/material";
import React from "react";
import { APP_BAR_HEIGHT } from "./constants";

type Props = {
  navbarRef: React.RefObject<HTMLElement>;
  isDesktopDropdownOpen: boolean;
  isMobileMenuOpen: boolean;
  children: React.ReactNode;
};

export default function NavbarShell({
  navbarRef,
  isDesktopDropdownOpen,
  isMobileMenuOpen,
  children,
}: Props) {
  const isAnyOpen = isDesktopDropdownOpen || isMobileMenuOpen;

  return (
    <AppBar
      ref={navbarRef}
      className={isDesktopDropdownOpen ? "app-bar-black-bg" : ""}
      position="fixed"
      sx={{
        zIndex: 1300,
        width: "100%",
        height: APP_BAR_HEIGHT,
        backgroundColor: isAnyOpen ? "black" : "rgba(22, 22, 23, .8)",
        transition: isMobileMenuOpen
          ? "none"
          : isDesktopDropdownOpen
            ? "background-color 0.3s"
            : "background-color 0.5s 0.3s",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <Container maxWidth="xl">
        <Toolbar
          disableGutters
          sx={{ display: "flex", justifyContent: "center", width: "100%" }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              width: "80%",
            }}
          >
            {children}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
