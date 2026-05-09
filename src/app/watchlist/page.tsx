"use client";
/**
 * /watchlist — the current user's watchlisted cards.
 *
 * Fetches all cards the user has bookmarked via GET /api/watchlist.
 * Each card can be removed from the watchlist inline (POST /api/cards/[id]/watchlist toggles).
 * Clicking a card navigates to its detail page.
 *
 * Auth:   client-side via useAuth; redirects to /auth/login if unauthenticated.
 * Layout: AccountLayout (sidebar + content panel)
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Typography,
} from "@mui/material";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";

import { useAuth } from "@/app/hooks/useAuth";
import AccountLayout from "@/app/shared-components/AccountLayout";
import ConditionBadge from "@/app/shared-components/cards/ConditionBadge";
import type { CardItem } from "@/types/card";

// ── Watchlist card tile ───────────────────────────────────────────────────────

interface WatchlistCardProps {
  card: CardItem;
  onRemove: (cardId: string) => void;
}

function WatchlistCard({ card, onRemove }: WatchlistCardProps) {
  const router = useRouter();
  const [removing, setRemoving] = useState(false);

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRemoving(true);
    try {
      await fetch(`/api/cards/${card.id}/watchlist`, { method: "POST" });
      onRemove(card.id);
    } catch {
      setRemoving(false);
    }
  };

  return (
    <Box
      onClick={() => router.push(`/cards/${card.id}`)}
      sx={{
        display: "flex",
        gap: 2,
        p: 2,
        border: "1px solid #e5e7eb",
        borderRadius: 2,
        cursor: "pointer",
        transition: "box-shadow 0.15s",
        "&:hover": { boxShadow: "0 2px 12px rgba(0,0,0,0.08)" },
        backgroundColor: "#fff",
      }}
    >
      {/* Card image */}
      <Box
        sx={{
          width: 72,
          height: 100,
          flexShrink: 0,
          borderRadius: 1.5,
          overflow: "hidden",
          backgroundColor: "#f3f4f6",
          position: "relative",
        }}
      >
        <Image
          src={card.imageUrls?.[0] || "/placeholder.png"}
          alt={card.title}
          fill
          sizes="72px"
          style={{ objectFit: "contain" }}
        />
      </Box>

      {/* Card details */}
      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.25, lineHeight: 1.3 }}>
            {card.title}
          </Typography>
          {card.setName && (
            <Typography sx={{ fontSize: 12, color: "#6b7280", mb: 0.75 }}>
              {card.setName}
            </Typography>
          )}
          <ConditionBadge condition={card.condition} />
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 1 }}>
          {card.forSale && card.price != null ? (
            <Typography sx={{ fontWeight: 800, fontSize: 15, color: "#111827" }}>
              S${card.price.toFixed(2)}
            </Typography>
          ) : (
            <Typography sx={{ fontSize: 13, color: "#9ca3af", fontWeight: 600 }}>
              Not for sale
            </Typography>
          )}

          <Button
            size="small"
            variant="outlined"
            onClick={(e) => { e.stopPropagation(); router.push(`/cards/${card.id}`); }}
            sx={{
              textTransform: "none",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: "8px",
              borderColor: "#d1d5db",
              color: "#374151",
              "&:hover": { borderColor: "#9ca3af", backgroundColor: "#f9fafb" },
            }}
          >
            View
          </Button>
        </Box>
      </Box>

      {/* Watchlist toggle — removes the card from this list */}
      <Box sx={{ display: "flex", alignItems: "flex-start", pl: 1 }}>
        <IconButton
          size="small"
          onClick={handleRemove}
          disabled={removing}
          aria-label="Remove from watchlist"
          sx={{ color: "#0053ff", p: 0.5 }}
        >
          {removing
            ? <BookmarkBorderIcon sx={{ fontSize: 20, color: "#9ca3af" }} />
            : <BookmarkIcon sx={{ fontSize: 20 }} />
          }
        </IconButton>
      </Box>
    </Box>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

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

  // Remove a card from local state after the user unwatchlists it
  const handleRemove = (cardId: string) => {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
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
        // ── Empty state ────────────────────────────────────────────────────────
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
        // ── Card grid ──────────────────────────────────────────────────────────
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr" },
            gap: 2,
          }}
        >
          {cards.map((card) => (
            <WatchlistCard key={card.id} card={card} onRemove={handleRemove} />
          ))}
        </Box>
      )}
    </AccountLayout>
  );
}
