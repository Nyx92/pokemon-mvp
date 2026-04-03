"use client";

/**
 * /profile/transactions
 *
 * Single page for all of a user's transaction history, split into 3 tabs:
 *
 *   Tab 1 — Purchases : orders where the user is the buyer (Buy Now or via offer)
 *   Tab 2 — My Offers : all offers the user has placed as a buyer
 *   Tab 3 — Sold      : orders where the user is the seller
 *
 * URL state:
 *   ?tab=purchases (default) | ?tab=offers | ?tab=sold
 *   ?success=1               — show success banner after payment
 *   ?session_id=...          — Stripe session id passed by checkout/success page
 *
 * Data sources:
 *   Purchases + Sold → GET /api/orders?type=purchases|sold
 *   My Offers        → GET /api/offers?mine=true
 */

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Box,
  Typography,
  Chip,
  Button,
  Tab,
  Tabs,
  CircularProgress,
  Alert,
  TextField,
  InputAdornment,
  IconButton,
  Divider,
} from "@mui/material";
import ShoppingBagIcon from "@mui/icons-material/ShoppingBag";
import GavelIcon from "@mui/icons-material/Gavel";
import SellIcon from "@mui/icons-material/Sell";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const PRIMARY_BLUE = "#0053ff";

// ── Shared types ──────────────────────────────────────────────────────────────

interface OrderRow {
  id: string;
  status: string;
  amount: number;        // in dollars (already converted from cents by the API)
  currency: string;
  createdAt: string;
  viaOffer: boolean;     // true = purchased via offer, false = direct Buy Now
  card: {
    id: string;
    title: string;
    imageUrl: string | null;
    condition: string;
  };
  seller: { id: string; username: string | null; email: string };
  buyer:  { id: string; username: string | null; email: string };
}

interface OfferRow {
  id: string;
  price: number | null;
  message: string | null;
  status: string;
  archivedAt: string | null;
  createdAt: string;
  card: {
    id: string;
    title: string;
    imageUrls: string[];
    condition: string;
    owner: { id: string; username: string | null; email: string };
  };
}

// ── Status helpers ─────────────────────────────────────────────────────────────

const ORDER_STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  PAID:     { label: "Paid",      bg: "rgba(16,185,129,0.12)",  fg: "#065f46" },
  PENDING:  { label: "Pending",   bg: "rgba(25,118,210,0.12)",  fg: PRIMARY_BLUE },
  EXPIRED:  { label: "Expired",   bg: "rgba(107,114,128,0.14)", fg: "#374151" },
  CANCELED: { label: "Cancelled", bg: "rgba(239,68,68,0.12)",   fg: "#991b1b" },
  REFUNDED: { label: "Refunded",  bg: "rgba(107,114,128,0.14)", fg: "#374151" },
};

const OFFER_STATUS_COLORS: Record<string, "default" | "warning" | "success" | "error" | "info"> = {
  pending:  "warning",
  accepted: "success",
  rejected: "error",
  expired:  "default",
  paid:     "info",
};

const OFFER_STATUS_LABELS: Record<string, string> = {
  pending:  "Pending",
  accepted: "Accepted",
  rejected: "Declined",
  expired:  "Expired",
  paid:     "Purchased",
};

// ── Status pill ────────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const meta = ORDER_STATUS_META[status] ?? {
    label: status,
    bg: "rgba(107,114,128,0.14)",
    fg: "#374151",
  };
  return (
    <Box sx={{ px: 1, py: 0.35, borderRadius: 999, backgroundColor: meta.bg, color: meta.fg, fontWeight: 900, fontSize: 12, display: "inline-block" }}>
      {meta.label}
    </Box>
  );
}

