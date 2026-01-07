"use client";

import React from "react";
import {
  Box,
  Typography,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import GavelIcon from "@mui/icons-material/Gavel";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";

type ConditionOption = { label: string; value: string };

interface BuyBoxProps {
  isForSale: boolean;
  priceText: string;
  primaryBlue: string;

  condition: string;
  onConditionChange: (value: string) => void;

  onPlaceOffer: () => void;
  onBuyNow: () => void;

  otherListingsTitle?: string;
  otherListingsSubtitle?: string;
  conditionOptions?: ConditionOption[];
}

export default function BuyBox({
  isForSale,
  priceText,
  primaryBlue,
  condition,
  onConditionChange,
  onPlaceOffer,
  onBuyNow,
  otherListingsTitle = "View 5 Other Listings",
  otherListingsSubtitle = "As low as S$568.70",
  conditionOptions = [
    { label: "All", value: "all" },
    { label: "Mint", value: "mint" },
    { label: "Near Mint", value: "near_mint" },
    { label: "Lightly Played", value: "lightly_played" },
  ],
}: BuyBoxProps) {
  return (
    <Box
      sx={{
        border: "2px solid #111",
        borderRadius: 2,
        backgroundColor: "#fff",
        overflow: "hidden",
      }}
    >
      <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
        {/* ✅ SINGLE GRID so column boundaries are shared across rows */}
        <Box
          sx={{
            display: "grid",
            width: "100%",
            gap: 1.6, // ✅ one consistent gap everywhere
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, // ✅ equal columns
            gridTemplateAreas: {
              xs: `
                "price"
                "condition"
                "offer"
                "buy"
                "listings"
              `,
              sm: `
                "price condition"
                "offer buy"
                "listings listings"
              `,
            },
            alignItems: "start",
          }}
        >
          {/* PRICE */}
          <Box sx={{ gridArea: "price", minWidth: 0 }}>
            <Typography sx={{ fontSize: 10, color: "#6b7280" }}>
              Buy Now for
            </Typography>

            {/* ✅ DO NOT change price font */}
            <Typography
              sx={{
                fontSize: { xs: 15, sm: 16, md: 22, lg: 24 },
                fontWeight: 700,
                lineHeight: 1.05,
                color: "#111",
                mt: 0.3,
              }}
            >
              {priceText}
            </Typography>
          </Box>

          {/* CONDITION */}
          <Box sx={{ gridArea: "condition", minWidth: 0 }}>
            <FormControl
              size="small"
              sx={{
                width: "100%",
                minWidth: 0,
                maxWidth: "100%",
              }}
            >
              <InputLabel sx={{ fontSize: 13 }}>Condition</InputLabel>
              <Select
                value={condition}
                label="Condition"
                onChange={(e) => onConditionChange(String(e.target.value))}
                style={{
                  height: 38, // ✅ thinner box
                  paddingTop: 4,
                  paddingBottom: 4,
                }}
                sx={{
                  width: "100%",
                  minWidth: 0,
                  maxWidth: "100%",
                  borderRadius: 1.5,
                  backgroundColor: "#fff",
                  ".MuiSelect-select": { fontWeight: 400, color: "#111" },
                }}
              >
                {conditionOptions.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* PLACE OFFER */}
          <Box sx={{ gridArea: "offer", minWidth: 0 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<GavelIcon />}
              onClick={onPlaceOffer}
              disabled={!isForSale}
              sx={{
                minWidth: 0,
                textTransform: "none",
                borderColor: "#e5e7eb",
                color: "#111",
                backgroundColor: "#fff",
                boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                "&:hover": {
                  borderColor: "#d1d5db",
                  backgroundColor: "#fff",
                },

                fontWeight: 400,
                borderRadius: 1.5,
              }}
            >
              Place Offer
            </Button>
          </Box>

          {/* BUY NOW */}
          <Box sx={{ gridArea: "buy", minWidth: 0 }}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<ShoppingCartIcon />}
              onClick={onBuyNow}
              disabled={!isForSale}
              sx={{
                minWidth: 0,
                textTransform: "none",
                backgroundColor: primaryBlue,
                "&:hover": { backgroundColor: "#0041cc" },
                boxShadow: "0 3px 10px rgba(0,83,255,0.25)",
                fontWeight: 400,
                letterSpacing: "0.3px",
                borderRadius: 1.5,
              }}
            >
              Buy Now
            </Button>
          </Box>

          {/* VIEW OTHER LISTINGS (thinner) */}
          <Box sx={{ gridArea: "listings", minWidth: 0 }}>
            <Box
              sx={{
                width: "100%",
                border: "1px solid #e5e7eb",
                borderRadius: 1.5,
                px: 1.6,
                py: 0.2, // ✅ thinner
                textAlign: "center",
                backgroundColor: "#fff",
              }}
            >
              <Typography
                sx={{ fontSize: 12, color: primaryBlue, fontWeight: 400 }}
              >
                {otherListingsTitle}
              </Typography>
              <Typography sx={{ fontSize: 10, color: "#6b7280", mt: 0.15 }}>
                {otherListingsSubtitle}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
