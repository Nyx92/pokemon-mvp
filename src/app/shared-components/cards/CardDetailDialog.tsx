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

  const ownerName =
    card.owner?.username || card.owner?.email || "Unknown seller";

  // shared styles for outline buttons in the blue card
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cardId: card.id,
          title: card.title,
          price: card.price,
          imageUrls: card.imageUrls ?? [],
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
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#f8faff",
        }}
      >
        {/* Repeating Pokéball pattern */}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 0,
            opacity: 0.03,
            backgroundImage:
              'url("/backgrounds/pokeball-pattern.svg"), url("/backgrounds/pokeball-pattern.svg")',
            backgroundRepeat: "repeat, repeat",
            backgroundSize: "140px 140px, 140px 140px",
            // second layer shifted by half a cell -> diagonal / checkerboard vibe
            backgroundPosition: "0 0, 70px 70px",
          }}
        />

        <Box
          sx={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            gap: 4,
          }}
        >
          {/* LEFT: title + image + description */}
          <Box
            sx={{
              flex: 1.1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {/* Title + set name */}
            <Box>
              <Typography variant="h5" fontWeight={700}>
                {card.title}
              </Typography>

              {card.setName && (
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  {card.setName}
                </Typography>
              )}

              <Typography
                variant="body2"
                sx={{ whiteSpace: "pre-line" }}
                color="text.primary"
              ></Typography>
            </Box>

            {/* Main image */}
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

              {/* Owner: like toggle */}
              {isOwner && (
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

            {/* Thumbnails */}
            {card.imageUrls.length > 1 && (
              <Box
                sx={{
                  display: "flex",
                  gap: 1,
                  justifyContent: "center",
                  flexWrap: "wrap",
                  mb: 1.5,
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
                          ? `2px solid ${primaryBlue}`
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

          {/* RIGHT: listing card + market chart */}
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: 2.5,
            }}
          >
            {/* Listing details card (TCGplayer-style) */}
            <Box
              sx={{
                borderRadius: 2,
                border: "1px solid #e0e0e0",
                overflow: "hidden",
                boxShadow: 1,
                backgroundColor: "white",
              }}
            >
              {/* Blue header */}
              <Box
                sx={{
                  bgcolor: "#e8f2ff",
                  color: "black",
                  px: 2,
                  py: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Typography variant="subtitle2" fontWeight={600}>
                  Listing details
                </Typography>
              </Box>

              {/* Content */}
              <Box sx={{ p: 2 }}>
                {/* Condition */}
                <Typography variant="subtitle1" fontWeight={500}>
                  {safeText(card.condition)}
                </Typography>

                {/* Price / availability */}
                <Box sx={{ mt: 0.5 }}>
                  {isForSale && card.price != null ? (
                    <Typography
                      variant="h5"
                      fontWeight={700}
                      sx={{ color: "black" }}
                    >
                      SGD ${card.price.toFixed(2)}
                    </Typography>
                  ) : (
                    <Typography
                      variant="body1"
                      color="text.secondary"
                      fontWeight={500}
                    >
                      Not currently for sale
                    </Typography>
                  )}
                </Box>

                {/* Shipping helper text */}
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  Listing Description: {safeText(card.description)}
                </Typography>

                {/* Seller / owner */}
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {isForSale ? "Sold by " : "Owned by "}
                  <Box component="span" fontWeight={600}>
                    {ownerName}
                  </Box>
                </Typography>

                {/* Action buttons */}
                {!isOwner ? (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: { xs: "column", sm: "row" },
                      gap: 1.2,
                      mt: 2,
                    }}
                  >
                    <Button
                      variant="outlined"
                      startIcon={<GavelIcon />}
                      sx={outlineButtonSx}
                      onClick={() => console.log("Leave offer", card.id)}
                    >
                      Leave offer
                    </Button>

                    <Button
                      variant="contained"
                      startIcon={<ShoppingCartIcon />}
                      sx={{
                        flex: 1,
                        textTransform: "none",
                        backgroundColor: primaryBlue,
                        "&:hover": { backgroundColor: "#0041cc" },
                      }}
                      disabled={!isForSale}
                      onClick={handleBuyNow}
                    >
                      Buy now
                    </Button>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: { xs: "column", sm: "row" },
                      gap: 1.2,
                      mt: 2,
                    }}
                  >
                    <Button
                      variant="outlined"
                      startIcon={<LocalOfferIcon />}
                      sx={outlineButtonSx}
                      onClick={() => console.log("View offers", card.id)}
                    >
                      View offers
                    </Button>

                    <Button
                      variant="outlined"
                      startIcon={<EditOutlinedIcon />}
                      sx={outlineButtonSx}
                      onClick={() => console.log("Edit listing", card.id)}
                    >
                      Edit listing
                    </Button>

                    {isAdmin && (
                      <Button
                        variant="outlined"
                        startIcon={<DeleteOutlineIcon />}
                        sx={{
                          flex: 1,
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
                        Delete
                      </Button>
                    )}
                  </Box>
                )}
              </Box>
            </Box>

            {/* Market price section */}
            <Box>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                Market Price History
              </Typography>
              <CardMarketChart card={card} />
            </Box>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default CardDetailDialog;
