"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Chip,
  Button,
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
  status: string; // pending | accepted | rejected | paid
  archivedAt: string | null;
  createdAt: string;
  card: OfferCard;
}

const STATUS_COLORS: Record<string, "default" | "warning" | "success" | "error" | "info"> = {
  pending: "warning",
  accepted: "success",
  rejected: "error",
  paid: "info",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted — Pay Now",
  rejected: "Declined",
  paid: "Purchased",
};

export default function MyOffersPage() {
  const router = useRouter();
  const [offers, setOffers] = useState<MyOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [payLoading, setPayLoading] = useState<string | null>(null);
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

  const handlePayNow = async (offerId: string) => {
    setPayLoading(offerId);
    try {
      const res = await fetch("/api/checkout/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to start checkout.");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPayLoading(null);
    }
  };

  // Group: active (non-archived) first, then archived history
  const activeOffers = offers.filter((o) => !o.archivedAt || o.status === "paid");
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
      {/* Card thumbnail */}
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

      {/* Details */}
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

        {offer.status === "accepted" && !offer.archivedAt && (
          <Button
            variant="contained"
            size="small"
            onClick={() => handlePayNow(offer.id)}
            disabled={payLoading === offer.id}
            startIcon={payLoading === offer.id ? <CircularProgress size={12} color="inherit" /> : undefined}
            sx={{
              mt: 1,
              textTransform: "none",
              backgroundColor: "#0053ff",
              "&:hover": { backgroundColor: "#0041cc" },
              fontWeight: 600,
              borderRadius: 1.5,
            }}
          >
            {payLoading === offer.id ? "Loading…" : "Pay Now"}
          </Button>
        )}
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
