"use client";

import * as React from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { createTheme } from "@mui/material/styles";
import { MotionConfig } from "framer-motion";

// Brand palette, extracted from the hex values already used ad hoc across
// the app (buttons, badges, empty-state icons) so every component pulls
// from one source instead of hardcoding its own copy of these colors.
const theme = createTheme({
  palette: {
    primary: {
      main: "#0053ff",
      dark: "#0041cc",
    },
    error: {
      main: "#dc2626",
    },
    warning: {
      main: "#f59e0b",
    },
    success: {
      main: "#16a34a",
    },
    text: {
      primary: "#111827",
      // gray-500 meets WCAG AA contrast on white; gray-400 (previously
      // used inline for body copy throughout the app) does not.
      secondary: "#6b7280",
      disabled: "#d1d5db",
    },
    divider: "#e5e7eb",
  },
  shape: {
    borderRadius: 10,
  },
  typography: {
    // 1. Swap 'Nunito Sans' for your new Inter variable
    fontFamily: "var(--font-inter), 'Roboto', sans-serif",
  },
  components: {
    MuiTypography: {
      styleOverrides: {
        root: {
          fontFeatureSettings: '"cv05", "cv02", "ss01"',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 700,
          borderRadius: 10,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        // MUI's small size pads out to ~34px, below the 44px touch-target
        // minimum; this brings it closer without changing icon size.
        sizeSmall: {
          padding: 9,
        },
      },
    },
    // One override here recolors every plain <CircularProgress /> (the
    // default color="primary") to grey instead of chasing down each
    // individual usage. Scoped to ownerState.color === "primary" only —
    // several small in-button spinners deliberately pass color="inherit"
    // so they read as white text on a colored button (e.g. AuctionDialog,
    // PlaceBidDialog, PlaceOfferDialog, SellerOffersDialog); an unconditional
    // override would clobber those with grey too. Call sites using an
    // explicit `sx={{ color: ... }}` are unaffected either way — sx is
    // applied after theme styleOverrides and always wins.
    MuiCircularProgress: {
      styleOverrides: {
        root: ({ theme, ownerState }) =>
          ownerState.color === "primary" ? { color: theme.palette.grey[400] } : {},
      },
    },
  },
});

export default function ThemeRegistry({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* Downgrades every framer-motion animation in the app to an
          instant, non-transform transition when the OS's
          prefers-reduced-motion setting is on. */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </ThemeProvider>
  );
}
