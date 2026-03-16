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
  const [selCondition, setSelCondition] = useState("all");

  useEffect(() => {
    if (!id) return;
    const fetchCard = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/cards/${id}`);
        const data = await res.json();
        if (res.ok) setCard(data.card);
        else console.error("Error loading card:", data.error);
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
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
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
  const likesCount = card.likesCount ?? 0;

  const safeText = (val?: string | null) =>
    val && val.trim().length > 0 ? val : "-";

  const cardNumber = safeText(card.cardNumber);
  const language = safeText(card.language ?? "English");
  const condition = safeText(card.condition);

  const statusMeta = (() => {
    if (card.status === "sold") return { label: "SOLD", bg: "#A15C5C" };
    if (isForSale) return { label: "FOR SALE", bg: "#3FA796" };
    return { label: "NFS", bg: "#9E9E9E" };
  })();

  const requireLogin = (action: () => void) => {
    if (!userId) {
      router.push(
        `/auth/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`
      );
      return;
    }
    action();
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
      <IconButton onClick={() => router.back()} sx={{ mb: 2 }}>
        <ArrowBackIcon />
      </IconButton>

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
          {/* Status ribbon */}
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              width: { xs: 110, sm: 130 },
              height: { xs: 110, sm: 130 },
              overflow: "hidden",
              zIndex: 4,
              pointerEvents: "none",
            }}
          >
            <Box
              sx={{
                position: "absolute",
                top: { xs: 18, sm: 22 },
                left: { xs: -44, sm: -52 },
                width: { xs: 170, sm: 200 },
                py: { xs: 0.55, sm: 0.7 },
                textAlign: "center",
                transform: "rotate(-45deg)",
                color: "#fff",
                fontWeight: 900,
                fontSize: { xs: 11, sm: 12 },
                letterSpacing: "0.9px",
                textTransform: "uppercase",
                background: `linear-gradient(180deg, rgba(255,255,255,0.18), rgba(0,0,0,0.12)), ${statusMeta.bg}`,
                borderTop: "1px solid rgba(255,255,255,0.35)",
                borderBottom: "1px solid rgba(0,0,0,0.18)",
                boxShadow: "0 10px 22px rgba(0,0,0,0.16)",
              }}
            >
              {statusMeta.label}
            </Box>
          </Box>

          {/* Likes pill (viewers) */}
          {!isOwner && (
            <Box
              sx={{
                alignSelf: "flex-end",
                backgroundColor: "rgba(255,255,255,0.96)",
                px: 1.2,
                py: 0.45,
                borderRadius: 999,
                display: "flex",
                alignItems: "center",
                gap: 0.6,
                boxShadow: "0 6px 18px rgba(0,0,0,0.10)",
                mb: -1,
              }}
            >
              <FavoriteIcon fontSize="small" color="error" />
              <Typography sx={{ fontSize: 12, fontWeight: 800 }}>
                {likesCount.toLocaleString()}
              </Typography>
            </Box>
          )}

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
          </Box>

          {/* Thumbnails */}
          {card.imageUrls?.length > 1 && (
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "center" }}>
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
        <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Title */}
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
            {card.condition ? ` - ${card.condition}` : ""}
          </Typography>

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
                  sx={{ width: 140, fontSize: 13, color: "#6b7280", flexShrink: 0 }}
                >
                  {label}
                </Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#111" }}>
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>

          <Divider />

          {/* Buy Box */}
          <BuyBox
            mode={canManageListing ? "owner" : "viewer"}
            offersCount={10}
            onEdit={() => console.log("Edit listing", card.id)}
            isForSale={isForSale}
            priceText={card.price != null ? `S$${card.price.toFixed(2)}` : "S$ -"}
            primaryBlue={primaryBlue}
            condition={selCondition}
            onConditionChange={setSelCondition}
            onPlaceOffer={() =>
              requireLogin(() => {
                if (canManageListing) console.log("See offers", card.id);
                else console.log("Place offer", card.id);
              })
            }
            onBuyNow={() => requireLogin(handleBuyNow)}
            otherListingsTitle="View 5 Other Listings"
            otherListingsSubtitle="As low as S$568.70"
          />

          {/* Market Chart */}
          <CardMarketChart card={card} />
        </Box>
      </Box>
    </Box>
  );
}
