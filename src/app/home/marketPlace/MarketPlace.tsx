"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Grid,
  TextField,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
  CircularProgress,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useFuzzySearch } from "@/app/utils/account/useFuzzySearch";
import CardDetailDialog from "../../shared-components/cards/CardDetailDialog";
import type { CardItem } from "@/types/card";

export default function Marketplace() {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedCard, setSelectedCard] = useState<CardItem | null>(null);

  const getLanguageChip = (language?: string | null) => {
    const normalized = language?.trim().toLowerCase();

    if (normalized === "english") {
      return {
        label: "EN",
        sx: {
          backgroundColor: "#0D2D75",
          color: "#fff",
        },
      };
    }

    if (normalized === "japanese") {
      return {
        label: "JP",
        sx: {
          backgroundColor: "#D32F2F",
          color: "#fff",
        },
      };
    }

    return null;
  };

  const getConditionLabel = (condition?: string | null) => {
    const normalized = condition?.trim().toLowerCase();

    switch (normalized) {
      case "mint":
        return "M";
      case "near mint":
        return "NM";
      case "light played":
        return "LP";
      case "moderate played":
        return "MP";
      case "heavily played":
        return "HP";
      case "damaged":
        return "DMG";
      default:
        return condition || null;
    }
  };

  // ✅ Fetch cards
  useEffect(() => {
    const fetchCards = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/cards");
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

  // Fuzzy search
  const searchResults = useFuzzySearch({
    data: cards,
    query: search,
    keys: ["title", "status", "condition", "setName", "rarity", "type"],
  });

  // Filters
  const filteredProducts = searchResults.filter((product) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "forsale" && product.forSale) ||
      (filter === "sold" && product.status === "sold");
    return matchesFilter;
  });

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ px: 4, py: 6 }}>
      {/* ✅ Toolbar */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 4,
          gap: 2,
          width: "80%",
          mx: "auto",
        }}
      >
        {/* Left: search */}
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
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
            sx={{ width: { xs: "100%", sm: 260, md: 300 } }}
          />
        </Box>

        {/* Right: filters */}
        <ToggleButtonGroup
          value={filter}
          exclusive
          onChange={(e, val) => val && setFilter(val)}
          size="small"
          sx={{
            "& .MuiToggleButtonGroup-grouped": {
              fontFamily: "'Nunito Sans', 'Poppins', 'Roboto', sans-serif",
              textTransform: "none",
              border: "none",
              borderRadius: "20px",
              fontWeight: 600,
              fontSize: "0.9rem",
              letterSpacing: "0.3px",
              color: "#555",
              px: 2.5,
              py: 0.5,
              transition: "all 0.2s ease",
              "&:hover": {
                backgroundColor: "rgba(56, 55, 53, 0.1)",
                color: "#000",
              },
              "&.Mui-selected": {
                backgroundColor: "black",
                color: "#fff",
                "&:hover": {
                  backgroundColor: "rgba(56, 55, 53, 0.1)",
                },
              },
            },
            "& .MuiToggleButtonGroup-grouped:not(:last-of-type)": {
              marginRight: "8px",
            },
          }}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="forsale">For Sale</ToggleButton>
          <ToggleButton value="sold">Sold</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* ✅ Card Grid */}
      <Box sx={{ width: "80%", mx: "auto" }}>
        <Grid
          container
          spacing={3}
          justifyContent="center"
          alignItems="stretch"
        >
          {filteredProducts.length > 0 ? (
            filteredProducts.map((product) => {
              const languageChip = getLanguageChip(product.language);
              const conditionLabel = getConditionLabel(product.condition);

              return (
                <Grid
                  key={product.id}
                  size={{ xs: 12, sm: 6, md: 4, lg: 3, xl: 2 }}
                  display="flex"
                  justifyContent="center"
                >
                  <Card
                    onClick={() => setSelectedCard(product)}
                    sx={{
                      position: "relative",
                      width: "100%",
                      // card size
                      minWidth: 340,
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
                        backgroundColor: "#f8f8f8",
                        p: 1,
                      }}
                    >
                      <CardMedia
                        component="img"
                        image={product.imageUrls?.[0] || "/placeholder.png"}
                        alt={product.title}
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
                        p: 1.75,
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
                            mb: 0.75,
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

                            {product.cardNumber && (
                              <Typography
                                variant="caption"
                                sx={{
                                  color: "text.secondary",
                                  fontWeight: 600,
                                  fontSize: "0.8rem",
                                }}
                              >
                                {product.cardNumber}
                              </Typography>
                            )}
                          </Box>
                        </Box>

                        {/* Title */}
                        <Typography
                          variant="subtitle1"
                          fontWeight={700}
                          sx={{
                            lineHeight: 1.2,
                            mb: 0.5,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                          title={product.title}
                        >
                          {product.title}
                        </Typography>

                        {/* Set + condition */}
                        <Typography
                          variant="body2"
                          sx={{
                            color: "text.secondary",
                            lineHeight: 1.35,
                            mb: 1,
                          }}
                        >
                          {product.setName || "Unknown Set"}
                        </Typography>

                        <Typography
                          variant="body2"
                          sx={{
                            color: "text.secondary",
                            lineHeight: 1.35,
                          }}
                        >
                          {product.condition || "Unknown Condition"}
                        </Typography>
                      </Box>

                      {/* Bottom price */}
                      <Box sx={{ mt: 1.5 }}>
                        {product.forSale && product.price != null ? (
                          <Typography
                            variant="h6"
                            fontWeight={700}
                            color="text.primary"
                            sx={{ lineHeight: 1 }}
                          >
                            ${product.price.toFixed(2)}
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
                    </CardContent>
                  </Card>
                </Grid>
              );
            })
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
        </Grid>
      </Box>

      {/* 🔍 Reusable Card Detail Modal */}
      <CardDetailDialog
        open={!!selectedCard}
        card={selectedCard}
        onClose={() => setSelectedCard(null)}
      />
    </Box>
  );
}
