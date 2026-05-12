"use client";
/**
 * CardListItem — horizontal card tile used in the marketplace and home featured rows.
 *
 * Renders a fixed-width card with the card image on the left and metadata on the right.
 * A watchlist toggle button sits in the top-right corner of the tile; clicking it does not
 * navigate to the card detail page (stopPropagation). Owners cannot watchlist their own cards.
 */

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Chip,
  IconButton,
  Typography,
} from "@mui/material";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import ConditionBadge from "./ConditionBadge";
import { useAuth } from "@/app/hooks/useAuth";
import { useWatchlistAnimation } from "@/app/context/WatchlistAnimationContext";
import type { CardItem } from "@/types/card";

function getLanguageChip(language?: string | null) {
  const normalized = language?.trim().toLowerCase();

  if (normalized === "english") {
    return { label: "EN", sx: { backgroundColor: "#0D2D75", color: "#fff" } };
  }
  if (normalized === "japanese") {
    return { label: "JP", sx: { backgroundColor: "#D32F2F", color: "#fff" } };
  }
  return null;
}

interface CardListItemProps {
  card: CardItem;
  onClick: (card: CardItem) => void;
  // Initial watchlist state — passed by parents that already know it (e.g. card detail).
  // Defaults to false in list views where per-card watchlist status isn't pre-fetched.
  watchlisted?: boolean;
  // Called after a successful toggle — useful for pages (e.g. /watchlist) that need to
  // react when a card is removed from the watchlist.
  onWatchlistToggle?: (cardId: string, nowWatchlisted: boolean) => void;
}

export default function CardListItem({
  card,
  onClick,
  watchlisted: initialWatchlisted = false,
  onWatchlistToggle,
}: CardListItemProps) {
  const { userId, isLoggedIn } = useAuth();
  const { triggerFly, adjustCount } = useWatchlistAnimation();
  const router = useRouter();
  const languageChip = getLanguageChip(card.language);
  const bookmarkBtnRef = useRef<HTMLButtonElement | null>(null);

  const [watchlisted, setWatchlisted] = useState(initialWatchlisted);

  // Sync when the parent resolves its watchlist data (e.g. after useWatchlistIds loads)
  useEffect(() => {
    setWatchlisted(initialWatchlisted);
  }, [initialWatchlisted]);

  // Owners cannot watchlist their own cards
  const isOwner = !!userId && card.owner?.id === userId;

  const handleWatchlistToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isLoggedIn) {
      router.push(
        `/auth/login?callbackUrl=${encodeURIComponent(`/cards/${card.id}`)}`
      );
      return;
    }

    const adding = !watchlisted;
    setWatchlisted(adding);

    // Start animation immediately; get a cancel fn in case the API fails
    let cancelFly: (() => void) | null = null;
    if (adding) {
      const rect = bookmarkBtnRef.current?.getBoundingClientRect();
      if (rect)
        cancelFly = triggerFly(rect, card.imageUrls?.[0] || "/placeholder.png");
    } else {
      adjustCount(-1);
    }

    try {
      const res = await fetch(`/api/cards/${card.id}/watchlist`, {
        method: "POST",
      });
      if (!res.ok) {
        setWatchlisted(!adding);
        if (adding) cancelFly?.();
        else adjustCount(+1);
      } else {
        onWatchlistToggle?.(card.id, adding);
      }
    } catch {
      setWatchlisted(!adding);
      if (adding) cancelFly?.();
      else adjustCount(+1);
    }
  };

  return (
    <Box sx={{ width: 280, flexShrink: 0 }}>
      <Card
        onClick={() => onClick(card)}
        sx={{
          position: "relative",
          width: "100%",
          maxWidth: 280,
          minHeight: 220,
          display: "flex",
          flexDirection: "row",
          alignItems: "stretch",
          boxShadow: 2,
          borderRadius: 3,
          cursor: "pointer",
          overflow: "hidden",
          transition: "0.2s ease",
          "&:hover": {
            boxShadow: 5,
            transform: "translateY(-2px)",
          },
        }}
      >
        {/* Left image */}
        <Box
          sx={{
            width: 130,
            minWidth: 150,
            maxWidth: 130,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#fff",
            p: 1,
          }}
        >
          <CardMedia
            component="img"
            image={card.imageUrls?.[0] || "/placeholder.png"}
            alt={card.title}
            sx={{
              width: "100%",
              height: "100%",
              maxHeight: 200,
              objectFit: "contain",
              borderRadius: 2,
            }}
          />
        </Box>

        {/* Right content */}
        <CardContent
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            pt: 1.75,
            pl: 0.75,
            "&:last-child": { pb: 1.75 },
          }}
        >
          <Box>
            {/* Top row: language chip + card number */}
            <Box
              sx={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 1,
                mb: 0.5,
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  flexWrap: "wrap",
                }}
              >
                {languageChip && (
                  <Chip
                    label={languageChip.label}
                    size="small"
                    sx={{
                      height: 24,
                      fontWeight: 700,
                      fontSize: "0.72rem",
                      ...languageChip.sx,
                    }}
                  />
                )}
                {card.cardNumber && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      fontWeight: 600,
                      fontSize: "0.8rem",
                    }}
                  >
                    {card.cardNumber}
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Title */}
            <Typography
              fontWeight={700}
              sx={{
                fontSize: { xs: "0.8rem", sm: "0.85rem", md: "0.9rem" },
                lineHeight: 1.2,
                minHeight: "2.16rem",
                mb: 0.5,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
              title={card.title}
            >
              {card.title}
            </Typography>

            {/* Set name */}
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
                lineHeight: 1.35,
                mb: 1,
                fontSize: { xs: "0.6rem", sm: "0.65rem", md: "0.7rem" },
              }}
            >
              {card.setName || "Unknown Set"}
            </Typography>

            <ConditionBadge condition={card.condition} />

            {/* Price */}
            <Box sx={{ mt: 1 }}>
              {card.forSale && card.price != null ? (
                <Typography
                  variant="h6"
                  fontWeight={700}
                  color="text.primary"
                  sx={{ lineHeight: 1 }}
                >
                  S${card.price.toFixed(2)}
                </Typography>
              ) : (
                <Typography
                  variant="subtitle2"
                  fontWeight={700}
                  color="text.secondary"
                >
                  Not for sale
                </Typography>
              )}
            </Box>
          </Box>
        </CardContent>

        {/* Watchlist toggle — top-right corner, only shown to non-owners */}
        {!isOwner && (
          <Box sx={{ position: "absolute", top: 8, right: 8, zIndex: 1 }}>
            <IconButton
              ref={bookmarkBtnRef}
              size="small"
              onClick={handleWatchlistToggle}
              aria-label={
                watchlisted ? "Remove from watchlist" : "Add to watchlist"
              }
              sx={{
                backgroundColor: "rgba(255,255,255,0.90)",
                "&:hover": { backgroundColor: "rgba(255,255,255,1)" },
                p: 0.6,
              }}
            >
              {watchlisted ? (
                <BookmarkIcon sx={{ fontSize: 17, color: "#0053ff" }} />
              ) : (
                <BookmarkBorderIcon sx={{ fontSize: 17, color: "#555" }} />
              )}
            </IconButton>
          </Box>
        )}
      </Card>
    </Box>
  );
}
