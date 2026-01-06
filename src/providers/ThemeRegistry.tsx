"use client";

import * as React from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { createTheme } from "@mui/material/styles";

const theme = createTheme({
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
      {children}
    </ThemeProvider>
  );
}
