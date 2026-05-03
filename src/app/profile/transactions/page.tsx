"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Box, Typography, Tab, Tabs, CircularProgress, Alert,
  TextField, InputAdornment, IconButton, Divider, Button,
  Select, MenuItem,
} from "@mui/material";
import ShoppingBagIcon from "@mui/icons-material/ShoppingBag";
import GavelIcon from "@mui/icons-material/Gavel";
import SellIcon from "@mui/icons-material/Sell";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const PRIMARY_BLUE = "#0053ff";
const HEADER_BG = "#0f1f3d";

// ── Types ──────────────────────────────────────────────────────────────────────

interface OrderRow {
  id: string;
  status: string;
  amount: number;
  currency: string;
  createdAt: string;
  card: { id: string; title: string; imageUrl: string | null; condition: string };
  seller: { id: string; username: string | null; email: string };
  buyer:  { id: string; username: string | null; email: string };
}

interface OfferRow {
  id: string;
  price: number | null;
  status: string;
  archivedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
  card: { id: string; title: string; imageUrls: string[]; condition: string };
}

interface ReceivedOfferRow {
  id: string;
  price: number | null;
  status: string;
  createdAt: string;
  expiresAt: string | null;
  card: { id: string; title: string; imageUrls: string[]; condition: string };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const OFFER_STATUS_LABEL: Record<string, string> = {
  pending:  "Pending",
  accepted: "Accepted",
  rejected: "Declined",
  expired:  "Expired",
};

const CONDITION_META: Record<string, { bg: string; fg: string }> = {
  NM:  { bg: "rgba(16,185,129,0.12)",  fg: "#065f46" },
  LP:  { bg: "rgba(16,185,129,0.08)",  fg: "#047857" },
  MP:  { bg: "rgba(245,158,11,0.12)",  fg: "#92400e" },
  HP:  { bg: "rgba(239,68,68,0.12)",   fg: "#991b1b" },
  DMG: { bg: "rgba(107,114,128,0.12)", fg: "#374151" },
};

function formatTimeRemaining(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h remaining`;
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function ConditionPill({ condition }: { condition: string }) {
  const meta = CONDITION_META[condition] ?? { bg: "rgba(107,114,128,0.12)", fg: "#374151" };
  return (
    <Box sx={{ px: 1, py: 0.3, borderRadius: 1, backgroundColor: meta.bg, color: meta.fg, fontSize: 11, fontWeight: 700, display: "inline-block", letterSpacing: "0.3px" }}>
      {condition}
    </Box>
  );
}

function HeaderMeta({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.5px", lineHeight: 1 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#fff", mt: 0.3, fontFamily: label === "Order ID" ? "monospace" : "inherit" }}>
        {value}
      </Typography>
    </Box>
  );
}

function CardThumb({ src, alt, onClick }: { src: string; alt: string; onClick: () => void }) {
  return (
    <Box
      onClick={onClick}
      sx={{ width: { xs: 72, md: 100 }, height: { xs: 100, md: 140 }, borderRadius: 1.5, overflow: "hidden", backgroundColor: "#f3f4f6", position: "relative", border: "1px solid #e5e7eb", cursor: "pointer", p: "4px", flexShrink: 0 }}
    >
      <Image src={src} alt={alt} fill style={{ objectFit: "contain" }} />
    </Box>
  );
}

// ── Order card (Purchases + Sold) ─────────────────────────────────────────────

function OrderCard({ order }: { order: OrderRow }) {
  const router = useRouter();
  const dateStr = new Date(order.createdAt).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });

  return (
    <Box sx={{ border: "1px solid #cbd5e1", borderRadius: 2.5, overflow: "hidden", backgroundColor: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", transition: "box-shadow 0.15s", "&:hover": { boxShadow: "0 2px 8px rgba(0,0,0,0.09)" } }}>

      {/* Dark header — order ID + date on the left */}
      <Box sx={{ backgroundColor: HEADER_BG, px: 2.5, py: 1.6, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
        <HeaderMeta label="Order ID" value={`#${order.id.slice(0, 8).toUpperCase()}`} />
        <HeaderMeta label="Transaction date" value={dateStr} />
      </Box>

      <Divider />

      {/* Item row: image | title + condition | order total */}
      <Box sx={{ px: 2.5, py: 2.5, display: "grid", gridTemplateColumns: { xs: "72px 1fr auto", md: "100px 1fr auto" }, gap: 2.5, alignItems: "center" }}>
        <CardThumb
          src={order.card.imageUrl ?? "/placeholder.png"}
          alt={order.card.title}
          onClick={() => router.push(`/cards/${order.card.id}`)}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography
            onClick={() => router.push(`/cards/${order.card.id}`)}
            sx={{ fontWeight: 800, fontSize: { xs: 15, md: 17 }, cursor: "pointer", lineHeight: 1.3, mb: 1, "&:hover": { color: PRIMARY_BLUE } }}
          >
            {order.card.title}
          </Typography>
          <ConditionPill condition={order.card.condition} />
        </Box>
        <Box sx={{ textAlign: "right", flexShrink: 0 }}>
          <Typography sx={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", mb: 0.5 }}>
            Order total
          </Typography>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: 17, md: 20 }, color: "#111" }}>
            S${order.amount.toFixed(2)}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

