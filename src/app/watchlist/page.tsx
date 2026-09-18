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
  CircularProgress,
  Typography,
  Alert,
} from "@mui/material";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";

import { useAuth } from "@/app/hooks/useAuth";
import AccountLayout from "@/app/shared-components/AccountLayout";
import AccountLoadingGate from "@/app/shared-components/AccountLoadingGate";
import CardListItem from "@/app/shared-components/cards/CardListItem";
import ErrorState from "@/app/shared-components/ErrorState";
import EmptyState from "@/app/shared-components/EmptyState";
import { motion, AnimatePresence } from "framer-motion";
import type { CardItem } from "@/types/card";

export default function WatchlistPage() {
  const { isLoggedIn, status } = useAuth();
  const router = useRouter();

  const [cards, setCards] = useState<CardItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Tracks the isLoggedIn value that `cards`/`error` currently reflect.
  // `loading` is derived by comparing it against the live isLoggedIn value
  // instead of a separately re-armed boolean, so the fetch effect below
  // never needs to call setState synchronously as its first statement
  // (react-hooks/set-state-in-effect flags that shape). Starts as `null`,
  // which can never equal a real isLoggedIn value, so the very first render
  // still derives loading === true — matching the old behavior of the
  // `loading` state initializing to true (see history: this avoided a
  // one-frame flash of the "No cards saved yet" empty state before the
  // fetch effect ran, which QA caught under slow-server conditions).
  const [loadedFor, setLoadedFor] = useState<boolean | null>(null);
  const loading = isLoggedIn && loadedFor !== isLoggedIn;

  // ── Auth guard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== "loading" && !isLoggedIn) router.replace("/auth/login");
  }, [status, isLoggedIn, router]);

  // ── Fetch watchlisted cards ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn) return;
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((data) => {
        if (data.cards) setCards(data.cards);
        else setError(data.error ?? "Failed to load watchlist.");
      })
      .catch(() => setError("Failed to load watchlist."))
      .finally(() => setLoadedFor(isLoggedIn));
  }, [isLoggedIn]);

  // Remove a card from local state when the user un-watchlists it via the tile
  const handleWatchlistToggle = (cardId: string, nowWatchlisted: boolean) => {
    if (!nowWatchlisted) setCards((prev) => prev.filter((c) => c.id !== cardId));
  };

  // ── Loading / auth wait ──────────────────────────────────────────────────────
  if (status === "loading" || !isLoggedIn) {
    return <AccountLoadingGate />;
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
        <Typography component="h1" sx={{ fontSize: { xs: 24, md: 28 }, fontWeight: 800, letterSpacing: "-0.5px", mb: 2 }}>
          Watchlist
        </Typography>
      </motion.div>

      <Alert severity="info" sx={{ mb: 3 }}>
        A card is automatically removed from your watchlist once it&apos;s no longer for sale or on
        auction, or once you own it yourself.
      </Alert>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
          <CircularProgress />
        </Box>
      ) : cards.length === 0 ? (
        // ── Empty state ──────────────────────────────────────────────────────────
        <EmptyState
          icon={<BookmarkBorderIcon sx={{ fontSize: 48, color: "#d1d5db" }} />}
          title="No cards saved yet"
          subtitle="Bookmark cards you're watching and find them here."
          action={{ label: "Browse cards", onClick: () => router.push("/") }}
        />
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
