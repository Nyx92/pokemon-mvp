"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  Typography,
  Button,
  IconButton,
  Divider,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import FavoriteIcon from "@mui/icons-material/Favorite";
import GavelIcon from "@mui/icons-material/Gavel";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";

import type { CardItem } from "@/types/card";
import CardMarketChart from "./CardMarketChart";

interface CardDetailDialogProps {
  open: boolean;
  card: CardItem | null;
  onClose: () => void;
}

const CardDetailDialog: React.FC<CardDetailDialogProps> = ({
  open,
  card,
  onClose,
}) => {
  const { data: session } = useSession();
  const isAdmin = session?.user && (session.user as any).role === "admin";
  const isOwner = session?.user?.id === card?.owner?.id;

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [liked, setLiked] = useState(false);

  const primaryBlue = "#0053ff";

  useEffect(() => {
    if (open) {
      setActiveImageIndex(0);
      setLiked(false);
    }
  }, [open, card?.id]);

  if (!card) return null;

  const isForSale = card.forSale && card.status !== "sold";
  const likesCount = card.likesCount ?? 0;

  const safeText = (val?: string | null) =>
    val && val.trim().length > 0 ? val : "-";

  const ownerName =
    card.owner?.username || card.owner?.email || "Unknown seller";

  const outlineButtonSx = {
    flex: 1,
    textTransform: "none",
    borderColor: primaryBlue,
    color: primaryBlue,
    "&:hover": {
      borderColor: primaryBlue,
      backgroundColor: "rgba(0,83,255,0.06)",
    },
  } as const;

  const handleBuyNow = async () => {
    if (!card || !card.price) return;

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: card.id,
          title: card.title,
          price: card.price,
          imageUrls: card.imageUrls ?? [],
        }),
      });

      if (!res.ok) return console.error("Failed to create checkout session");
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else console.error("No checkout URL returned from Stripe");
    } catch (err) {
      console.error("Error calling /api/checkout:", err);
    }
  };

  const collectorNo = safeText((card as any).collectorNo);
  const language = safeText((card as any).language ?? "English");
  const setName = safeText(card.setName);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(4px)",
          },
        },
        paper: {
          sx: {
            borderRadius: 3,
            overflow: "hidden",
            boxShadow: "0 12px 45px rgba(0,0,0,0.25)",
            width: { xs: "96vw", md: "92vw", lg: "1180px" },
            maxWidth: "1180px",
          },
        },
      }}
    >
      {/* Floating close button */}
      <IconButton
        onClick={onClose}
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          zIndex: 3,
          backgroundColor: "rgba(255,255,255,0.9)",
          "&:hover": { backgroundColor: "rgba(255,255,255,1)" },
        }}
      >
        <CloseIcon />
      </IconButton>

      <DialogContent
        sx={{
          p: { xs: 2, md: 3 },
          backgroundColor: "#ffffff",
          fontFamily:
            'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"',
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            gap: 3,
            alignItems: "stretch",
          }}
        >
          {/* ================= LEFT HALF ================= */}
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: { xs: "flex-start", md: "center" }, // ✅ vertical center
              alignItems: "center", // ✅ horizontal center
              gap: 2,
              py: { xs: 0, md: 1 },
            }}
          >
            {/* Image */}
            <Box
              sx={{
                position: "relative",
                width: "100%",
                maxWidth: 520,
                minHeight: { xs: 340, md: 560 },
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src={card.imageUrls?.[activeImageIndex] || "/placeholder.png"}
                alt={`${card.title} large`}
                style={{
                  width: "100%",
                  height: "100%",
                  maxHeight: 620,
                  objectFit: "contain",
                  display: "block",
                }}
              />

              {/* Owner: like toggle */}
              {isOwner && (
                <IconButton
                  onClick={() => setLiked((prev) => !prev)}
                  sx={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    backgroundColor: "rgba(255,255,255,0.95)",
                    "&:hover": { backgroundColor: "rgba(255,255,255,1)" },
                  }}
                >
                  {liked ? (
                    <FavoriteIcon color="error" />
                  ) : (
                    <FavoriteBorderIcon />
                  )}
                </IconButton>
              )}

              {/* Viewer: likes pill */}
              {!isOwner && (
                <Box
                  sx={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    backgroundColor: "rgba(255,255,255,0.96)",
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 999,
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    boxShadow: 1,
                  }}
                >
                  <FavoriteIcon fontSize="small" color="error" />
                  <Typography variant="body2" fontWeight={600}>
                    {likesCount.toLocaleString()} likes
                  </Typography>
                </Box>
              )}

              {/* Status chips top-right */}
              <Box
                sx={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  display: "flex",
                  gap: 1,
                }}
              >
                {card.status === "sold" && (
                  <Chip
                    label="Sold"
                    size="small"
                    sx={{
                      backgroundColor: "#A15C5C",
                      color: "#fff",
                      fontWeight: 600,
                    }}
                  />
                )}
                {isForSale && (
                  <Chip
                    label="For Sale"
                    size="small"
                    sx={{
                      backgroundColor: "#3FA796",
                      color: "#fff",
                      fontWeight: 600,
                    }}
                  />
                )}
                {!isForSale && card.status !== "sold" && (
                  <Chip
                    label="NFS"
                    size="small"
                    sx={{
                      backgroundColor: "#9E9E9E",
                      color: "#fff",
                      fontWeight: 600,
                    }}
                  />
                )}
              </Box>
            </Box>

            {/* Thumbnails */}
            {card.imageUrls?.length > 1 && (
              <Box
                sx={{
                  display: "flex",
                  gap: 1,
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                {card.imageUrls.map((url, i) => (
                  <Box
                    key={i}
                    onClick={() => setActiveImageIndex(i)}
                    sx={{
                      width: 58,
                      height: 58,
                      borderRadius: 1.5,
                      overflow: "hidden",
                      cursor: "pointer",
                      border:
                        i === activeImageIndex
                          ? `2px solid ${primaryBlue}`
                          : "1px solid #ddd",
                      backgroundColor: "#fff",
                    }}
                  >
                    <img
                      src={url}
                      alt={`Thumb ${i + 1}`}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        display: "block",
                      }}
                    />
                  </Box>
                ))}
              </Box>
            )}

            {/* Button below image */}
            <Button
              variant="contained"
              sx={{
                width: "100%",
                maxWidth: 520,
                textTransform: "none",
                backgroundColor: primaryBlue,
                "&:hover": { backgroundColor: "#0041cc" },
                borderRadius: 1.5,
                fontWeight: 700,
                letterSpacing: "0.6px",
                py: 1.2,
              }}
              onClick={() => console.log("View slabs", card.id)}
            >
              CLICK TO VIEW SLABS
            </Button>
          </Box>

          {/* ================= RIGHT HALF ================= */}
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {/* Segment 1: Title + metadata */}
            <Box sx={{ px: 0.5 }}>
              <Typography
                sx={{
                  fontSize: 34,
                  fontWeight: 800,
                  lineHeight: 1.1,
                  letterSpacing: "-0.4px",
                  color: "#111",
                }}
              >
                {card.title}
                {card.setName ? ` - ${card.setName}` : ""}
              </Typography>

              {/* Metadata (values left aligned) */}
              <Box sx={{ mt: 2 }}>
                {[
                  ["Collector's No.", collectorNo],
                  ["Language", language],
                  ["Set Name", setName],
                ].map(([label, value]) => (
                  <Box
                    key={label}
                    sx={{
                      display: "flex",
                      gap: 2.5,
                      py: 0.85,
                    }}
                  >
                    <Typography
                      sx={{
                        width: 140,
                        fontSize: 14,
                        color: "#6b7280",
                      }}
                    >
                      {label}
                    </Typography>

                    <Typography
                      sx={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#111",
                        textAlign: "left",
                      }}
                    >
                      {value}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            <Divider />

            {/* Segment 2: Buy box (match screenshot) */}
            <Box
              sx={{
                border: "1px solid #e6e6e6",
                borderRadius: 2,
                backgroundColor: "#fff",
                overflow: "hidden",
              }}
            >
              <Box sx={{ p: 2 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 2,
                  }}
                >
                  <Box>
                    <Typography sx={{ fontSize: 14, color: "#6b7280" }}>
                      Buy Now for
                    </Typography>

                    <Typography
                      sx={{
                        fontSize: 44,
                        fontWeight: 900,
                        lineHeight: 1.05,
                        color: "#111",
                        mt: 0.4,
                      }}
                    >
                      {isForSale && card.price != null
                        ? `S$${card.price.toFixed(2)}`
                        : "S$568.70"}
                    </Typography>
                  </Box>

                  {/* Condition dropdown placeholder */}
                  <Box
                    sx={{
                      minWidth: 180,
                      border: "1px solid #e5e7eb",
                      borderRadius: 1.5,
                      px: 1.25,
                      py: 1,
                      backgroundColor: "#fff",
                    }}
                  >
                    <Typography
                      sx={{ fontSize: 12, color: "#6b7280", mb: 0.4 }}
                    >
                      Condition
                    </Typography>
                    <Typography
                      sx={{ fontSize: 14, fontWeight: 700, color: "#111" }}
                    >
                      All ▾
                    </Typography>
                  </Box>
                </Box>

                {/* Buttons row */}
                <Box sx={{ display: "flex", gap: 1.6, mt: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<GavelIcon />}
                    sx={{
                      flex: 1,
                      textTransform: "none",
                      borderColor: "#e5e7eb",
                      color: "#111",
                      backgroundColor: "#fff",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                      "&:hover": {
                        borderColor: "#d1d5db",
                        backgroundColor: "#fff",
                      },
                      py: 1.2,
                      fontWeight: 800,
                    }}
                    onClick={() => console.log("Place offer", card.id)}
                    disabled={!isForSale}
                  >
                    PLACE OFFER
                  </Button>

                  <Button
                    variant="contained"
                    startIcon={<ShoppingCartIcon />}
                    sx={{
                      flex: 1,
                      textTransform: "none",
                      backgroundColor: primaryBlue,
                      "&:hover": { backgroundColor: "#0041cc" },
                      boxShadow: "0 3px 10px rgba(0,83,255,0.25)",
                      py: 1.2,
                      fontWeight: 900,
                      letterSpacing: "0.3px",
                    }}
                    onClick={handleBuyNow}
                    disabled={!isForSale}
                  >
                    BUY NOW
                  </Button>
                </Box>

                {/* Bottom row */}
                <Box
                  sx={{
                    display: "flex",
                    gap: 1.6,
                    mt: 2,
                    alignItems: "stretch",
                  }}
                >
                  <Typography sx={{ flex: 1, fontSize: 14, color: "#111" }}>
                    Or buy it @499 JP version of it
                  </Typography>

                  <Box
                    sx={{
                      width: 210,
                      border: "1px solid #e5e7eb",
                      borderRadius: 1.5,
                      p: 1.2,
                      textAlign: "center",
                      backgroundColor: "#fff",
                    }}
                  >
                    <Typography
                      sx={{ fontSize: 13, color: primaryBlue, fontWeight: 800 }}
                    >
                      View 5 Other Listings
                    </Typography>
                    <Typography
                      sx={{ fontSize: 13, color: "#6b7280", mt: 0.3 }}
                    >
                      As low as S$568.70
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>

            {/* Segment 3: CardMarketChart now includes its own header */}
            <CardMarketChart card={card} />
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default CardDetailDialog;
