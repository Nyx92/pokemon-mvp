"use client";
/**
 * /watchlist — the current user's watchlisted cards.
 *
 * Fetches all cards the user has bookmarked via GET /api/watchlist.
 * Cards are displayed using the standard CardListItem tile (same as the marketplace).
 * Clicking the bookmark icon on a tile removes it from the watchlist and from this list.
 * Clicking the card navigates to its detail page.
 *
 * Auth:   client-side via useAuth; redirects to /auth/login if unauthenticated.
 * Layout: AccountLayout (sidebar + content panel)
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Typography,
} from "@mui/material";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";

import { useAuth } from "@/app/hooks/useAuth";
import AccountLayout from "@/app/shared-components/AccountLayout";
import CardListItem from "@/app/shared-components/cards/CardListItem";
import type { CardItem } from "@/types/card";

export default function WatchlistPage() {
  const { isLoggedIn, status } = useAuth();
  const router = useRouter();

  const [cards, setCards] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Auth guard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== "loading" && !isLoggedIn) router.replace("/auth/login");
  }, [status, isLoggedIn, router]);

  // ── Fetch watchlisted cards ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn) return;
    setLoading(true);
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((data) => {
        if (data.cards) setCards(data.cards);
        else setError(data.error ?? "Failed to load watchlist.");
      })
      .catch(() => setError("Failed to load watchlist."))
      .finally(() => setLoading(false));
  }, [isLoggedIn]);

  // Remove a card from local state when the user un-watchlists it via the tile
  const handleWatchlistToggle = (cardId: string, nowWatchlisted: boolean) => {
    if (!nowWatchlisted) setCards((prev) => prev.filter((c) => c.id !== cardId));
  };

  // ── Loading / auth wait ──────────────────────────────────────────────────────
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

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
          <CircularProgress />
        </Box>
      ) : cards.length === 0 ? (
        // ── Empty state ──────────────────────────────────────────────────────────
        <Box sx={{ textAlign: "center", py: 12 }}>
          <BookmarkBorderIcon sx={{ fontSize: 48, color: "#d1d5db", mb: 2 }} />
          <Typography sx={{ fontWeight: 700, fontSize: 17, color: "#374151", mb: 0.5 }}>
            No cards saved yet
          </Typography>
          <Typography sx={{ fontSize: 14, color: "#9ca3af", mb: 3 }}>
            Bookmark cards you&apos;re watching and find them here.
          </Typography>
          <Button
            variant="contained"
            disableElevation
            onClick={() => router.push("/")}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              borderRadius: "10px",
              backgroundColor: "#111827",
              "&:hover": { backgroundColor: "#1f2937" },
            }}
          >
            Browse cards
          </Button>
        </Box>
      ) : (
        // ── Card grid ────────────────────────────────────────────────────────────
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
          {cards.map((card) => (
            <CardListItem
              key={card.id}
              card={card}
              watchlisted={true}
              onClick={(c) => router.push(`/cards/${c.id}`)}
              onWatchlistToggle={handleWatchlistToggle}
            />
          ))}
        </Box>
      )}
    </AccountLayout>
  );
}
