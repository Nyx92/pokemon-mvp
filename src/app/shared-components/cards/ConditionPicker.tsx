"use client";

import React, { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import type { CardItem } from "@/types/card";

const CONDITION_ORDER = [
  "Mint",
  "Near Mint",
  "Lightly Played",
  "Moderately Played",
  "Heavily Played",
  "Damaged",
];

interface ConditionPickerProps {
  tcgPlayerId: string;
  currentCardId: string;
  currentCondition: string;
}

type ConditionListing = {
  id: string;
  condition: string;
  price: number | null;
};

export default function ConditionPicker({
  tcgPlayerId,
  currentCardId,
  currentCondition,
}: ConditionPickerProps) {
  const router = useRouter();
  const [listings, setListings] = useState<ConditionListing[]>([]);

  useEffect(() => {
    if (!tcgPlayerId) return;
    fetch(
      `/api/cards?tcgPlayerId=${encodeURIComponent(tcgPlayerId)}&forSale=true`
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.cards) {
          setListings(
            data.cards.map((c: CardItem) => ({
              id: c.id,
              condition: c.condition,
              price: c.price,
            }))
          );
        }
      })
      .catch(console.error);
  }, [tcgPlayerId]);

  // Group by condition — keep cheapest listing per condition
  const byCondition = new Map<string, ConditionListing>();
  for (const listing of listings) {
    const existing = byCondition.get(listing.condition);
    if (
      !existing ||
      (listing.price !== null &&
        (existing.price === null || listing.price < existing.price))
    ) {
      byCondition.set(listing.condition, listing);
    }
  }

  // Always show the current card's condition; add others from canonical list
  const conditionsToShow = Array.from(
    new Set([...CONDITION_ORDER, currentCondition])
  ).sort((a, b) => {
    const ai = CONDITION_ORDER.indexOf(a);
    const bi = CONDITION_ORDER.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  return (
    <Box>
      <Typography sx={{ fontSize: 12, color: "#6b7280", mb: 1, fontWeight: 500 }}>
        Condition
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {conditionsToShow.map((cond) => {
          const listing = byCondition.get(cond);
          const isCurrent = cond === currentCondition;
          const hasListing = !!listing;
          const isCurrentCard = listing?.id === currentCardId;

          return (
            <Box
              key={cond}
              onClick={() => {
                if (listing && !isCurrentCard) router.push(`/cards/${listing.id}`);
              }}
              sx={{
                px: 1.5,
                py: 0.8,
                borderRadius: 1.5,
                border: isCurrent ? "2px solid #0053ff" : "1px solid #e5e7eb",
                backgroundColor: isCurrent
                  ? "#eff4ff"
                  : hasListing
                  ? "#fff"
                  : "#f9fafb",
                cursor: hasListing && !isCurrentCard ? "pointer" : "default",
                transition: "all 0.15s",
                minWidth: 90,
                textAlign: "center",
                "&:hover":
                  hasListing && !isCurrentCard
                    ? { borderColor: "#0053ff", backgroundColor: "#f5f8ff" }
                    : {},
              }}
            >
              <Typography
                sx={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: isCurrent ? "#0053ff" : hasListing ? "#374151" : "#9ca3af",
                }}
              >
                {cond}
              </Typography>
              <Typography
                sx={{
                  fontSize: 13,
                  fontWeight: 700,
                  mt: 0.2,
                  color: isCurrent ? "#0053ff" : hasListing ? "#111" : "#9ca3af",
                }}
              >
                {listing?.price != null ? `S$${listing.price.toFixed(2)}` : "—"}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
