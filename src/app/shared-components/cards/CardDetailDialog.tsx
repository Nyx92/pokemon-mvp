"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  IconButton,
  Divider,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import FavoriteIcon from "@mui/icons-material/Favorite";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import GavelIcon from "@mui/icons-material/Gavel";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";

import type { CardItem } from "@/types/card";

interface CardDetailDialogProps {
  open: boolean;
  card: CardItem | null;
  mode: "market" | "owner"; // 👈 NEW
  onClose: () => void;
}

const CardDetailDialog: React.FC<CardDetailDialogProps> = ({
  open,
  card,
  mode,
  onClose,
}) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [liked, setLiked] = useState(false);

  // Reset when card changes / dialog reopens
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

  // shared styles for footer buttons
  const footerButtonSx = {
    textTransform: "none",
    borderColor: "#1976D2",
    color: "#1976D2",
    "&:hover": {
      borderColor: "#1976D2",
      backgroundColor: "rgba(0,0,0,0.06)",
    },
  } as const;

  const handleBuyNow = async () => {
    if (!card || !card.price) return;

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cardId: card.id,
          title: card.title,
          price: card.price,
          imageUrl: card.imageUrls[0], // 👈 first image
        }),
      });

      if (!res.ok) {
        console.error("Failed to create checkout session");
        return;
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("No checkout URL returned from Stripe");
      }
    } catch (err) {
      console.error("Error calling /api/checkout:", err);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: "hidden",
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
          backgroundColor: "rgba(0,0,0,0.04)",
          "&:hover": {
            backgroundColor: "rgba(0,0,0,0.08)",
          },
        }}
      >
        <CloseIcon />
      </IconButton>

      <DialogContent
        sx={{
          pt: 4,
          pb: 2,
          px: 4,
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            gap: 4,
          }}
        >
          {/* Left: images */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box
              sx={{
                position: "relative",
                borderRadius: 3,
                overflow: "hidden",
                backgroundColor: "#f8f8f8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                px: 2,
                py: 3,
                mb: 2,
                boxShadow: 3,
              }}
            >
              <img
                src={card.imageUrls[activeImageIndex] || "/placeholder.png"}
                alt={`${card.title} large`}
                style={{
                  width: "100%",
                  maxHeight: 420,
                  objectFit: "contain",
                  display: "block",
                }}
              />

              {/* Market mode: like toggle */}
              {mode === "market" && (
                <IconButton
                  onClick={() => setLiked((prev) => !prev)}
                  sx={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    backgroundColor: "rgba(255,255,255,0.9)",
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

              {/* Owner mode: likes pill */}
              {mode === "owner" && (
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

              {/* Status chips on top-right of image */}
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

            {card.imageUrls.length > 1 && (
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
                      width: 64,
                      height: 64,
                      borderRadius: 1.5,
                      overflow: "hidden",
                      cursor: "pointer",
                      border:
                        i === activeImageIndex
                          ? "2px solid #1976d2"
                          : "1px solid #ddd",
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
          </Box>

          {/* Right: details */}
          <Box
            sx={{
              flex: 1.1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {/* Title */}
            <Typography variant="h6" fontWeight={700}>
              {card.title}
            </Typography>

            {/* Price row */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mt: 1,
              }}
            >
              {card.forSale && card.price != null ? (
                <Typography variant="h5" fontWeight={700} color="primary">
                  SGD ${card.price.toFixed(2)}
                </Typography>
              ) : (
                <Typography
                  variant="subtitle1"
                  fontWeight={700}
                  color="text.secondary"
                >
                  Not for sale
                </Typography>
              )}

              <Button
                variant="text"
                size="small"
                sx={{ textTransform: "none" }}
                onClick={() => {
                  console.log("Check market price for", card.id);
                }}
              >
                Check market price
              </Button>
            </Box>

            <Divider sx={{ my: 1.5 }} />

            {/* Meta grid */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                rowGap: 0.6,
                columnGap: 2.5,
                fontSize: "0.9rem",
              }}
            >
              <Typography color="text.secondary">Condition:</Typography>
              <Typography fontWeight={500}>
                {safeText(card.condition)}
              </Typography>

              <Typography color="text.secondary">Set:</Typography>
              <Typography fontWeight={500}>{safeText(card.setName)}</Typography>

              <Typography color="text.secondary">Rarity:</Typography>
              <Typography fontWeight={500}>{safeText(card.rarity)}</Typography>

              <Typography color="text.secondary">Type:</Typography>
              <Typography fontWeight={500}>{safeText(card.type)}</Typography>

              <Typography color="text.secondary">Card ID:</Typography>
              <Typography fontWeight={500}>
                {safeText(card.officialId)}
              </Typography>

              <Typography color="text.secondary">Owner:</Typography>
              <Typography fontWeight={500}>
                {card.owner ? card.owner.username || card.owner.email : "-"}
              </Typography>
            </Box>

            <Divider sx={{ my: 1.5 }} />

            {/* Description */}
            <Box>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                sx={{ mb: 0.5 }}
              >
                Description
              </Typography>
              <Typography
                variant="body2"
                sx={{ whiteSpace: "pre-line" }}
                color="text.primary"
              >
                {safeText(card.description)}
              </Typography>
            </Box>
          </Box>
        </Box>
      </DialogContent>

      {/* Actions differ by mode */}
      <DialogActions
        sx={{
          px: 4,
          py: 2.5,
          borderTop: "1px solid #eee",
          display: "flex",
          justifyContent: "flex-end",
          gap: 1.5,
        }}
      >
        {mode === "market" ? (
          <>
            <Button
              variant="outlined"
              startIcon={<MailOutlineIcon />}
              sx={footerButtonSx}
              onClick={() => console.log("Contact seller", card.id)}
            >
              Contact seller
            </Button>

            <Button
              variant="outlined"
              startIcon={<GavelIcon />}
              sx={footerButtonSx}
              onClick={() => console.log("Leave offer", card.id)}
            >
              Leave offer
            </Button>

            <Button
              variant="contained"
              color="primary"
              startIcon={<ShoppingCartIcon />}
              sx={{
                textTransform: "none",
                backgroundColor: "#1976D2",
                "&:hover": { backgroundColor: "#333" },
              }}
              disabled={!isForSale}
              onClick={handleBuyNow}
            >
              Buy now
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outlined"
              startIcon={<ChatBubbleOutlineIcon />}
              sx={footerButtonSx}
              onClick={() => console.log("View messages for", card.id)}
            >
              View messages
            </Button>

            <Button
              variant="outlined"
              startIcon={<LocalOfferIcon />}
              sx={footerButtonSx}
              onClick={() => console.log("View offers for", card.id)}
            >
              View offers
            </Button>

            <Button
              variant="outlined"
              startIcon={<RocketLaunchIcon />}
              sx={footerButtonSx}
              onClick={() => console.log("Promote listing", card.id)}
            >
              Promote listing
            </Button>

            <Button
              variant="outlined"
              startIcon={<EditOutlinedIcon />}
              sx={footerButtonSx}
              onClick={() => console.log("Promote listing", card.id)}
            >
              Edit listing
            </Button>

            <Button
              variant="outlined"
              startIcon={<DeleteOutlineIcon />}
              sx={{
                textTransform: "none",
                borderColor: "error.main",
                color: "error.main",
                "&:hover": {
                  borderColor: "error.main",
                  backgroundColor: "rgba(211,47,47,0.04)",
                },
              }}
              onClick={() => console.log("Delete listing", card.id)}
            >
              Delete listing
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CardDetailDialog;
