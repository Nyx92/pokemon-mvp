"use client";

import React, { useState, useEffect } from "react";
import { Box, Typography, CircularProgress } from "@mui/material";
import { useRouter } from "next/navigation";
import CardListItem from "@/app/shared-components/cards/CardListItem";
import { useWatchlistIds } from "@/app/hooks/useWatchlistIds";
import type { CardItem } from "@/types/card";
import type { AuctionItem } from "@/types/auction";

interface FeaturedData {
  bestSellers: CardItem[];
  highestTransacted: CardItem[];
  newlyListed: CardItem[];
}

interface SectionRowProps {
  title: string;
  subtitle: string;
  cards: CardItem[];
  onCardClick: (card: CardItem) => void;
  watchlistedIds: Set<string>;
}

function SectionRow({ title, subtitle, cards, onCardClick, watchlistedIds }: SectionRowProps) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography
        variant="h5"
        fontWeight={700}
        sx={{ mb: 2, fontSize: { xs: "1.15rem", md: "1.35rem" }, color: "#444" }}
      >
        {title}{" "}
        <Typography
          component="span"
          fontWeight={400}
          color="text.secondary"
          sx={{ fontSize: { xs: "0.85rem", md: "0.95rem" } }}
        >
          {subtitle}
        </Typography>
      </Typography>

      {cards.length === 0 ? (
        <Typography color="text.secondary">No cards available yet.</Typography>
      ) : (
        <Box
          sx={{
            display: "flex",
            gap: 2,
            overflowX: "auto",
            pb: 1,
            "&::-webkit-scrollbar": { height: 4 },
            "&::-webkit-scrollbar-thumb": { backgroundColor: "#ccc", borderRadius: 2 },
          }}
        >
          {cards.map((card) => (
            <CardListItem
              key={card.id}
              card={card}
              watchlisted={watchlistedIds.has(card.id)}
              onClick={onCardClick}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

// ── Converts an AuctionItem into the CardItem shape CardListItem expects ──────
// Price/forSale are irrelevant here — the auctionOverride prop handles display.
function auctionToCard(auction: AuctionItem): CardItem {
  return {
    id:          auction.cardId,
    title:       auction.card.title,
    price:       null,
    condition:   auction.card.condition,
    status:      "available",
    forSale:     false,
    imageUrls:   auction.card.imageUrls,
    tcgPlayerId: auction.card.tcgPlayerId,
    setName:     auction.card.setName,
    rarity:      auction.card.rarity,
    description: null,
    language:    auction.card.language,
    cardNumber:  auction.card.cardNumber,
    createdAt:   "",
    updatedAt:   "",
    owner:       auction.card.owner
      ? { id: auction.card.owner.id, username: auction.card.owner.username, email: "" }
      : undefined,
  };
}

// ── Auction row — "Ending Soon" horizontal scroll ────────────────────────────
// Reuses CardListItem with auctionOverride to show bid/timer/count instead of price.

function AuctionRow({ watchlistedIds, onCardClick }: { watchlistedIds: Set<string>; onCardClick: (card: CardItem) => void }) {
  const [auctions, setAuctions] = useState<AuctionItem[]>([]);

  useEffect(() => {
    fetch("/api/auctions?expiringSoon=true")
      .then((r) => r.json())
      .then((data) => { if (data.auctions) setAuctions(data.auctions); })
      .catch(console.error);
  }, []);

  if (auctions.length === 0) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Typography
        variant="h5"
        fontWeight={700}
        sx={{ mb: 2, fontSize: { xs: "1.15rem", md: "1.35rem" }, color: "#444" }}
      >
        Auction.{" "}
        <Typography
          component="span"
          fontWeight={400}
          color="text.secondary"
          sx={{ fontSize: { xs: "0.85rem", md: "0.95rem" } }}
        >
          Live auctions closing shortly.
        </Typography>
      </Typography>

      <Box
        sx={{
          display: "flex",
          gap: 2,
          overflowX: "auto",
          pb: 1,
          "&::-webkit-scrollbar": { height: 4 },
          "&::-webkit-scrollbar-thumb": { backgroundColor: "#ccc", borderRadius: 2 },
        }}
      >
        {auctions.map((auction) => (
          <CardListItem
            key={auction.id}
            card={auctionToCard(auction)}
            watchlisted={watchlistedIds.has(auction.cardId)}
            onClick={onCardClick}
            auctionOverride={{
              currentBid:  auction.currentBid,
              startingBid: auction.startingBid,
              endsAt:      auction.endsAt,
              bidCount:    auction.bidCount,
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

// ── Main featured component ───────────────────────────────────────────────────

export default function HomeFeatured() {
  const router = useRouter();
  const [data, setData] = useState<FeaturedData | null>(null);
  const [loading, setLoading] = useState(true);
  const watchlistedIds = useWatchlistIds();

  useEffect(() => {
    fetch("/api/home/featured")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleCardClick = (card: CardItem) => {
    router.push(`/cards/${card.id}`);
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Auction row sits at the very top — hidden when no auctions are ending soon */}
      <AuctionRow watchlistedIds={watchlistedIds} onCardClick={handleCardClick} />
      <SectionRow
        title="Best Sellers."
        subtitle="Trending products."
        cards={data?.bestSellers ?? []}
        onCardClick={handleCardClick}
        watchlistedIds={watchlistedIds}
      />
      <SectionRow
        title="Highest Transacted."
        subtitle="Popular cards."
        cards={data?.highestTransacted ?? []}
        onCardClick={handleCardClick}
        watchlistedIds={watchlistedIds}
      />
      <SectionRow
        title="Newly Listed."
        subtitle="Our newest products."
        cards={data?.newlyListed ?? []}
        onCardClick={handleCardClick}
        watchlistedIds={watchlistedIds}
      />
    </Box>
  );
}
