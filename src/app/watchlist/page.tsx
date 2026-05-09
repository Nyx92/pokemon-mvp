"use client";
/**
 * /watchlist — placeholder for the user's saved/watched card listings.
 *
 * Auth:   client-side via useAuth; redirects to /auth/login if unauthenticated.
 * Layout: AccountLayout (sidebar + content panel)
 *
 * TODO: implement watchlist feature (save card IDs, poll for price changes, etc.)
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box, Typography, CircularProgress } from "@mui/material";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";

import { useAuth } from "@/app/hooks/useAuth";
import AccountLayout from "@/app/shared-components/AccountLayout";

export default function WatchlistPage() {
  const { isLoggedIn, status } = useAuth();
  const router = useRouter();

  // ── Auth guard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== "loading" && !isLoggedIn) router.replace("/auth/login");
  }, [status, isLoggedIn, router]);

  if (status === "loading" || !isLoggedIn) {
    return (
      <AccountLayout>
        <Box sx={{ display: "flex", justifyContent: "center", py: 12 }}>
          <CircularProgress />
        </Box>
      </AccountLayout>
    );
  }

  return (
    <AccountLayout>
      <Typography sx={{ fontSize: { xs: 24, md: 28 }, fontWeight: 800, letterSpacing: "-0.5px", mb: 3 }}>
        Watchlist
      </Typography>

      <Box sx={{ textAlign: "center", py: 12 }}>
        <BookmarkBorderIcon sx={{ fontSize: 48, color: "#d1d5db", mb: 2 }} />
        <Typography sx={{ fontWeight: 700, fontSize: 17, color: "#374151", mb: 0.5 }}>
          Coming soon
        </Typography>
        <Typography sx={{ fontSize: 14, color: "#9ca3af" }}>
          Save cards you&apos;re watching and get notified of price changes.
        </Typography>
      </Box>
    </AccountLayout>
  );
}
