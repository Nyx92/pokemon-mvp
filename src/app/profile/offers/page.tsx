"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Divider,
} from "@mui/material";
import Image from "next/image";
import { useRouter } from "next/navigation";
import GavelIcon from "@mui/icons-material/Gavel";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

interface OfferCard {
  id: string;
  title: string;
  imageUrls: string[];
  condition: string;
  forSale: boolean;
  owner: { id: string; username: string | null; email: string };
}

interface MyOffer {
  id: string;
  price: number | null;
  message: string | null;
  // pending  — awaiting seller response (funds authorised, held on card)
  // accepted — seller accepted; payment captured instantly (brief transient state)
  // rejected — seller declined; PI cancelled, no charge
  // expired  — seller didn't respond in 24h; PI cancelled by cron
  // paid     — fully complete; card transferred to buyer
  status: string;
  archivedAt: string | null;
  createdAt: string;
  card: OfferCard;
}

const STATUS_COLORS: Record<string, "default" | "warning" | "success" | "error" | "info"> = {
  pending:  "warning",
  accepted: "success",
  rejected: "error",
  expired:  "default",
  paid:     "info",
};

const STATUS_LABELS: Record<string, string> = {
  pending:  "Pending",
  // "accepted" is a very brief transient state — payment is captured immediately
  // when the seller accepts. The buyer rarely sees this; they'll typically see
  // "Purchased" on next page load.
  accepted: "Accepted",
  rejected: "Declined",
  expired:  "Expired",
  paid:     "Purchased",
};

export default function MyOffersPage() {
  const router = useRouter();
  const [offers, setOffers] = useState<MyOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/offers?mine=true")
      .then((r) => r.json())
      .then((data) => {
        if (data.offers) setOffers(data.offers);
        else setError(data.error ?? "Failed to load offers.");
      })
      .catch(() => setError("Failed to load offers."))
      .finally(() => setLoading(false));
  }, []);

  // Active: non-archived or paid (buyer wants to see completed purchases)
  // Archived: card was sold to someone else — historical record only
  const activeOffers   = offers.filter((o) => !o.archivedAt || o.status === "paid");
  const archivedOffers = offers.filter((o) => o.archivedAt && o.status !== "paid");

  const renderOffer = (offer: MyOffer) => (
    <Box
      key={offer.id}
      sx={{
        display: "flex",
        gap: 2,
        border: "1px solid #e5e7eb",
        borderRadius: 2,
        p: 1.5,
        mb: 1.5,
        backgroundColor: "#fff",
        alignItems: "flex-start",
      }}
    >
      {/* Card thumbnail — click to go to the card detail page */}
      <Box
        onClick={() => router.push(`/cards/${offer.card.id}`)}
        sx={{
          flexShrink: 0,
          width: 60,
          height: 84,
          borderRadius: 1,
          overflow: "hidden",
          position: "relative",
          cursor: "pointer",
          backgroundColor: "#f3f4f6",
        }}
      >
        <Image
          src={offer.card.imageUrls?.[0] ?? "/placeholder.png"}
          alt={offer.card.title}
          fill
          sizes="60px"
          style={{ objectFit: "cover" }}
        />
      </Box>

      {/* Offer details */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
          <Typography
            onClick={() => router.push(`/cards/${offer.card.id}`)}
            sx={{ fontSize: 14, fontWeight: 700, color: "#111", cursor: "pointer", "&:hover": { color: "#0053ff" } }}
          >
            {offer.card.title}
          </Typography>
          <Chip
            label={STATUS_LABELS[offer.status] ?? offer.status}
            size="small"
            color={STATUS_COLORS[offer.status] ?? "default"}
            sx={{ fontWeight: 600, fontSize: 11 }}
          />
        </Box>

        <Typography sx={{ fontSize: 12, color: "#6b7280", mt: 0.3 }}>
          {offer.card.condition} &middot; Seller:{" "}
          {offer.card.owner.username ?? offer.card.owner.email}
        </Typography>

        <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#111", mt: 0.5 }}>
          {offer.price != null ? `S$${offer.price.toFixed(2)}` : "—"}
        </Typography>

        {offer.message && (
          <Typography sx={{ fontSize: 12, color: "#6b7280", fontStyle: "italic", mt: 0.3 }}>
            &ldquo;{offer.message}&rdquo;
          </Typography>
        )}

        <Typography sx={{ fontSize: 11, color: "#9ca3af", mt: 0.5 }}>
          Offered on {new Date(offer.createdAt).toLocaleDateString()}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ maxWidth: 640, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 3, md: 5 } }}>
      <Box
        onClick={() => router.push("/profile")}
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
        <Typography sx={{ fontSize: 14, fontWeight: 500 }}>Back to Profile</Typography>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
        <GavelIcon sx={{ color: "#0053ff" }} />
        <Typography sx={{ fontSize: 22, fontWeight: 800, color: "#111" }}>My Offers</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : offers.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 6 }}>
          <Typography sx={{ color: "#9ca3af", fontSize: 15 }}>
            You haven&apos;t placed any offers yet.
          </Typography>
        </Box>
      ) : (
        <>
          {activeOffers.length > 0 && (
            <>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", mb: 1.5 }}>
                Active Offers
              </Typography>
              {activeOffers.map(renderOffer)}
            </>
          )}

          {archivedOffers.length > 0 && (
            <>
              {activeOffers.length > 0 && <Divider sx={{ my: 2 }} />}
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", mb: 1.5 }}>
                Past Offers (card no longer available)
              </Typography>
              {archivedOffers.map(renderOffer)}
            </>
          )}
        </>
      )}
    </Box>
  );
}