// ── Order card (used for Purchases and Sold tabs) ─────────────────────────────
function OrderCard({ order, mode }: { order: OrderRow; mode: "purchase" | "sold" }) {
  const router = useRouter();

  // "Other party" label differs by tab:
  // - purchase tab: show who you bought from (seller)
  // - sold tab: show who bought from you (buyer)
  const otherParty = mode === "purchase" ? order.seller : order.buyer;
  const otherLabel = mode === "purchase" ? "Sold by" : "Bought by";

  return (
    <Box sx={{ border: "1px solid #e5e7eb", borderRadius: 2, overflow: "hidden", backgroundColor: "#fff" }}>
      {/* ── Top summary bar ── */}
      <Box sx={{ backgroundColor: "#f9fafb", px: 2, py: 1.3, display: "flex", alignItems: { xs: "stretch", md: "center" }, justifyContent: "space-between", gap: 2, flexDirection: { xs: "column", md: "row" } }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <StatusPill status={order.status} />
            {order.viaOffer && (
              // Badge to distinguish offer purchases from direct Buy Now purchases
              <Box sx={{ px: 1, py: 0.3, borderRadius: 999, backgroundColor: "rgba(0,83,255,0.08)", color: PRIMARY_BLUE, fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 0.4 }}>
                <GavelIcon sx={{ fontSize: 12 }} /> Via Offer
              </Box>
            )}
          </Box>
          <Typography sx={{ color: "#4b5563", fontSize: 13, mt: 0.4 }}>
            {new Date(order.createdAt).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })}
            {" · "}S${order.amount.toFixed(2)}
            {" · "}Order #{order.id.slice(0, 8).toUpperCase()}
          </Typography>
        </Box>

        <Button
          variant="outlined"
          size="small"
          startIcon={<OpenInNewIcon />}
          onClick={() => router.push(`/cards/${order.card.id}`)}
          sx={{ borderRadius: 999, textTransform: "none", fontWeight: 700, borderColor: PRIMARY_BLUE, color: PRIMARY_BLUE, "&:hover": { borderColor: PRIMARY_BLUE, backgroundColor: "rgba(0,83,255,0.06)" }, alignSelf: { xs: "flex-start", md: "auto" } }}
        >
          View card
        </Button>
      </Box>

      <Divider />

      {/* ── Item row ── */}
      <Box sx={{ px: 2, py: 2, display: "grid", gridTemplateColumns: { xs: "84px 1fr", md: "130px 1fr" }, gap: 2, alignItems: "start" }}>
        {/* Card image — click goes to card detail page */}
        <Box
          onClick={() => router.push(`/cards/${order.card.id}`)}
          sx={{ width: { xs: 84, md: 130 }, height: { xs: 84, md: 130 }, borderRadius: 2, overflow: "hidden", backgroundColor: "#f3f4f6", position: "relative", border: "1px solid #e5e7eb", cursor: "pointer" }}
        >
          <Image src={order.card.imageUrl ?? "/placeholder.png"} alt={order.card.title} fill style={{ objectFit: "cover" }} />
        </Box>

        {/* Card details */}
        <Box sx={{ minWidth: 0 }}>
          <Typography
            onClick={() => router.push(`/cards/${order.card.id}`)}
            sx={{ fontWeight: 800, fontSize: 15, cursor: "pointer", "&:hover": { color: PRIMARY_BLUE }, textDecoration: "underline", textDecorationColor: "rgba(0,0,0,0.2)" }}
          >
            {order.card.title}
          </Typography>
          <Typography sx={{ fontSize: 12, color: "#6b7280", mt: 0.3 }}>{order.card.condition}</Typography>
          <Typography sx={{ fontWeight: 800, fontSize: 15, mt: 0.5 }}>S${order.amount.toFixed(2)}</Typography>
          <Typography sx={{ color: "#6b7280", fontSize: 13, mt: 0.4 }}>
            {otherLabel}:{" "}
            <span style={{ color: "#111", fontWeight: 600 }}>
              {otherParty.username ?? otherParty.email}
            </span>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

// ── Offer card (used for My Offers tab) ───────────────────────────────────────
function OfferCard({ offer }: { offer: OfferRow }) {
  const router = useRouter();
  return (
    <Box sx={{ display: "flex", gap: 2, border: "1px solid #e5e7eb", borderRadius: 2, p: 1.5, backgroundColor: "#fff", alignItems: "flex-start" }}>
      {/* Card thumbnail */}
      <Box onClick={() => router.push(`/cards/${offer.card.id}`)} sx={{ flexShrink: 0, width: 60, height: 84, borderRadius: 1, overflow: "hidden", position: "relative", cursor: "pointer", backgroundColor: "#f3f4f6" }}>
        <Image src={offer.card.imageUrls?.[0] ?? "/placeholder.png"} alt={offer.card.title} fill sizes="60px" style={{ objectFit: "cover" }} />
      </Box>

      {/* Details */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
          <Typography onClick={() => router.push(`/cards/${offer.card.id}`)} sx={{ fontSize: 14, fontWeight: 700, color: "#111", cursor: "pointer", "&:hover": { color: PRIMARY_BLUE } }}>
            {offer.card.title}
          </Typography>
          <Chip label={OFFER_STATUS_LABELS[offer.status] ?? offer.status} size="small" color={OFFER_STATUS_COLORS[offer.status] ?? "default"} sx={{ fontWeight: 600, fontSize: 11 }} />
        </Box>
        <Typography sx={{ fontSize: 12, color: "#6b7280", mt: 0.3 }}>
          {offer.card.condition} · Seller: {offer.card.owner.username ?? offer.card.owner.email}
        </Typography>
        <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#111", mt: 0.5 }}>
          {offer.price != null ? `S$${offer.price.toFixed(2)}` : "—"}
        </Typography>
        {offer.message && (
          <Typography sx={{ fontSize: 12, color: "#6b7280", fontStyle: "italic", mt: 0.3 }}>&ldquo;{offer.message}&rdquo;</Typography>
        )}
        <Typography sx={{ fontSize: 11, color: "#9ca3af", mt: 0.5 }}>
          Offered on {new Date(offer.createdAt).toLocaleDateString()}
        </Typography>
      </Box>
    </Box>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TransactionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── 1. Derive active tab from URL ──────────────────────────────────────────
  // ?tab=purchases (default) | ?tab=offers | ?tab=sold
  // This lets the checkout/success page deep-link straight to purchases tab
  // and the seller accept flow deep-link to sold tab.
  const tabParam = searchParams.get("tab") ?? "purchases";
  const tabIndex = tabParam === "offers" ? 1 : tabParam === "sold" ? 2 : 0;

  // ── 2. Success banner state ────────────────────────────────────────────────
  // Shown when arriving via ?success=1 (redirected from checkout/success page)
  const [showSuccess, setShowSuccess] = useState(searchParams.get("success") === "1");

  // ── 3. Data state ──────────────────────────────────────────────────────────
  const [purchases, setPurchases] = useState<OrderRow[]>([]);
  const [sold, setSold]           = useState<OrderRow[]>([]);
  const [offers, setOffers]       = useState<OfferRow[]>([]);

  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [loadingSold, setLoadingSold]           = useState(false);
  const [loadingOffers, setLoadingOffers]       = useState(false);

  const [error, setError] = useState<string | null>(null);

  // ── 4. Search state ────────────────────────────────────────────────────────
  const [q, setQ] = useState("");

  // ── 5. Fetch data for each tab on first open ───────────────────────────────
  // We lazy-load each tab the first time the user clicks it (or on initial
  // render if the URL already points to that tab). This avoids fetching all
  // three data sets up front when the user only needs one.

  useEffect(() => {
    // Purchases tab
    if (tabIndex === 0 && purchases.length === 0 && !loadingPurchases) {
      setLoadingPurchases(true);
      fetch("/api/orders?type=purchases")
        .then((r) => r.json())
        .then((d) => { if (d.orders) setPurchases(d.orders); else setError(d.error); })
        .catch(() => setError("Failed to load purchases."))
        .finally(() => setLoadingPurchases(false));
    }
    // Offers tab
    if (tabIndex === 1 && offers.length === 0 && !loadingOffers) {
      setLoadingOffers(true);
      fetch("/api/offers?mine=true")
        .then((r) => r.json())
        .then((d) => { if (d.offers) setOffers(d.offers); else setError(d.error); })
        .catch(() => setError("Failed to load offers."))
        .finally(() => setLoadingOffers(false));
    }
    // Sold tab
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

  // ── 6. Search filter ───────────────────────────────────────────────────────
  // Simple client-side text filter across card title, amount, order id.
  const filteredPurchases = useMemo(() => {
    if (!q.trim()) return purchases;
    const lq = q.toLowerCase();
    return purchases.filter((o) =>
      [o.card.title, o.card.condition, `S$${o.amount}`, o.id, o.seller.username ?? o.seller.email]
        .join(" ").toLowerCase().includes(lq)
    );
  }, [purchases, q]);

  const filteredSold = useMemo(() => {
    if (!q.trim()) return sold;
    const lq = q.toLowerCase();
    return sold.filter((o) =>
      [o.card.title, o.card.condition, `S$${o.amount}`, o.id, o.buyer.username ?? o.buyer.email]
        .join(" ").toLowerCase().includes(lq)
    );
  }, [sold, q]);

  const filteredOffers = useMemo(() => {
    if (!q.trim()) return offers;
    const lq = q.toLowerCase();
    return offers.filter((o) =>
      [o.card.title, o.status, `S$${o.price}`, o.card.owner.username ?? o.card.owner.email]
        .join(" ").toLowerCase().includes(lq)
    );
  }, [offers, q]);

  // ── 7. Tab change handler — update URL so tab survives refresh ────────────
  const handleTabChange = (_: React.SyntheticEvent, newIndex: number) => {
    const tabName = newIndex === 1 ? "offers" : newIndex === 2 ? "sold" : "purchases";
    router.replace(`/profile/transactions?tab=${tabName}`);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ minHeight: "100dvh", backgroundColor: "#fff", px: { xs: 2, md: 4 }, py: { xs: 2, md: 3 } }}>

      {/* Back link */}
      <Box onClick={() => router.push("/profile")} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mb: 2, cursor: "pointer", color: "#6b7280", "&:hover": { color: "#111" } }}>
        <ArrowBackIcon fontSize="small" />
        <Typography sx={{ fontSize: 14, fontWeight: 500 }}>Back to Profile</Typography>
      </Box>

      {/* Header + search row */}
      <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, alignItems: { xs: "stretch", md: "center" }, justifyContent: "space-between", gap: 2, mb: 2.5 }}>
        <Typography sx={{ fontSize: { xs: 28, md: 34 }, fontWeight: 800 }}>Transaction History</Typography>

        {/* Search bar */}
        <TextField
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search transactions"
          size="small"
          sx={{ width: { xs: "100%", md: 380 }, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start"><SearchIcon sx={{ color: "#6b7280" }} /></InputAdornment>
              ),
              endAdornment: q ? (
                <InputAdornment position="end">
                  <IconButton onClick={() => setQ("")} size="small"><CloseIcon fontSize="small" /></IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
        />
      </Box>

      {/* Success banner — shown after successful payment (Buy Now or accepted offer) */}
      {showSuccess && (
        <Box sx={{ mb: 2, border: "1px solid rgba(0,83,255,0.2)", backgroundColor: "rgba(0,83,255,0.06)", borderRadius: 2, px: 2, py: 1.2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
          <Box sx={{ display: "flex", gap: 1.2, alignItems: "center" }}>
            <ShoppingBagIcon sx={{ color: PRIMARY_BLUE }} />
            <Box>
              <Typography sx={{ fontWeight: 800 }}>Payment successful</Typography>
              <Typography sx={{ fontSize: 12, color: "#4b5563" }}>Your transaction has been recorded below.</Typography>
            </Box>
          </Box>
          <Button variant="text" sx={{ textTransform: "none", fontWeight: 700 }} onClick={() => setShowSuccess(false)}>Dismiss</Button>
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Tabs */}
      <Tabs
        value={tabIndex}
        onChange={handleTabChange}
        sx={{ borderBottom: "1px solid #e5e7eb", mb: 2.5 }}
        TabIndicatorProps={{ style: { backgroundColor: PRIMARY_BLUE } }}
      >
        <Tab
          icon={<ShoppingBagIcon fontSize="small" />}
          iconPosition="start"
          label="Purchases"
          sx={{ textTransform: "none", fontWeight: 700, color: tabIndex === 0 ? PRIMARY_BLUE : "#6b7280", minHeight: 48 }}
        />
        <Tab
          icon={<GavelIcon fontSize="small" />}
          iconPosition="start"
          label="My Offers"
          sx={{ textTransform: "none", fontWeight: 700, color: tabIndex === 1 ? PRIMARY_BLUE : "#6b7280", minHeight: 48 }}
        />
        <Tab
          icon={<SellIcon fontSize="small" />}
          iconPosition="start"
          label="Sold"
          sx={{ textTransform: "none", fontWeight: 700, color: tabIndex === 2 ? PRIMARY_BLUE : "#6b7280", minHeight: 48 }}
        />
      </Tabs>

      {/* ── Tab 0: Purchases ── */}
      {tabIndex === 0 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {loadingPurchases ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
          ) : filteredPurchases.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 6 }}>
              <Typography sx={{ color: "#9ca3af", fontSize: 15 }}>
                {q ? "No purchases match your search." : "You haven't purchased anything yet."}
              </Typography>
            </Box>
          ) : (
            filteredPurchases.map((o) => <OrderCard key={o.id} order={o} mode="purchase" />)
          )}
        </Box>
      )}

      {/* ── Tab 1: My Offers ── */}
      {tabIndex === 1 && (
        <>
          {loadingOffers ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
          ) : filteredOffers.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 6 }}>
              <Typography sx={{ color: "#9ca3af", fontSize: 15 }}>
                {q ? "No offers match your search." : "You haven't placed any offers yet."}
              </Typography>
            </Box>
          ) : (
            <>
              {/* Active offers (not archived, or paid — buyer wants to see completed) */}
              {filteredOffers.filter((o) => !o.archivedAt || o.status === "paid").length > 0 && (
                <>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", mb: 1.5 }}>Active</Typography>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 2 }}>
                    {filteredOffers.filter((o) => !o.archivedAt || o.status === "paid").map((o) => <OfferCard key={o.id} offer={o} />)}
                  </Box>
                </>
              )}
              {/* Past offers — card was sold to someone else */}
              {filteredOffers.filter((o) => o.archivedAt && o.status !== "paid").length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", mb: 1.5 }}>Past (card no longer available)</Typography>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                    {filteredOffers.filter((o) => o.archivedAt && o.status !== "paid").map((o) => <OfferCard key={o.id} offer={o} />)}
                  </Box>
                </>
              )}
            </>
          )}
        </>
      )}

      {/* ── Tab 2: Sold ── */}
      {tabIndex === 2 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {loadingSold ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
          ) : filteredSold.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 6 }}>
              <Typography sx={{ color: "#9ca3af", fontSize: 15 }}>
                {q ? "No sales match your search." : "You haven't sold anything yet."}
              </Typography>
            </Box>
          ) : (
            filteredSold.map((o) => <OrderCard key={o.id} order={o} mode="sold" />)
          )}
        </Box>
      )}
    </Box>
  );
}
