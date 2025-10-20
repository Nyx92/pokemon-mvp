"use client";

import * as React from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { createTheme } from "@mui/material/styles";

// ✅ Define your global font theme
const theme = createTheme({
  typography: {
    fontFamily: "'Nunito Sans', 'Poppins', 'Roboto', sans-serif",
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
