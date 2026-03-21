"use client";

import React, { useState, useEffect } from "react";
import { Box, Typography, CircularProgress } from "@mui/material";
import { useRouter } from "next/navigation";
import CardListItem from "@/app/shared-components/cards/CardListItem";
import type { CardItem } from "@/types/card";

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
}

function SectionRow({ title, subtitle, cards, onCardClick }: SectionRowProps) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography
        variant="h5"
        fontWeight={700}
        sx={{
          mb: 2,
          fontSize: { xs: "1.15rem", md: "1.35rem" },
          color: "#444",
        }}
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
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: "#ccc",
              borderRadius: 2,
            },
          }}
        >
          {cards.map((card) => (
            <CardListItem key={card.id} card={card} onClick={onCardClick} />
          ))}
        </Box>
      )}
    </Box>
  );
}

export default function HomeFeatured() {
  const router = useRouter();
  const [data, setData] = useState<FeaturedData | null>(null);
  const [loading, setLoading] = useState(true);

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
      <SectionRow
        title="Best Sellers."
        subtitle="Trending products."
        cards={data?.bestSellers ?? []}
        onCardClick={handleCardClick}
      />
      <SectionRow
        title="Highest Transacted."
        subtitle="Popular cards."
        cards={data?.highestTransacted ?? []}
        onCardClick={handleCardClick}
      />
      <SectionRow
        title="Newly Listed."
        subtitle="Our newest products."
        cards={data?.newlyListed ?? []}
        onCardClick={handleCardClick}
      />
    </Box>
  );
}
