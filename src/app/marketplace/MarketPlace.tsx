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
import { motion, AnimatePresence, type Variants } from "framer-motion";
import SearchIcon from "@mui/icons-material/Search";
import { useFuzzySearch } from "@/app/utils/account/useFuzzySearch";
import { useAuth } from "@/app/hooks/useAuth";
import { useWatchlistIds } from "@/app/hooks/useWatchlistIds";
import CardListItem from "../shared-components/cards/CardListItem";
import ErrorState from "../shared-components/ErrorState";
import type { CardItem } from "@/types/card";

// ── Animation variants ────────────────────────────────────────────────────────
// 1. Individual card tile: fade up on enter.
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};
// 2. Grid container: staggers child cards and fades the whole grid out when
//    `search` changes (AnimatePresence key-swap triggers exit → enter cycle).
const gridVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export default function Marketplace() {
  const { userId } = useAuth();
  const router = useRouter();
  const watchlistedIds = useWatchlistIds();
  const [cards,      setCards]      = useState<CardItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [search,     setSearch]     = useState("");

  // 1. Fetch all cards listed for sale; surface error state on failure.
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
          setFetchError(true);
        }
      } catch (err) {
        console.error("Failed to fetch cards:", err);
        setFetchError(true);
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

  // 2. Render error state if the fetch failed.
  if (fetchError) {
    return (
      <ErrorState
        variant="error"
        title="Couldn't load the marketplace"
        action={{ label: "Refresh page", onClick: () => window.location.reload() }}
      />
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
        {/* 3. key={search} causes AnimatePresence to unmount + remount the grid
               whenever the search query changes, replaying the stagger entrance. */}
        <AnimatePresence mode="wait">
          <motion.div
            key={search}
            variants={gridVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{ display: "flex", flexWrap: "wrap", gap: "16px", justifyContent: "center" }}
          >
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <motion.div key={product.id} variants={cardVariants}>
                  <CardListItem
                    card={product}
                    watchlisted={watchlistedIds.has(product.id)}
                    onClick={(card) => router.push(`/cards/${card.id}`)}
                  />
                </motion.div>
              ))
            ) : (
              <motion.div variants={cardVariants} style={{ width: "100%" }}>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  textAlign="center"
                  sx={{ mt: 4 }}
                >
                  No cards match your filters.
                </Typography>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </Box>
    </Box>
  );
}
