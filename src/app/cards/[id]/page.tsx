"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  Box,
  Typography,
  Divider,
  IconButton,
  CircularProgress,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import { useAuth } from "@/app/hooks/useAuth";
import BuyBox from "@/app/shared-components/cards/BuyBox";
import CardMarketChart from "@/app/shared-components/cards/CardMarketChart";
import EditPriceDialog from "@/app/shared-components/cards/EditPriceDialog";
import AllListings from "@/app/shared-components/cards/AllListings";
import type { CardItem } from "@/types/card";

const primaryBlue = "#0053ff";

export default function CardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { userId, isAdmin } = useAuth();

  const [card, setCard] = useState<CardItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [editPriceOpen, setEditPriceOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchCard = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/cards/${id}`);
        const data = await res.json();
        if (res.ok) {
          setCard(data.card);
          setLiked(data.card.likedByUser ?? false);
          setLikesCount(data.card.likesCount ?? 0);
        } else console.error("Error loading card:", data.error);
      } catch (err) {
        console.error("Failed to fetch card:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCard();
  }, [id]);

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!card) {
    return (
      <Box sx={{ textAlign: "center", mt: 10 }}>
        <Typography variant="h6" color="text.secondary">
          Card not found.
        </Typography>
      </Box>
    );
  }

  const isOwner = userId === card.owner?.id;
  const canManageListing = isOwner || isAdmin;
  const isForSale = card.forSale && card.status !== "sold";

  const safeText = (val?: string | null) =>
    val && val.trim().length > 0 ? val : "-";

  const cardNumber = safeText(card.cardNumber);
  const language = safeText(card.language ?? "English");
  const condition = safeText(card.condition);

  const requireLogin = (action: () => void) => {
    if (!userId) {
      router.push(
        `/auth/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`
      );
      return;
    }
    action();
  };

  const handleLike = () => {
    requireLogin(async () => {
      const res = await fetch(`/api/cards/${id}/like`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setLiked(data.liked);
        setLikesCount(data.count);
      }
    });
  };

  const handleBuyNow = async () => {
    if (!card || !card.price || !userId) return;
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: card.id,
          title: card.title,
          price: card.price,
          imageUrls: card.imageUrls ?? [],
          buyerId: userId,
        }),
      });
      if (!res.ok) return console.error("Failed to create checkout session");
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error("Error calling /api/checkout:", err);
    }
  };

  return (
    <Box
      sx={{
        maxWidth: 1100,
        mx: "auto",
        px: { xs: 2, md: 4 },
        py: { xs: 3, md: 5 },
      }}
    >
      {/* Back button */}
      <Box
        onClick={() => router.push("/")}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          mb: 2,
          cursor: "pointer",
          color: "#6b7280",
          "&:hover": { color: "#111" },
        }}
      >
        <ArrowBackIcon fontSize="small" />
        <Typography sx={{ fontSize: 14, fontWeight: 500 }}>
          Back to Home
        </Typography>
      </Box>

      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          gap: 4,
          alignItems: "flex-start",
        }}
      >
        {/* ===== LEFT: image ===== */}
        <Box
          sx={{
            flex: { xs: "0 0 auto", md: "0 0 38%" },
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1.5,
            position: "relative",
          }}
        >
          {/* Main image */}
          <Box
            sx={{
              position: "relative",
              width: "100%",
              maxWidth: { xs: 300, md: 360 },
              aspectRatio: "2/3",
              backgroundColor: "#f8f8f8",
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <Image
              src={card.imageUrls?.[activeImageIndex] || "/placeholder.png"}
              alt={card.title}
              fill
              sizes="(max-width: 600px) 300px, 360px"
              style={{ objectFit: "contain" }}
              priority
            />

            {/* Like button — top-right, visible to non-owners */}
            {!isOwner && (
              <Box
                sx={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 0.2,
                }}
              >
                <IconButton
                  onClick={handleLike}
                  sx={{
                    backgroundColor: "rgba(255,255,255,0.95)",
                    "&:hover": { backgroundColor: "rgba(255,255,255,1)" },
                    p: 0.8,
                  }}
                >
                  {liked ? (
                    <FavoriteIcon color="error" sx={{ fontSize: 20 }} />
                  ) : (
                    <FavoriteBorderIcon sx={{ fontSize: 20, color: "#555" }} />
                  )}
                </IconButton>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#555" }}>
                  {likesCount}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Thumbnails */}
          {card.imageUrls?.length > 1 && (
            <Box
              sx={{
                display: "flex",
                gap: 1,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {card.imageUrls.map((url, i) => (
                <Box
                  key={i}
                  onClick={() => setActiveImageIndex(i)}
                  sx={{
                    width: 60,
                    height: 60,
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
                    src={url || "/placeholder.png"}
                    alt={`thumb ${i + 1}`}
                    fill
                    sizes="60px"
                    style={{ objectFit: "cover" }}
                  />
                </Box>
              ))}
            </Box>
          )}
        </Box>

        {/* ===== RIGHT: details ===== */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {/* Title row */}
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 1,
            }}
          >
            <Typography
              sx={{
                fontSize: { xs: 20, sm: 24, md: 28 },
                fontWeight: 800,
                lineHeight: 1.15,
                letterSpacing: "-0.4px",
                color: "#111",
              }}
            >
              {card.title}
            </Typography>
          </Box>

          {/* Metadata */}
          <Box>
            {[
              ["Card No.", cardNumber],
              ["Language", language],
              ["Condition", condition],
              ...(card.setName ? [["Set Name", card.setName]] : []),
              ...(card.rarity ? [["Rarity", card.rarity]] : []),
            ].map(([label, value]) => (
              <Box
                key={label}
                sx={{ display: "flex", py: 0.4, alignItems: "baseline" }}
              >
                <Typography
                  sx={{
                    width: 140,
                    fontSize: 13,
                    color: "#6b7280",
                    flexShrink: 0,
                  }}
                >
                  {label}
                </Typography>
                <Typography
                  sx={{ fontSize: 13, fontWeight: 700, color: "#111" }}
                >
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>

          <Divider />

          {/* Buy Box */}
          <BuyBox
            tcgPlayerId={card.tcgPlayerId}
            currentCardId={card.id}
            currentCondition={card.condition}
            currentPrice={card.price}
            mode={canManageListing ? "owner" : "viewer"}
            offersCount={10}
            onEdit={() => {
            if (isAdmin) router.push(`/cards/${card.id}/edit`);
            else setEditPriceOpen(true);
          }}
          onViewListings={() =>
            document.getElementById("all-listings")?.scrollIntoView({ behavior: "smooth" })
          }
            isForSale={isForSale}
            priceText={
              card.price != null ? `S$${card.price.toFixed(2)}` : "S$ -"
            }
            primaryBlue={primaryBlue}
            onPlaceOffer={() =>
              requireLogin(() => {
                if (canManageListing) console.log("See offers", card.id);
                else console.log("Place offer", card.id);
              })
            }
            onBuyNow={() => requireLogin(handleBuyNow)}
          />

          {/* Market Chart */}
          <CardMarketChart card={card} />
        </Box>
      </Box>

      {/* All Listings */}
      <Box id="all-listings" sx={{ mt: 4 }}>
        <AllListings tcgPlayerId={card.tcgPlayerId} currentCardId={card.id} />
      </Box>

      {!isAdmin && isOwner && (
        <EditPriceDialog
          open={editPriceOpen}
          cardId={card.id}
          currentPrice={card.price}
          currentForSale={card.forSale}
          onClose={() => setEditPriceOpen(false)}
          onSuccess={(updatedPrice, updatedForSale) => {
            setCard((prev) =>
              prev ? { ...prev, price: updatedPrice, forSale: updatedForSale } : prev
            );
          }}
        />
      )}
    </Box>
  );
}
