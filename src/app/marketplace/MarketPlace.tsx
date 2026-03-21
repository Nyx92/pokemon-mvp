"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  CircularProgress,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useFuzzySearch } from "@/app/utils/account/useFuzzySearch";
import { useAuth } from "@/app/hooks/useAuth";
import CardListItem from "../shared-components/cards/CardListItem";
import type { CardItem } from "@/types/card";

export default function Marketplace() {
  const { userId } = useAuth();
  const router = useRouter();
  const [cards, setCards] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchCards = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/cards?forSale=true");
        const data = await res.json();
        if (res.ok) {
          setCards(data.cards);
        } else {
          console.error("Error loading cards:", data.error);
        }
      } catch (err) {
        console.error("❌ Failed to fetch cards:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCards();
  }, []);

  const searchResults = useFuzzySearch({
    data: cards,
    query: search,
    keys: ["title", "status", "condition", "setName", "rarity", "type"],
  });

  const filteredProducts = searchResults.filter(
    (product) => !(userId && product.owner?.id === userId)
  );

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Toolbar */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          mb: 4,
          width: "95%",
          mx: "auto",
        }}
      >
        <TextField
          placeholder="Search cards..."
          variant="outlined"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ width: { xs: "100%", sm: 480, md: 600 } }}
        />
      </Box>

      {/* Card Grid */}
      <Box>
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 2,
            justifyContent: "center",
          }}
        >
          {filteredProducts.length > 0 ? (
            filteredProducts.map((product) => (
              <CardListItem
                key={product.id}
                card={product}
                onClick={(card) => router.push(`/cards/${card.id}`)}
              />
            ))
          ) : (
            <Typography
              variant="body1"
              color="text.secondary"
              textAlign="center"
              sx={{ mt: 4 }}
            >
              No cards match your filters.
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}