// ── Placed offer card (offers I made as a buyer) ──────────────────────────────

function PlacedOfferCard({ offer }: { offer: OfferRow }) {
  const router = useRouter();
  const statusLabel = offer.status === "pending"
    ? "Awaiting seller's response"
    : (OFFER_STATUS_LABEL[offer.status] ?? offer.status);
  const timeLeft = offer.status === "pending" ? formatTimeRemaining(offer.expiresAt) : null;
  const dateStr = new Date(offer.createdAt).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });

  return (
    <Box sx={{ border: "1px solid #cbd5e1", borderRadius: 2.5, overflow: "hidden", backgroundColor: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", transition: "box-shadow 0.15s", "&:hover": { boxShadow: "0 2px 8px rgba(0,0,0,0.09)" } }}>

      <Box sx={{ backgroundColor: HEADER_BG, px: 2.5, py: 1.6, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4, flexWrap: "wrap" }}>
        <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <HeaderMeta label="Status" value={statusLabel} />
          {timeLeft && <HeaderMeta label="Offer validity" value={timeLeft} />}
        </Box>
        <HeaderMeta label="Offer date" value={dateStr} />
      </Box>

      <Divider />

      <Box sx={{ px: 2.5, py: 2.5, display: "grid", gridTemplateColumns: { xs: "72px 1fr auto", md: "100px 1fr auto" }, gap: 2.5, alignItems: "center" }}>
        <CardThumb
          src={offer.card.imageUrls?.[0] ?? "/placeholder.png"}
          alt={offer.card.title}
          onClick={() => router.push(`/cards/${offer.card.id}`)}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography
            onClick={() => router.push(`/cards/${offer.card.id}`)}
            sx={{ fontWeight: 800, fontSize: { xs: 15, md: 17 }, cursor: "pointer", lineHeight: 1.3, mb: 1, "&:hover": { color: PRIMARY_BLUE } }}
          >
            {offer.card.title}
          </Typography>
          <ConditionPill condition={offer.card.condition} />
        </Box>
        <Box sx={{ textAlign: "right", flexShrink: 0 }}>
          <Typography sx={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", mb: 0.5 }}>Offer amount</Typography>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: 17, md: 20 }, color: "#111" }}>
            {offer.price != null ? `S$${offer.price.toFixed(2)}` : "—"}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

// ── Received offer card (offers made on my cards) ─────────────────────────────

function ReceivedOfferCard({ offer, onRespond }: { offer: ReceivedOfferRow; onRespond: (id: string) => void }) {
  const router = useRouter();
  const [actioning, setActioning] = useState<"accept" | "reject" | null>(null);
  const timeLeft = formatTimeRemaining(offer.expiresAt);
  const dateStr = new Date(offer.createdAt).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });

  const handleAction = async (action: "accept" | "reject") => {
    setActioning(action);
    try {
      const res = await fetch(`/api/offers/${offer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) onRespond(offer.id);
    } catch {
      // silently fail — user can retry
    } finally {
      setActioning(null);
    }
  };

  return (
    <Box sx={{ border: "1px solid #cbd5e1", borderRadius: 2.5, overflow: "hidden", backgroundColor: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", transition: "box-shadow 0.15s", "&:hover": { boxShadow: "0 2px 8px rgba(0,0,0,0.09)" } }}>

      <Box sx={{ backgroundColor: HEADER_BG, px: 2.5, py: 1.6, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4, flexWrap: "wrap" }}>
        <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <HeaderMeta label="Status" value="Action required" />
          {timeLeft && <HeaderMeta label="Offer validity" value={timeLeft} />}
        </Box>
        <HeaderMeta label="Received on" value={dateStr} />
      </Box>

      <Divider />

      <Box sx={{ px: 2.5, py: 2.5, display: "grid", gridTemplateColumns: { xs: "72px 1fr auto", md: "100px 1fr auto" }, gap: 2.5, alignItems: "center" }}>
        <CardThumb
          src={offer.card.imageUrls?.[0] ?? "/placeholder.png"}
          alt={offer.card.title}
          onClick={() => router.push(`/cards/${offer.card.id}`)}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography
            onClick={() => router.push(`/cards/${offer.card.id}`)}
            sx={{ fontWeight: 800, fontSize: { xs: 15, md: 17 }, cursor: "pointer", lineHeight: 1.3, mb: 1, "&:hover": { color: PRIMARY_BLUE } }}
          >
            {offer.card.title}
          </Typography>
          <ConditionPill condition={offer.card.condition} />
        </Box>
        <Box sx={{ textAlign: "right", flexShrink: 0 }}>
          <Typography sx={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", mb: 0.5 }}>Offered</Typography>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: 17, md: 20 }, color: "#111", mb: 1.5 }}>
            {offer.price != null ? `S$${offer.price.toFixed(2)}` : "—"}
          </Typography>
          <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
            <Button
              size="small"
              variant="contained"
              onClick={() => handleAction("accept")}
              disabled={!!actioning}
              sx={{ bgcolor: "#065f46", "&:hover": { bgcolor: "#047857" }, textTransform: "none", fontWeight: 700, fontSize: 12, px: 1.5, minWidth: 64 }}
            >
              {actioning === "accept" ? <CircularProgress size={12} sx={{ color: "#fff" }} /> : "Accept"}
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleAction("reject")}
              disabled={!!actioning}
              sx={{ borderColor: "#dc2626", color: "#dc2626", "&:hover": { bgcolor: "rgba(220,38,38,0.06)", borderColor: "#dc2626" }, textTransform: "none", fontWeight: 700, fontSize: 12, px: 1.5, minWidth: 64 }}
            >
              {actioning === "reject" ? <CircularProgress size={12} sx={{ color: "#dc2626" }} /> : "Decline"}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab") ?? "purchases";
  const tabIndex = tabParam === "offers" ? 1 : tabParam === "sold" ? 2 : 0;

  const [showSuccess, setShowSuccess] = useState(searchParams.get("success") === "1");

  const [purchases, setPurchases]           = useState<OrderRow[]>([]);
  const [sold, setSold]                     = useState<OrderRow[]>([]);
  const [placedOffers, setPlacedOffers]     = useState<OfferRow[]>([]);
  const [receivedOffers, setReceivedOffers] = useState<ReceivedOfferRow[]>([]);

  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [loadingSold, setLoadingSold]           = useState(false);
  const [loadingOffers, setLoadingOffers]       = useState(false);

  const [offerView, setOfferView] = useState<"placed" | "received">("placed");

  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (tabIndex === 0 && purchases.length === 0 && !loadingPurchases) {
      setLoadingPurchases(true);
      fetch("/api/orders?type=purchases")
        .then((r) => r.json())
        .then((d) => { if (d.orders) setPurchases(d.orders); else setError(d.error); })
        .catch(() => setError("Failed to load purchases."))
        .finally(() => setLoadingPurchases(false));
    }
    if (tabIndex === 1 && placedOffers.length === 0 && !loadingOffers) {
      setLoadingOffers(true);
      Promise.all([
        fetch("/api/offers?mine=true").then((r) => r.json()),
        fetch("/api/offers?received=true").then((r) => r.json()),
      ])
        .then(([placed, received]) => {
          if (placed.offers) setPlacedOffers(placed.offers); else setError(placed.error);
          if (received.offers) setReceivedOffers(received.offers);
        })
        .catch(() => setError("Failed to load offers."))
        .finally(() => setLoadingOffers(false));
    }
    if (tabIndex === 2 && sold.length === 0 && !loadingSold) {
      setLoadingSold(true);
      fetch("/api/orders?type=sold")
        .then((r) => r.json())
        .then((d) => { if (d.orders) setSold(d.orders); else setError(d.error); })
        .catch(() => setError("Failed to load sold items."))
        .finally(() => setLoadingSold(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabIndex]);

  // Only show PAID orders — filter out PENDING (abandoned checkouts) and other terminal states
  const filteredPurchases = useMemo(() => {
    const paid = purchases.filter((o) => o.status === "PAID");
    if (!q.trim()) return paid;
    const lq = q.toLowerCase();
    return paid.filter((o) => [o.card.title, o.card.condition, `S$${o.amount}`, o.id].join(" ").toLowerCase().includes(lq));
  }, [purchases, q]);

  const filteredSold = useMemo(() => {
    const paid = sold.filter((o) => o.status === "PAID");
    if (!q.trim()) return paid;
    const lq = q.toLowerCase();
    return paid.filter((o) => [o.card.title, o.card.condition, `S$${o.amount}`, o.id].join(" ").toLowerCase().includes(lq));
  }, [sold, q]);

  // Exclude paid offers — those are already visible in Purchases
  const filteredPlacedOffers = useMemo(() => {
    const active = placedOffers.filter((o) => o.status !== "paid");
    if (!q.trim()) return active;
    const lq = q.toLowerCase();
    return active.filter((o) => [o.card.title, o.status, `S$${o.price}`].join(" ").toLowerCase().includes(lq));
  }, [placedOffers, q]);

  const filteredReceivedOffers = useMemo(() => {
    if (!q.trim()) return receivedOffers;
    const lq = q.toLowerCase();
    return receivedOffers.filter((o) => [o.card.title, `S$${o.price}`].join(" ").toLowerCase().includes(lq));
  }, [receivedOffers, q]);

  const handleTabChange = (_: React.SyntheticEvent, newIndex: number) => {
    const tabName = newIndex === 1 ? "offers" : newIndex === 2 ? "sold" : "purchases";
    router.replace(`/profile/transactions?tab=${tabName}`);
  };

  return (
    <Box sx={{ minHeight: "100dvh", backgroundColor: "#f9fafb", px: { xs: 2, md: 4 }, py: { xs: 2, md: 3 } }}>

      <Box onClick={() => router.push("/profile")} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mb: 2.5, cursor: "pointer", color: "#6b7280", "&:hover": { color: "#111" } }}>
        <ArrowBackIcon fontSize="small" />
        <Typography sx={{ fontSize: 14, fontWeight: 500 }}>Back to Profile</Typography>
      </Box>

      <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, alignItems: { xs: "stretch", md: "center" }, justifyContent: "space-between", gap: 2, mb: 3 }}>
        <Typography sx={{ fontSize: { xs: 26, md: 32 }, fontWeight: 800, letterSpacing: "-0.5px" }}>Transaction History</Typography>
        <TextField
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by card name, condition, amount…"
          size="small"
          sx={{ width: { xs: "100%", md: 360 }, "& .MuiOutlinedInput-root": { borderRadius: 2, backgroundColor: "#fff" } }}
          slotProps={{
            input: {
              startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: "#9ca3af" }} /></InputAdornment>,
              endAdornment: q ? <InputAdornment position="end"><IconButton onClick={() => setQ("")} size="small"><CloseIcon fontSize="small" /></IconButton></InputAdornment> : null,
            },
          }}
        />
      </Box>

      {showSuccess && (
        <Box sx={{ mb: 3, border: "1px solid rgba(16,185,129,0.3)", backgroundColor: "rgba(16,185,129,0.07)", borderRadius: 2, px: 2.5, py: 1.4, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
            <ShoppingBagIcon sx={{ color: "#065f46" }} />
            <Box>
              <Typography sx={{ fontWeight: 800, color: "#065f46" }}>Payment successful</Typography>
              <Typography sx={{ fontSize: 13, color: "#047857" }}>Your transaction has been recorded below.</Typography>
            </Box>
          </Box>
          <Button variant="text" sx={{ textTransform: "none", fontWeight: 700, color: "#047857" }} onClick={() => setShowSuccess(false)}>Dismiss</Button>
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Box sx={{ backgroundColor: "#fff", borderRadius: 2.5, border: "1px solid #cbd5e1", mb: 3, overflow: "hidden" }}>
        <Tabs value={tabIndex} onChange={handleTabChange} sx={{ borderBottom: "1px solid #e5e7eb", px: 1 }} TabIndicatorProps={{ style: { backgroundColor: PRIMARY_BLUE } }}>
          <Tab icon={<ShoppingBagIcon fontSize="small" />} iconPosition="start" label="Purchases" sx={{ textTransform: "none", fontWeight: 700, fontSize: 14, color: tabIndex === 0 ? PRIMARY_BLUE : "#6b7280", minHeight: 52 }} />
          <Tab icon={<GavelIcon fontSize="small" />}       iconPosition="start" label="My Offers"  sx={{ textTransform: "none", fontWeight: 700, fontSize: 14, color: tabIndex === 1 ? PRIMARY_BLUE : "#6b7280", minHeight: 52 }} />
          <Tab icon={<SellIcon fontSize="small" />}        iconPosition="start" label="Sold"        sx={{ textTransform: "none", fontWeight: 700, fontSize: 14, color: tabIndex === 2 ? PRIMARY_BLUE : "#6b7280", minHeight: 52 }} />
        </Tabs>

        <Box sx={{ p: { xs: 2, md: 3 } }}>

          {/* ── Purchases ── */}
          {tabIndex === 0 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {loadingPurchases
                ? <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
                : filteredPurchases.length === 0
                  ? <Box sx={{ textAlign: "center", py: 8 }}>
                      <ShoppingBagIcon sx={{ fontSize: 40, color: "#d1d5db", mb: 1 }} />
                      <Typography sx={{ color: "#9ca3af", fontSize: 15 }}>{q ? "No purchases match your search." : "You haven't purchased anything yet."}</Typography>
                    </Box>
                  : filteredPurchases.map((o) => <OrderCard key={o.id} order={o} />)
              }
            </Box>
          )}

          {/* ── My Offers ── */}
          {tabIndex === 1 && (
            <Box>
              {loadingOffers
                ? <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
                : <>
                    {/* Dropdown filter */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
                      <Select
                        value={offerView}
                        onChange={(e) => setOfferView(e.target.value as "placed" | "received")}
                        size="small"
                        sx={{ minWidth: 220, backgroundColor: "#fff", borderRadius: 1.5, fontWeight: 600, fontSize: 14 }}
                      >
                        <MenuItem value="placed">Offers Placed</MenuItem>
                        <MenuItem value="received">Incoming Offers</MenuItem>
                      </Select>
                    </Box>

                    {/* Section title */}
                    <Typography sx={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.3px", mb: 2.5 }}>
                      {offerView === "placed" ? "Offers Placed" : "Incoming Offers"}
                    </Typography>

                    {/* Offers I Placed */}
                    {offerView === "placed" && (
                      filteredPlacedOffers.length === 0
                        ? <Box sx={{ textAlign: "center", py: 8 }}>
                            <GavelIcon sx={{ fontSize: 40, color: "#d1d5db", mb: 1 }} />
                            <Typography sx={{ color: "#9ca3af", fontSize: 15 }}>{q ? "No offers match your search." : "You haven't placed any offers yet."}</Typography>
                          </Box>
                        : <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            {filteredPlacedOffers.filter((o) => !o.archivedAt).map((o) => <PlacedOfferCard key={o.id} offer={o} />)}
                            {filteredPlacedOffers.filter((o) => !!o.archivedAt).length > 0 && (
                              <>
                                <Divider sx={{ my: 1 }} />
                                <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", mb: 0.5 }}>Past — card no longer available</Typography>
                                {filteredPlacedOffers.filter((o) => !!o.archivedAt).map((o) => <PlacedOfferCard key={o.id} offer={o} />)}
                              </>
                            )}
                          </Box>
                    )}

                    {/* Offers on My Listings */}
                    {offerView === "received" && (
                      filteredReceivedOffers.length === 0
                        ? <Box sx={{ textAlign: "center", py: 8 }}>
                            <GavelIcon sx={{ fontSize: 40, color: "#d1d5db", mb: 1 }} />
                            <Typography sx={{ color: "#9ca3af", fontSize: 15 }}>{q ? "No offers match your search." : "No incoming offers on your listings."}</Typography>
                          </Box>
                        : <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            {filteredReceivedOffers.map((o) => <ReceivedOfferCard key={o.id} offer={o} onRespond={(id) => setReceivedOffers((prev) => prev.filter((r) => r.id !== id))} />)}
                          </Box>
                    )}
                  </>
              }
            </Box>
          )}

          {/* ── Sold ── */}
          {tabIndex === 2 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {loadingSold
                ? <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
                : filteredSold.length === 0
                  ? <Box sx={{ textAlign: "center", py: 8 }}>
                      <SellIcon sx={{ fontSize: 40, color: "#d1d5db", mb: 1 }} />
                      <Typography sx={{ color: "#9ca3af", fontSize: 15 }}>{q ? "No sales match your search." : "You haven't sold anything yet."}</Typography>
                    </Box>
                  : filteredSold.map((o) => <OrderCard key={o.id} order={o} />)
              }
            </Box>
          )}

        </Box>
      </Box>
    </Box>
  );
}
