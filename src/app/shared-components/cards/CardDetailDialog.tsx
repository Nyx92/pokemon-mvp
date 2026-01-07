"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";

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
import BuyBox from "./BuyBox";

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
  const [selCondition, setSelCondition] = useState("all");

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

  const cardNumber = safeText((card as any).cardNumber);
  const language = safeText((card as any).language ?? "English");
  const condition = safeText(card.condition);

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
            borderRadius: { xs: 2, sm: 3 },
            overflow: "hidden",
            boxShadow: "0 12px 45px rgba(0,0,0,0.25)",

            // Modal responsive width
            width: {
              xs: "94vw",
              sm: "90vw",
              md: "70vw",
              lg: "60vw",
              xl: "50vw",
            },
            maxWidth: { lg: "1180px" },

            // ✅ keep it within viewport height on small devices
            maxHeight: { xs: "92dvh", sm: "90dvh" },
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

      {/* Top-left status banner */}
      <Box
        sx={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 4,
          pointerEvents: "none",
        }}
      >
        {card.status === "sold" && (
          <Box
            sx={{
              px: 1.4,
              py: 0.6,
              borderRadius: 999,
              fontWeight: 800,
              fontSize: 12,
              color: "#fff",
              backgroundColor: "#A15C5C",
              boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
            }}
          >
            SOLD
          </Box>
        )}

        {card.status !== "sold" && isForSale && (
          <Box
            sx={{
              px: 1.4,
              py: 0.6,
              borderRadius: 999,
              fontWeight: 800,
              fontSize: 12,
              color: "#fff",
              backgroundColor: "#3FA796",
              boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
            }}
          >
            FOR SALE
          </Box>
        )}

        {card.status !== "sold" && !isForSale && (
          <Box
            sx={{
              px: 1.4,
              py: 0.6,
              borderRadius: 999,
              fontWeight: 800,
              fontSize: 12,
              color: "#fff",
              backgroundColor: "#9E9E9E",
              boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
            }}
          >
            NFS
          </Box>
        )}
      </Box>

      <DialogContent
        sx={{
          p: { xs: 2, md: 3 },
          backgroundColor: "#f3f4f6",
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
              flex: { xs: "0 0 auto", md: "0 0 36%" }, // ✅ left takes ~36% on desktop
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: { xs: "flex-start", md: "center" }, // ✅ vertical center
              alignItems: "center", // ✅ horizontal center
              py: { xs: 0, md: 1 },
              gap: 1.2,
            }}
          >
            {/* Image */}
            <Box
              sx={{
                position: "relative",
                width: "100%",
                maxWidth: { xs: 280, md: 250 },
                minHeight: { xs: 340, md: 520 },
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Image
                src={card.imageUrls?.[activeImageIndex] || "/placeholder.png"}
                alt={`${card.title} large`}
                fill // matches old width/height 100%
                sizes="(max-width: 600px) 280px, 350px" // tells Next what responsive size to request
                style={{ objectFit: "contain" }} // same as your old objectFit
                priority={open} // boost LCP only when dialog open
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

              {/* Viewer: likes pill (under banner) */}
              {!isOwner && (
                <Box
                  sx={{
                    position: "absolute",
                    top: 56, // ✅ sits below the modal banner zone
                    left: 10,
                    backgroundColor: "rgba(255,255,255,0.96)",
                    px: 1.3,
                    py: 0.45,
                    borderRadius: 999,
                    display: "flex",
                    alignItems: "center",
                    gap: 0.6,
                    boxShadow: "0 6px 18px rgba(0,0,0,0.10)",
                  }}
                >
                  <FavoriteIcon fontSize="small" color="error" />
                  <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
                    {likesCount.toLocaleString()}
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Thumbs + CTA wrapper */}
            <Box sx={{ width: "100%", maxWidth: { xs: 280, md: 250 } }}>
              {/* Thumbnails */}
              {card.imageUrls?.length > 1 && (
                <Box
                  sx={{
                    display: "flex",
                    gap: 1,
                    justifyContent: "center",
                    flexWrap: "wrap",
                    mt: 1,
                  }}
                >
                  {card.imageUrls.map((url, i) => (
                    <Box
                      key={i}
                      onClick={() => setActiveImageIndex(i)}
                      sx={{
                        width: 54,
                        height: 54,
                        borderRadius: 1.5,
                        overflow: "hidden",
                        cursor: "pointer",
                        border:
                          i === activeImageIndex
                            ? `2px solid ${primaryBlue}`
                            : "1px solid #ddd",
                        backgroundColor: "#fff",
                        position: "relative",
                      }}
                    >
                      <Image
                        src={
                          card.imageUrls?.[activeImageIndex] ||
                          "/placeholder.png"
                        }
                        alt={`${card.title} large`}
                        fill
                        sizes="(max-width: 600px) 280px, 350px"
                        style={{ objectFit: "contain" }}
                        priority={open}
                      />
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            {/* Button below image */}
            <Button
              variant="contained"
              fullWidth
              sx={{
                mt: 1.2, // ✅ close to thumbnails
                textTransform: "none",
                backgroundColor: primaryBlue,
                "&:hover": { backgroundColor: "#0041cc" },
                borderRadius: 1.5,
                fontWeight: 800,
                letterSpacing: "0.6px",
                py: 1.1,
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
              gap: 1,
            }}
          >
            {/* Segment 1: Title + metadata */}
            <Box sx={{ px: 0.5 }}>
              <Typography
                sx={{
                  fontSize: { xs: 15, sm: 16, md: 18, lg: 20 },
                  fontWeight: 800,
                  lineHeight: 1.1,
                  letterSpacing: "-0.4px",
                  color: "#111",
                }}
              >
                {card.title}
                {card.condition ? ` - ${card.condition}` : ""}
              </Typography>

              {/* Metadata (values left aligned) */}
              <Box sx={{ mt: 2 }}>
                {[
                  ["Card No.", cardNumber],
                  ["Language", language],
                  ["Condition", condition],
                ].map(([label, value]) => (
                  <Box
                    key={label}
                    sx={{
                      display: "flex",
                      py: 0.3,
                    }}
                  >
                    <Typography
                      sx={{
                        width: 140,
                        fontSize: { xs: 8, sm: 9, md: 10, lg: 12 },
                        color: "#6b7280",
                      }}
                    >
                      {label}
                    </Typography>

                    <Typography
                      sx={{
                        fontSize: { xs: 8, sm: 9, md: 10, lg: 12 },
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
            <BuyBox
              isForSale={isForSale}
              priceText={
                isForSale && card.price != null
                  ? `S$${card.price.toFixed(2)}`
                  : "S$ -"
              }
              primaryBlue={primaryBlue}
              condition={selCondition}
              onConditionChange={setSelCondition}
              onPlaceOffer={() => console.log("Place offer", card.id)}
              onBuyNow={handleBuyNow}
              otherListingsTitle="View 5 Other Listings"
              otherListingsSubtitle="As low as S$568.70"
            />

            {/* Segment 3: CardMarketChart now includes its own header */}
            <CardMarketChart card={card} />
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default CardDetailDialog;
