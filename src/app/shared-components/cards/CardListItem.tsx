"use client";

import React from "react";
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Chip,
} from "@mui/material";
import ConditionBadge from "./ConditionBadge";
import type { CardItem } from "@/types/card";

function getLanguageChip(language?: string | null) {
  const normalized = language?.trim().toLowerCase();

  if (normalized === "english") {
    return {
      label: "EN",
      sx: { backgroundColor: "#0D2D75", color: "#fff" },
    };
  }

  if (normalized === "japanese") {
    return {
      label: "JP",
      sx: { backgroundColor: "#D32F2F", color: "#fff" },
    };
  }

  return null;
}

interface CardListItemProps {
  card: CardItem;
  onClick: (card: CardItem) => void;
}

export default function CardListItem({ card, onClick }: CardListItemProps) {
  const languageChip = getLanguageChip(card.language);

  return (
    <Box sx={{ width: 310, flexShrink: 0 }}>
      <Card
        onClick={() => onClick(card)}
        sx={{
          position: "relative",
          width: "100%",
          maxWidth: 310,
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
            width: 150,
            minWidth: 170,
            maxWidth: 150,
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
            {/* top row */}
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
                fontSize: {
                  xs: "0.8rem",
                  sm: "0.85rem",
                  md: "0.9rem",
                },
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
                fontSize: {
                  xs: "0.6rem",
                  sm: "0.65rem",
                  md: "0.7rem",
                },
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
      </Card>
    </Box>
  );
}
