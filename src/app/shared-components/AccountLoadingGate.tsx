"use client";
/**
 * AccountLoadingGate — the "waiting on auth" state shared by every
 * /profile, /watchlist, /purchases, /offers, /sold, /notifications page:
 * the account sidebar shell with a centered spinner while useAuth()
 * resolves. Previously copy-pasted identically into each page.
 */

import { Box, CircularProgress } from "@mui/material";
import AccountLayout from "./AccountLayout";

export default function AccountLoadingGate() {
  return (
    <AccountLayout>
      <Box sx={{ display: "flex", justifyContent: "center", py: 12 }}>
        <CircularProgress />
      </Box>
    </AccountLayout>
  );
}
