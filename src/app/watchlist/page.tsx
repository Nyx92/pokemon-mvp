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
  Box,
  Button,
  CircularProgress,
  Typography,
} from "@mui/material";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";

import { useAuth } from "@/app/hooks/useAuth";
import AccountLayout from "@/app/shared-components/AccountLayout";
import CardListItem from "@/app/shared-components/cards/CardListItem";
import ErrorState from "@/app/shared-components/ErrorState";
import { motion, AnimatePresence } from "framer-motion";
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

  // 1. Show full-page error state so the user has a clear recovery path.
  if (error) {
    return (
      <AccountLayout>
        <ErrorState
          variant="error"
          title="Couldn't load your watchlist"
          action={{ label: "Refresh page", onClick: () => window.location.reload() }}
        />
      </AccountLayout>
    );
  }

  return (
    <AccountLayout>
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }}>
        <Typography sx={{ fontSize: { xs: 24, md: 28 }, fontWeight: 800, letterSpacing: "-0.5px", mb: 3 }}>
          Watchlist
        </Typography>
      </motion.div>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
          <CircularProgress />
        </Box>
      ) : cards.length === 0 ? (
        // ── Empty state ──────────────────────────────────────────────────────────
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          style={{ textAlign: "center", paddingTop: "48px", paddingBottom: "48px" }}
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 14, delay: 0.15 }}
            style={{ display: "inline-block" }}
          >
            <BookmarkBorderIcon sx={{ fontSize: 48, color: "#d1d5db", mb: 2 }} />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.25 }}
          >
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
          </motion.div>
        </motion.div>
      ) : (
        // ── Card grid ────────────────────────────────────────────────────────────
        // 2. AnimatePresence wraps individual cards so the scale-out exit
        //    plays when the user un-watchlists a card. Stagger capped at 0.42 s.
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
          <AnimatePresence>
            {cards.map((card, i) => (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.88, transition: { duration: 0.2 } }}
                transition={{ duration: 0.32, ease: "easeOut", delay: Math.min(i * 0.07, 0.42) }}
              >
                <CardListItem
                  card={card}
                  watchlisted={true}
                  onClick={(c) => router.push(`/cards/${c.id}`)}
                  onWatchlistToggle={handleWatchlistToggle}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </AccountLayout>
  );
}
