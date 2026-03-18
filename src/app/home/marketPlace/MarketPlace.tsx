"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Typography,
  TextField,
  InputAdornment,
  Chip,
  CircularProgress,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useFuzzySearch } from "@/app/utils/account/useFuzzySearch";
import { useAuth } from "@/app/hooks/useAuth";
import ConditionBadge from "../../shared-components/cards/ConditionBadge";
import type { CardItem } from "@/types/card";

export default function Marketplace() {
  const { userId } = useAuth();
  const router = useRouter();
  const [cards, setCards] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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

  // Fuzzy search
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
      {/* ✅ Toolbar */}
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

      {/* ✅ Card Grid */}
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
            filteredProducts.map((product) => {
              const languageChip = getLanguageChip(product.language);
              const conditionLabel = getConditionLabel(product.condition);

              return (
                <Box key={product.id} sx={{ width: 310, flexShrink: 0 }}>
                  <Card
                    onClick={() =>
                      router.push(`/cards/${product.id}`)
                    }
                    sx={{
                      position: "relative",
                      width: "100%",
                      // card size
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
                          fontWeight={700}
                          sx={{
                            fontSize: {
                              xs: "0.8rem",
                              sm: "0.85rem",
                              md: "0.9rem",
                            },
                            lineHeight: 1.2,
                            // so title can at least take up 2 lines
                            minHeight: "2.16rem",
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
                            fontSize: {
                              xs: "0.6rem",
                              sm: "0.65rem",
                              md: "0.7rem",
                            },
                          }}
                        >
                          {product.setName || "Unknown Set"}
                        </Typography>

                        <ConditionBadge condition={product.condition} />

                        {/* Price */}
                        <Box sx={{ mt: 1 }}>
                          {product.forSale && product.price != null ? (
                            <Typography
                              variant="h6"
                              fontWeight={700}
                              color="text.primary"
                              sx={{ lineHeight: 1 }}
                            >
                              S${product.price.toFixed(2)}
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
        </Box>
      </Box>
    </Box>
  );
}
